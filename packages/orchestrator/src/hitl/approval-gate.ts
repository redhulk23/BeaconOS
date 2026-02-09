import { createLogger, generateId } from "@beacon-os/common";
import { getDb, approvalRequests } from "@beacon-os/db";
import { eq, and } from "drizzle-orm";

const log = createLogger("orchestrator:approval-gate");

export interface ApprovalRequest {
  tenantId: string;
  workflowRunId: string;
  runId?: string;
  type: string;
  title: string;
  description?: string;
  context?: Record<string, unknown>;
  expiresAt?: Date;
}

export interface ApprovalDecision {
  approved: boolean;
  note?: string;
  decidedBy: string;
}

export async function createApprovalRequest(
  request: ApprovalRequest,
): Promise<string> {
  const db = getDb();
  const id = generateId();

  await db.insert(approvalRequests).values({
    id,
    tenantId: request.tenantId,
    workflowRunId: request.workflowRunId,
    runId: request.runId,
    type: request.type,
    title: request.title,
    description: request.description,
    context: request.context,
    status: "pending",
    expiresAt: request.expiresAt,
  });

  log.info({ id, title: request.title }, "Approval request created");
  return id;
}

export async function getApprovalStatus(
  id: string,
): Promise<{ status: string; decision?: string; note?: string } | null> {
  const db = getDb();
  const result = await db
    .select()
    .from(approvalRequests)
    .where(eq(approvalRequests.id, id))
    .then((rows) => rows[0]);

  if (!result) return null;

  return {
    status: result.status,
    decision: result.decision ?? undefined,
    note: result.decisionNote ?? undefined,
  };
}

export async function submitDecision(
  id: string,
  decision: ApprovalDecision,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .update(approvalRequests)
    .set({
      status: decision.approved ? "approved" : "denied",
      decision: decision.approved ? "approved" : "denied",
      decisionNote: decision.note,
      decidedBy: decision.decidedBy,
      decidedAt: new Date(),
    })
    .where(and(eq(approvalRequests.id, id), eq(approvalRequests.status, "pending")));

  const updated = (result.rowCount ?? 0) > 0;
  if (updated) {
    log.info({ id, approved: decision.approved }, "Approval decision submitted");
  }
  return updated;
}

export async function waitForApproval(
  id: string,
  pollIntervalMs = 1000,
  timeoutMs = 300_000,
): Promise<ApprovalDecision> {
  const startMs = Date.now();

  while (Date.now() - startMs < timeoutMs) {
    const status = await getApprovalStatus(id);
    if (!status) throw new Error(`Approval request ${id} not found`);

    if (status.status === "approved") {
      return { approved: true, note: status.note, decidedBy: "" };
    }
    if (status.status === "denied") {
      return { approved: false, note: status.note, decidedBy: "" };
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  throw new Error(`Approval request ${id} timed out after ${timeoutMs}ms`);
}
