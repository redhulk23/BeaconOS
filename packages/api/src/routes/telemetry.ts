import { Hono } from "hono";
import { eq, and, desc, gte, lte } from "drizzle-orm";
import { getDb, telemetrySpans } from "@beacon-os/db";
import { requirePermission, Permission } from "@beacon-os/auth";

const telemetry = new Hono();

// GET /api/v1/telemetry/traces — List traces
telemetry.get(
  "/traces",
  requirePermission(Permission.TELEMETRY_READ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const db = getDb();

    const page = parseInt(c.req.query("page") ?? "1");
    const pageSize = Math.min(100, parseInt(c.req.query("pageSize") ?? "20"));
    const offset = (Math.max(1, page) - 1) * pageSize;

    const agentId = c.req.query("agentId");
    const startAfter = c.req.query("startAfter");
    const startBefore = c.req.query("startBefore");

    const conditions = [eq(telemetrySpans.tenantId, tenantId)];
    if (agentId) conditions.push(eq(telemetrySpans.agentId, agentId));
    if (startAfter)
      conditions.push(gte(telemetrySpans.startTime, new Date(startAfter)));
    if (startBefore)
      conditions.push(lte(telemetrySpans.startTime, new Date(startBefore)));

    const results = await db
      .selectDistinctOn([telemetrySpans.traceId], {
        traceId: telemetrySpans.traceId,
        operationName: telemetrySpans.operationName,
        serviceName: telemetrySpans.serviceName,
        startTime: telemetrySpans.startTime,
        durationMs: telemetrySpans.durationMs,
        status: telemetrySpans.status,
        agentId: telemetrySpans.agentId,
        runId: telemetrySpans.runId,
      })
      .from(telemetrySpans)
      .where(and(...conditions))
      .orderBy(telemetrySpans.traceId, desc(telemetrySpans.startTime))
      .limit(pageSize)
      .offset(offset);

    return c.json({ data: results, page, pageSize });
  },
);

// GET /api/v1/telemetry/traces/:traceId — Get all spans for a trace
telemetry.get(
  "/traces/:traceId",
  requirePermission(Permission.TELEMETRY_READ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const traceId = c.req.param("traceId");
    const db = getDb();

    const spans = await db
      .select()
      .from(telemetrySpans)
      .where(
        and(
          eq(telemetrySpans.tenantId, tenantId),
          eq(telemetrySpans.traceId, traceId),
        ),
      )
      .orderBy(telemetrySpans.startTime);

    return c.json({ data: spans, traceId });
  },
);

// GET /api/v1/telemetry/spans — Query spans
telemetry.get(
  "/spans",
  requirePermission(Permission.TELEMETRY_READ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const db = getDb();

    const page = parseInt(c.req.query("page") ?? "1");
    const pageSize = Math.min(100, parseInt(c.req.query("pageSize") ?? "20"));
    const offset = (Math.max(1, page) - 1) * pageSize;

    const agentId = c.req.query("agentId");
    const runId = c.req.query("runId");
    const operationName = c.req.query("operationName");
    const startAfter = c.req.query("startAfter");
    const startBefore = c.req.query("startBefore");

    const conditions = [eq(telemetrySpans.tenantId, tenantId)];
    if (agentId) conditions.push(eq(telemetrySpans.agentId, agentId));
    if (runId) conditions.push(eq(telemetrySpans.runId, runId));
    if (operationName)
      conditions.push(eq(telemetrySpans.operationName, operationName));
    if (startAfter)
      conditions.push(gte(telemetrySpans.startTime, new Date(startAfter)));
    if (startBefore)
      conditions.push(lte(telemetrySpans.startTime, new Date(startBefore)));

    const results = await db
      .select()
      .from(telemetrySpans)
      .where(and(...conditions))
      .orderBy(desc(telemetrySpans.startTime))
      .limit(pageSize)
      .offset(offset);

    return c.json({ data: results, page, pageSize });
  },
);

export { telemetry };
