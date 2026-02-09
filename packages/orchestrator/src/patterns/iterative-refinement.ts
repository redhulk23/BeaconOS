import type { WorkflowStep } from "../workflow-parser.js";
import type { WorkflowState } from "../state-machine.js";
import { executeStep, type StepExecutionContext } from "../step-executor.js";
import { saveCheckpoint } from "../checkpoint.js";

/**
 * Iterative refinement: run a step repeatedly until a quality check passes
 * or max iterations reached.
 */
export async function runIterativeRefinement(
  generatorStep: WorkflowStep,
  evaluatorStep: WorkflowStep,
  ctx: StepExecutionContext,
  workflowRunId: string,
  config?: { maxIterations?: number; qualityThreshold?: number },
): Promise<WorkflowState> {
  const maxIterations = config?.maxIterations ?? 3;
  const threshold = config?.qualityThreshold ?? 0.8;

  ctx.state.status = "running";
  ctx.state.startedAt = new Date();

  for (let i = 0; i < maxIterations; i++) {
    ctx.state.data._iteration = i + 1;

    // Generate
    ctx.state.currentStep = generatorStep.id;
    await saveCheckpoint(workflowRunId, ctx.state);
    const genResult = await executeStep(generatorStep, ctx);
    ctx.state.stepResults[`${generatorStep.id}_iter_${i + 1}`] = {
      status: genResult.status,
      output: genResult.output,
    };

    if (genResult.status === "failed") {
      ctx.state.status = "failed";
      ctx.state.error = genResult.error;
      break;
    }

    // Evaluate
    ctx.state.currentStep = evaluatorStep.id;
    await saveCheckpoint(workflowRunId, ctx.state);
    const evalResult = await executeStep(evaluatorStep, ctx);
    ctx.state.stepResults[`${evaluatorStep.id}_iter_${i + 1}`] = {
      status: evalResult.status,
      output: evalResult.output,
    };

    // Check quality score
    const score =
      typeof evalResult.output === "object" && evalResult.output !== null
        ? ((evalResult.output as Record<string, unknown>).score as number) ?? 0
        : 0;

    ctx.state.data._qualityScore = score;

    if (score >= threshold) {
      ctx.state.status = "completed";
      break;
    }

    // Add feedback to data for next iteration
    if (typeof evalResult.output === "object" && evalResult.output !== null) {
      ctx.state.data._feedback = (evalResult.output as Record<string, unknown>).feedback;
    }
  }

  if (ctx.state.status === "running") {
    // Max iterations reached without meeting threshold
    ctx.state.status = "completed"; // Still complete, just below threshold
  }

  ctx.state.completedAt = new Date();
  ctx.state.currentStep = null;
  await saveCheckpoint(workflowRunId, ctx.state);

  return ctx.state;
}
