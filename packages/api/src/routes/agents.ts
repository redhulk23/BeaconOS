import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  generateAgentId,
  AgentManifestSchema,
  NotFoundError,
  ValidationError,
} from "@beacon-os/common";
import { getDb, agentDefinitions } from "@beacon-os/db";
import { getAuditLogger } from "@beacon-os/audit";
import { requirePermission, Permission } from "@beacon-os/auth";

const agents = new Hono();

const CreateAgentSchema = z.object({
  name: z.string().min(1).max(200),
  version: z.string().default("0.1.0"),
  description: z.string().optional(),
  manifest: AgentManifestSchema,
});

const UpdateAgentSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  manifest: AgentManifestSchema.optional(),
  status: z.enum(["registered", "active", "inactive", "archived"]).optional(),
});

// POST /api/v1/agents — Create agent
agents.post("/", requirePermission(Permission.AGENTS_CREATE), async (c) => {
  const body = await c.req.json();
  const parsed = CreateAgentSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError("Invalid agent definition", {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;
  const tenantId = c.get("tenantId");
  const user = c.get("user");
  const db = getDb();
  const id = generateAgentId();

  await db.insert(agentDefinitions).values({
    id,
    tenantId,
    name: data.name,
    version: data.version,
    description: data.description,
    manifest: data.manifest as unknown as Record<string, unknown>,
    status: "registered",
    createdBy: user.id,
  });

  // Audit log
  const audit = getAuditLogger();
  await audit.log({
    tenantId,
    action: "agent.registered",
    actorId: user.id,
    actorType: "user",
    resourceType: "agent",
    resourceId: id,
    metadata: { name: data.name, version: data.version },
  });

  const agent = await db
    .select()
    .from(agentDefinitions)
    .where(eq(agentDefinitions.id, id))
    .then((rows) => rows[0]);

  return c.json({ data: agent }, 201);
});

// GET /api/v1/agents — List agents
agents.get("/", requirePermission(Permission.AGENTS_READ), async (c) => {
  const tenantId = c.get("tenantId");
  const db = getDb();

  const page = parseInt(c.req.query("page") ?? "1");
  const pageSize = Math.min(100, parseInt(c.req.query("pageSize") ?? "20"));
  const offset = (Math.max(1, page) - 1) * pageSize;

  const results = await db
    .select()
    .from(agentDefinitions)
    .where(eq(agentDefinitions.tenantId, tenantId))
    .orderBy(desc(agentDefinitions.createdAt))
    .limit(pageSize)
    .offset(offset);

  return c.json({
    data: results,
    page,
    pageSize,
  });
});

// GET /api/v1/agents/:id — Get agent
agents.get("/:id", requirePermission(Permission.AGENTS_READ), async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const db = getDb();

  const agent = await db
    .select()
    .from(agentDefinitions)
    .where(
      and(eq(agentDefinitions.id, id), eq(agentDefinitions.tenantId, tenantId)),
    )
    .then((rows) => rows[0]);

  if (!agent) {
    throw new NotFoundError("Agent", id);
  }

  return c.json({ data: agent });
});

// PATCH /api/v1/agents/:id — Update agent
agents.patch("/:id", requirePermission(Permission.AGENTS_UPDATE), async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const body = await c.req.json();
  const parsed = UpdateAgentSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError("Invalid update", {
      issues: parsed.error.issues,
    });
  }

  const db = getDb();
  const existing = await db
    .select()
    .from(agentDefinitions)
    .where(
      and(eq(agentDefinitions.id, id), eq(agentDefinitions.tenantId, tenantId)),
    )
    .then((rows) => rows[0]);

  if (!existing) {
    throw new NotFoundError("Agent", id);
  }

  const updates: Record<string, unknown> = { updatedAt: new Date() };
  if (parsed.data.name) updates.name = parsed.data.name;
  if (parsed.data.description !== undefined)
    updates.description = parsed.data.description;
  if (parsed.data.manifest) updates.manifest = parsed.data.manifest;
  if (parsed.data.status) updates.status = parsed.data.status;

  await db
    .update(agentDefinitions)
    .set(updates)
    .where(eq(agentDefinitions.id, id));

  const audit = getAuditLogger();
  await audit.log({
    tenantId,
    action: "agent.updated",
    actorId: c.get("user").id,
    actorType: "user",
    resourceType: "agent",
    resourceId: id,
    metadata: { fields: Object.keys(parsed.data) },
  });

  const updated = await db
    .select()
    .from(agentDefinitions)
    .where(eq(agentDefinitions.id, id))
    .then((rows) => rows[0]);

  return c.json({ data: updated });
});

// DELETE /api/v1/agents/:id — Delete (archive) agent
agents.delete(
  "/:id",
  requirePermission(Permission.AGENTS_DELETE),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const db = getDb();

    const existing = await db
      .select()
      .from(agentDefinitions)
      .where(
        and(
          eq(agentDefinitions.id, id),
          eq(agentDefinitions.tenantId, tenantId),
        ),
      )
      .then((rows) => rows[0]);

    if (!existing) {
      throw new NotFoundError("Agent", id);
    }

    await db
      .update(agentDefinitions)
      .set({ status: "archived", updatedAt: new Date() })
      .where(eq(agentDefinitions.id, id));

    const audit = getAuditLogger();
    await audit.log({
      tenantId,
      action: "agent.deleted",
      actorId: c.get("user").id,
      actorType: "user",
      resourceType: "agent",
      resourceId: id,
    });

    return c.json({ data: { id, status: "archived" } });
  },
);

export { agents };
