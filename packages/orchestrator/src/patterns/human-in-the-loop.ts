import type { WorkflowStep } from "../workflow-parser.js";
import type { WorkflowState } from "../state-machine.js";
import { executeStep, type StepExecutionContext } from "../step-executor.js";
import { saveCheckpoint } from "../checkpoint.js";
import { createApprovalRequest, waitForApproval } from "../hitl/approval-gate.js";

export async function runHumanInTheLoop(
  preSteps: WorkflowStep[],
  approvalConfig: { title: string; description?: string; timeoutMs?: number },
  postSteps: WorkflowStep[],
  ctx: StepExecutionContext,
  workflowRunId: string,
): Promise<WorkflowState> {
  ctx.state.status = "running";
  ctx.state.startedAt = new Date();

  // Execute pre-approval steps sequentially
  for (const step of preSteps) {
    ctx.state.currentStep = step.id;
    await saveCheckpoint(workflowRunId, ctx.state);

    const result = await executeStep(step, ctx);
    ctx.state.stepResults[step.id] = { status: result.status, output: result.output };

    if (result.status === "failed") {
      ctx.state.status = "failed";
      ctx.state.error = result.error;
      ctx.state.completedAt = new Date();
      await saveCheckpoint(workflowRunId, ctx.state);
      return ctx.state;
    }
  }

  // Create and wait for approval
  ctx.state.status = "waiting_approval";
  ctx.state.currentStep = "approval_gate";
  await saveCheckpoint(workflowRunId, ctx.state);

  const approvalId = await createApprovalRequest({
    tenantId: ctx.tenantId,
    workflowRunId,
    type: "workflow_approval",
    title: approvalConfig.title,
    description: approvalConfig.description,
    context: ctx.state.data,
  });

  const decision = await waitForApproval(
    approvalId,
    1000,
    approvalConfig.timeoutMs ?? 300_000,
  );

  ctx.state.stepResults["approval_gate"] = {
    status: decision.approved ? "completed" : "failed",
    output: decision,
  };

  if (!decision.approved) {
    ctx.state.status = "failed";
    ctx.state.error = `Approval denied: ${decision.note ?? "no reason"}`;
    ctx.state.completedAt = new Date();
    await saveCheckpoint(workflowRunId, ctx.state);
    return ctx.state;
  }

  // Execute post-approval steps
  ctx.state.status = "running";

  for (const step of postSteps) {
    ctx.state.currentStep = step.id;
    await saveCheckpoint(workflowRunId, ctx.state);

    const result = await executeStep(step, ctx);
    ctx.state.stepResults[step.id] = { status: result.status, output: result.output };

    if (result.status === "failed") {
      ctx.state.status = "failed";
      ctx.state.error = result.error;
      break;
    }
  }

  if (ctx.state.status === "running") {
    ctx.state.status = "completed";
  }

  ctx.state.completedAt = new Date();
  ctx.state.currentStep = null;
  await saveCheckpoint(workflowRunId, ctx.state);

  return ctx.state;
}
