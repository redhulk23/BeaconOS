import type { WorkflowStep } from "../workflow-parser.js";
import type { WorkflowState } from "../state-machine.js";
import { executeStep, type StepExecutionContext } from "../step-executor.js";
import { saveCheckpoint } from "../checkpoint.js";

/**
 * Blackboard pattern: multiple specialist agents contribute to a shared
 * knowledge space (the blackboard/state), iterating until a completion
 * condition is met.
 */
export async function runBlackboard(
  specialistSteps: WorkflowStep[],
  ctx: StepExecutionContext,
  workflowRunId: string,
  config?: { maxRounds?: number; completionKey?: string },
): Promise<WorkflowState> {
  const maxRounds = config?.maxRounds ?? 5;
  const completionKey = config?.completionKey ?? "_complete";

  ctx.state.status = "running";
  ctx.state.startedAt = new Date();

  for (let round = 0; round < maxRounds; round++) {
    ctx.state.data._round = round + 1;

    for (const step of specialistSteps) {
      ctx.state.currentStep = step.id;
      await saveCheckpoint(workflowRunId, ctx.state);

      const result = await executeStep(step, ctx);
      ctx.state.stepResults[`${step.id}_round_${round + 1}`] = {
        status: result.status,
        output: result.output,
      };

      // Specialist may signal completion via state
      if (ctx.state.data[completionKey]) {
        ctx.state.status = "completed";
        ctx.state.completedAt = new Date();
        ctx.state.currentStep = null;
        await saveCheckpoint(workflowRunId, ctx.state);
        return ctx.state;
      }
    }
  }

  ctx.state.status = "completed";
  ctx.state.completedAt = new Date();
  ctx.state.currentStep = null;
  await saveCheckpoint(workflowRunId, ctx.state);

  return ctx.state;
}
