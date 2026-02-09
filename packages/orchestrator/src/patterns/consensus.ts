import type { WorkflowStep } from "../workflow-parser.js";
import type { WorkflowState } from "../state-machine.js";
import { executeStep, type StepExecutionContext } from "../step-executor.js";
import { saveCheckpoint } from "../checkpoint.js";

/**
 * Consensus pattern: multiple agents independently process the same input,
 * then a judge agent determines the consensus answer.
 */
export async function runConsensus(
  voterSteps: WorkflowStep[],
  judgeStep: WorkflowStep,
  ctx: StepExecutionContext,
  workflowRunId: string,
  config?: { requiredAgreement?: number },
): Promise<WorkflowState> {
  const requiredAgreement = config?.requiredAgreement ?? 0.5;

  ctx.state.status = "running";
  ctx.state.startedAt = new Date();

  // All voters process in parallel
  const voteResults = await Promise.allSettled(
    voterSteps.map(async (step) => {
      const result = await executeStep(step, ctx);
      return { stepId: step.id, result };
    }),
  );

  const votes: Record<string, unknown>[] = [];
  for (const vr of voteResults) {
    if (vr.status === "fulfilled") {
      ctx.state.stepResults[vr.value.stepId] = {
        status: vr.value.result.status,
        output: vr.value.result.output,
      };
      if (vr.value.result.status === "completed") {
        votes.push(vr.value.result.output as Record<string, unknown>);
      }
    }
  }

  ctx.state.data._votes = votes;
  ctx.state.data._voteCount = votes.length;
  ctx.state.data._totalVoters = voterSteps.length;

  // Judge determines consensus
  ctx.state.currentStep = judgeStep.id;
  await saveCheckpoint(workflowRunId, ctx.state);
  const judgeResult = await executeStep(judgeStep, ctx);
  ctx.state.stepResults[judgeStep.id] = { status: judgeResult.status, output: judgeResult.output };

  ctx.state.status = judgeResult.status === "completed" ? "completed" : "failed";
  ctx.state.completedAt = new Date();
  ctx.state.currentStep = null;
  await saveCheckpoint(workflowRunId, ctx.state);

  return ctx.state;
}
