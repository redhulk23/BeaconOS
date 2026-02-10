import type { WorkflowStep } from "../workflow-parser.js";
import type { WorkflowState } from "../state-machine.js";
import { executeStep, type StepExecutionContext } from "../step-executor.js";
import { saveCheckpoint } from "../checkpoint.js";

/**
 * Coordinator pattern: a coordinator agent delegates tasks to worker agents
 * and synthesizes their results.
 */
export async function runCoordinator(
  coordinatorStep: WorkflowStep,
  workerSteps: WorkflowStep[],
  synthesizerStep: WorkflowStep,
  ctx: StepExecutionContext,
  workflowRunId: string,
): Promise<WorkflowState> {
  ctx.state.status = "running";
  ctx.state.startedAt = new Date();

  // Step 1: Coordinator plans the work
  ctx.state.currentStep = coordinatorStep.id;
  await saveCheckpoint(workflowRunId, ctx.state);
  const planResult = await executeStep(coordinatorStep, ctx);
  ctx.state.stepResults[coordinatorStep.id] = {
    status: planResult.status,
    output: planResult.output,
  };

  if (planResult.status === "failed") {
    ctx.state.status = "failed";
    ctx.state.error = planResult.error;
    ctx.state.completedAt = new Date();
    await saveCheckpoint(workflowRunId, ctx.state);
    return ctx.state;
  }

  // Step 2: Workers execute in parallel
  const workerResults = await Promise.allSettled(
    workerSteps.map(async (step) => {
      const result = await executeStep(step, ctx);
      return { stepId: step.id, result };
    }),
  );

  for (const wr of workerResults) {
    if (wr.status === "fulfilled") {
      ctx.state.stepResults[wr.value.stepId] = {
        status: wr.value.result.status,
        output: wr.value.result.output,
      };
    }
  }

  // Step 3: Synthesizer combines results
  ctx.state.currentStep = synthesizerStep.id;
  await saveCheckpoint(workflowRunId, ctx.state);
  const synthResult = await executeStep(synthesizerStep, ctx);
  ctx.state.stepResults[synthesizerStep.id] = {
    status: synthResult.status,
    output: synthResult.output,
  };

  ctx.state.status =
    synthResult.status === "completed" ? "completed" : "failed";
  ctx.state.completedAt = new Date();
  ctx.state.currentStep = null;
  await saveCheckpoint(workflowRunId, ctx.state);

  return ctx.state;
}
