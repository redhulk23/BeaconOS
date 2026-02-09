import { createLogger } from "@beacon-os/common";
import { getDb, workflowRuns } from "@beacon-os/db";
import { eq } from "drizzle-orm";
import type { WorkflowState } from "./state-machine.js";

const log = createLogger("orchestrator:checkpoint");

export async function saveCheckpoint(
  workflowRunId: string,
  state: WorkflowState,
): Promise<void> {
  const db = getDb();
  await db
    .update(workflowRuns)
    .set({
      state: state.data,
      status: state.status,
      currentStep: state.currentStep,
    })
    .where(eq(workflowRuns.id, workflowRunId));

  log.debug(
    { workflowRunId, step: state.currentStep, status: state.status },
    "Checkpoint saved",
  );
}

export async function loadCheckpoint(
  workflowRunId: string,
): Promise<WorkflowState | null> {
  const db = getDb();
  const run = await db
    .select()
    .from(workflowRuns)
    .where(eq(workflowRuns.id, workflowRunId))
    .then((rows) => rows[0]);

  if (!run) return null;

  return {
    status: run.status as WorkflowState["status"],
    currentStep: run.currentStep ?? null,
    data: (run.state ?? {}) as Record<string, unknown>,
    stepResults: {},
    startedAt: run.startedAt ?? undefined,
    completedAt: run.completedAt ?? undefined,
  };
}
