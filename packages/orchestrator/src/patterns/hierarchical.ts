import type { WorkflowStep } from "../workflow-parser.js";
import type { WorkflowState } from "../state-machine.js";
import { executeStep, type StepExecutionContext } from "../step-executor.js";
import { saveCheckpoint } from "../checkpoint.js";

/**
 * Hierarchical pattern: manager agent decomposes task, delegates to specialists,
 * then reviews and consolidates results.
 */
export async function runHierarchical(
  managerStep: WorkflowStep,
  specialistSteps: WorkflowStep[],
  reviewStep: WorkflowStep,
  ctx: StepExecutionContext,
  workflowRunId: string,
): Promise<WorkflowState> {
  ctx.state.status = "running";
  ctx.state.startedAt = new Date();

  // Manager decomposes
  ctx.state.currentStep = managerStep.id;
  await saveCheckpoint(workflowRunId, ctx.state);
  const managerResult = await executeStep(managerStep, ctx);
  ctx.state.stepResults[managerStep.id] = {
    status: managerResult.status,
    output: managerResult.output,
  };

  if (managerResult.status === "failed") {
    ctx.state.status = "failed";
    ctx.state.error = managerResult.error;
    ctx.state.completedAt = new Date();
    await saveCheckpoint(workflowRunId, ctx.state);
    return ctx.state;
  }

  // Specialists execute sequentially (could be parallel based on config)
  for (const step of specialistSteps) {
    ctx.state.currentStep = step.id;
    await saveCheckpoint(workflowRunId, ctx.state);
    const result = await executeStep(step, ctx);
    ctx.state.stepResults[step.id] = {
      status: result.status,
      output: result.output,
    };

    if (result.status === "failed" && step.onError !== "skip") {
      ctx.state.status = "failed";
      ctx.state.error = result.error;
      ctx.state.completedAt = new Date();
      await saveCheckpoint(workflowRunId, ctx.state);
      return ctx.state;
    }
  }

  // Manager reviews
  ctx.state.currentStep = reviewStep.id;
  await saveCheckpoint(workflowRunId, ctx.state);
  const reviewResult = await executeStep(reviewStep, ctx);
  ctx.state.stepResults[reviewStep.id] = {
    status: reviewResult.status,
    output: reviewResult.output,
  };

  ctx.state.status =
    reviewResult.status === "completed" ? "completed" : "failed";
  ctx.state.completedAt = new Date();
  ctx.state.currentStep = null;
  await saveCheckpoint(workflowRunId, ctx.state);

  return ctx.state;
}
