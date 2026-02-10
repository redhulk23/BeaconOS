import type { WorkflowStep } from "../workflow-parser.js";
import type { WorkflowState } from "../state-machine.js";
import { executeStep, type StepExecutionContext } from "../step-executor.js";
import { saveCheckpoint } from "../checkpoint.js";

export async function runSequential(
  steps: WorkflowStep[],
  ctx: StepExecutionContext,
  workflowRunId: string,
): Promise<WorkflowState> {
  ctx.state.status = "running";
  ctx.state.startedAt = new Date();

  for (const step of steps) {
    ctx.state.currentStep = step.id;
    await saveCheckpoint(workflowRunId, ctx.state);

    const result = await executeStep(step, ctx);
    ctx.state.stepResults[step.id] = {
      status: result.status,
      output: result.output,
    };

    if (result.status === "failed") {
      ctx.state.status = "failed";
      ctx.state.error = result.error;
      break;
    }

    if (result.status === "waiting") {
      ctx.state.status = "waiting_approval";
      await saveCheckpoint(workflowRunId, ctx.state);
      // Caller is responsible for resuming after approval
      return ctx.state;
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
