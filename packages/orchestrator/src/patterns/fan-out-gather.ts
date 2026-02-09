import type { WorkflowStep } from "../workflow-parser.js";
import type { WorkflowState } from "../state-machine.js";
import { executeStep, type StepExecutionContext } from "../step-executor.js";
import { saveCheckpoint } from "../checkpoint.js";

export async function runFanOutGather(
  steps: WorkflowStep[],
  ctx: StepExecutionContext,
  workflowRunId: string,
  config?: { gatherStep?: WorkflowStep },
): Promise<WorkflowState> {
  ctx.state.status = "running";
  ctx.state.startedAt = new Date();

  // Execute all steps in parallel
  const promises = steps.map(async (step) => {
    const result = await executeStep(step, ctx);
    return { stepId: step.id, result };
  });

  const results = await Promise.allSettled(promises);
  let allSucceeded = true;

  for (const result of results) {
    if (result.status === "fulfilled") {
      const { stepId, result: stepResult } = result.value;
      ctx.state.stepResults[stepId] = {
        status: stepResult.status,
        output: stepResult.output,
      };
      if (stepResult.status === "failed") allSucceeded = false;
    } else {
      allSucceeded = false;
    }
  }

  // Optional gather step to combine results
  if (config?.gatherStep && allSucceeded) {
    ctx.state.currentStep = config.gatherStep.id;
    const gatherResult = await executeStep(config.gatherStep, ctx);
    ctx.state.stepResults[config.gatherStep.id] = {
      status: gatherResult.status,
      output: gatherResult.output,
    };
    if (gatherResult.status === "failed") allSucceeded = false;
  }

  ctx.state.status = allSucceeded ? "completed" : "failed";
  ctx.state.completedAt = new Date();
  ctx.state.currentStep = null;
  await saveCheckpoint(workflowRunId, ctx.state);

  return ctx.state;
}
