import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@beacon-os/common";
import { getDb, approvalRequests } from "@beacon-os/db";
import { getAuditLogger } from "@beacon-os/audit";
import { requirePermission, Permission } from "@beacon-os/auth";

const approvals = new Hono();

const SubmitDecisionSchema = z.object({
  approved: z.boolean(),
  note: z.string().optional(),
});

// GET /api/v1/approval-requests — List pending approvals
approvals.get("/", requirePermission(Permission.APPROVALS_READ), async (c) => {
  const tenantId = c.get("tenantId");
  const db = getDb();
  const status = c.req.query("status") ?? "pending";

  const page = parseInt(c.req.query("page") ?? "1");
  const pageSize = Math.min(100, parseInt(c.req.query("pageSize") ?? "20"));
  const offset = (Math.max(1, page) - 1) * pageSize;

  const results = await db
    .select()
    .from(approvalRequests)
    .where(
      and(
        eq(approvalRequests.tenantId, tenantId),
        eq(approvalRequests.status, status),
      ),
    )
    .orderBy(desc(approvalRequests.createdAt))
    .limit(pageSize)
    .offset(offset);

  return c.json({ data: results, page, pageSize });
});

// GET /api/v1/approval-requests/:id — Get approval request details
approvals.get(
  "/:id",
  requirePermission(Permission.APPROVALS_READ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const db = getDb();

    const request = await db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.id, id),
          eq(approvalRequests.tenantId, tenantId),
        ),
      )
      .then((rows) => rows[0]);

    if (!request) {
      throw new NotFoundError("ApprovalRequest", id);
    }

    return c.json({ data: request });
  },
);

// POST /api/v1/approval-requests/:id/decide — Submit approval decision
approvals.post(
  "/:id/decide",
  requirePermission(Permission.APPROVALS_DECIDE),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const user = c.get("user");
    const body = await c.req.json();
    const parsed = SubmitDecisionSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("Invalid decision", {
        issues: parsed.error.issues,
      });
    }

    const db = getDb();

    // Verify exists and is pending
    const request = await db
      .select()
      .from(approvalRequests)
      .where(
        and(
          eq(approvalRequests.id, id),
          eq(approvalRequests.tenantId, tenantId),
        ),
      )
      .then((rows) => rows[0]);

    if (!request) {
      throw new NotFoundError("ApprovalRequest", id);
    }

    if (request.status !== "pending") {
      throw new ValidationError(`Approval request already ${request.status}`);
    }

    const decision = parsed.data.approved ? "approved" : "denied";

    await db
      .update(approvalRequests)
      .set({
        status: decision,
        decision,
        decisionNote: parsed.data.note,
        decidedBy: user.id,
        decidedAt: new Date(),
      })
      .where(eq(approvalRequests.id, id));

    const audit = getAuditLogger();
    await audit.log({
      tenantId,
      action: "approval.decided",
      actorId: user.id,
      actorType: "user",
      resourceType: "approval_request",
      resourceId: id,
      metadata: {
        decision,
        workflowRunId: request.workflowRunId,
        runId: request.runId,
      },
    });

    const updated = await db
      .select()
      .from(approvalRequests)
      .where(eq(approvalRequests.id, id))
      .then((rows) => rows[0]);

    return c.json({ data: updated });
  },
);

export { approvals };
