import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import {
  NotFoundError,
  ValidationError,
  generatePolicyId,
} from "@beacon-os/common";
import { getDb, abacPolicies } from "@beacon-os/db";
import { getAuditLogger } from "@beacon-os/audit";
import { requirePermission, Permission } from "@beacon-os/auth";

const policies = new Hono();

const AttributeMatcherSchema = z.object({
  field: z.string(),
  operator: z.enum(["eq", "in", "not_in", "gt", "lt", "contains"]),
  value: z.unknown(),
});

const PolicyConditionSchema = z.object({
  type: z.enum(["time_range", "ip_range", "environment", "custom"]),
  parameters: z.record(z.unknown()),
});

const CreatePolicySchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().optional(),
  effect: z.enum(["allow", "deny"]),
  subjectAttributes: z.array(AttributeMatcherSchema).default([]),
  resourceAttributes: z.array(AttributeMatcherSchema).default([]),
  actionAttributes: z.array(AttributeMatcherSchema).default([]),
  conditions: z.array(PolicyConditionSchema).default([]),
  priority: z.number().int().min(0).default(0),
});

const UpdatePolicySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  effect: z.enum(["allow", "deny"]).optional(),
  subjectAttributes: z.array(AttributeMatcherSchema).optional(),
  resourceAttributes: z.array(AttributeMatcherSchema).optional(),
  actionAttributes: z.array(AttributeMatcherSchema).optional(),
  conditions: z.array(PolicyConditionSchema).optional(),
  priority: z.number().int().min(0).optional(),
  status: z.enum(["active", "inactive"]).optional(),
});

// POST /api/v1/policies — Create policy
policies.post("/", requirePermission(Permission.POLICIES_MANAGE), async (c) => {
  const body = await c.req.json();
  const parsed = CreatePolicySchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError("Invalid policy definition", {
      issues: parsed.error.issues,
    });
  }

  const data = parsed.data;
  const tenantId = c.get("tenantId");
  const user = c.get("user");
  const db = getDb();
  const id = generatePolicyId();

  await db.insert(abacPolicies).values({
    id,
    tenantId,
    name: data.name,
    description: data.description,
    effect: data.effect,
    subjectAttributes: data.subjectAttributes as unknown as Record<
      string,
      unknown
    >,
    resourceAttributes: data.resourceAttributes as unknown as Record<
      string,
      unknown
    >,
    actionAttributes: data.actionAttributes as unknown as Record<
      string,
      unknown
    >,
    conditions: data.conditions as unknown as Record<string, unknown>[],
    priority: data.priority,
    status: "active",
    createdBy: user.id,
  });

  const audit = getAuditLogger();
  await audit.log({
    tenantId,
    action: "policy.created",
    actorId: user.id,
    actorType: "user",
    resourceType: "policy",
    resourceId: id,
    metadata: { name: data.name, effect: data.effect },
  });

  const policy = await db
    .select()
    .from(abacPolicies)
    .where(eq(abacPolicies.id, id))
    .then((rows) => rows[0]);

  return c.json({ data: policy }, 201);
});

// GET /api/v1/policies — List tenant policies
policies.get("/", requirePermission(Permission.POLICIES_READ), async (c) => {
  const tenantId = c.get("tenantId");
  const db = getDb();

  const results = await db
    .select()
    .from(abacPolicies)
    .where(eq(abacPolicies.tenantId, tenantId));

  return c.json({ data: results });
});

// GET /api/v1/policies/:id — Get policy
policies.get("/:id", requirePermission(Permission.POLICIES_READ), async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const db = getDb();

  const policy = await db
    .select()
    .from(abacPolicies)
    .where(and(eq(abacPolicies.id, id), eq(abacPolicies.tenantId, tenantId)))
    .then((rows) => rows[0]);

  if (!policy) {
    throw new NotFoundError("Policy", id);
  }

  return c.json({ data: policy });
});

// PATCH /api/v1/policies/:id — Update policy
policies.patch(
  "/:id",
  requirePermission(Permission.POLICIES_MANAGE),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const body = await c.req.json();
    const parsed = UpdatePolicySchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("Invalid update", {
        issues: parsed.error.issues,
      });
    }

    const db = getDb();
    const existing = await db
      .select()
      .from(abacPolicies)
      .where(and(eq(abacPolicies.id, id), eq(abacPolicies.tenantId, tenantId)))
      .then((rows) => rows[0]);

    if (!existing) {
      throw new NotFoundError("Policy", id);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.description !== undefined)
      updates.description = parsed.data.description;
    if (parsed.data.effect !== undefined) updates.effect = parsed.data.effect;
    if (parsed.data.subjectAttributes !== undefined)
      updates.subjectAttributes = parsed.data.subjectAttributes;
    if (parsed.data.resourceAttributes !== undefined)
      updates.resourceAttributes = parsed.data.resourceAttributes;
    if (parsed.data.actionAttributes !== undefined)
      updates.actionAttributes = parsed.data.actionAttributes;
    if (parsed.data.conditions !== undefined)
      updates.conditions = parsed.data.conditions;
    if (parsed.data.priority !== undefined)
      updates.priority = parsed.data.priority;
    if (parsed.data.status !== undefined) updates.status = parsed.data.status;

    await db.update(abacPolicies).set(updates).where(eq(abacPolicies.id, id));

    const audit = getAuditLogger();
    await audit.log({
      tenantId,
      action: "policy.updated",
      actorId: c.get("user").id,
      actorType: "user",
      resourceType: "policy",
      resourceId: id,
      metadata: { fields: Object.keys(parsed.data) },
    });

    const updated = await db
      .select()
      .from(abacPolicies)
      .where(eq(abacPolicies.id, id))
      .then((rows) => rows[0]);

    return c.json({ data: updated });
  },
);

// DELETE /api/v1/policies/:id — Delete (deactivate) policy
policies.delete(
  "/:id",
  requirePermission(Permission.POLICIES_MANAGE),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const db = getDb();

    const existing = await db
      .select()
      .from(abacPolicies)
      .where(and(eq(abacPolicies.id, id), eq(abacPolicies.tenantId, tenantId)))
      .then((rows) => rows[0]);

    if (!existing) {
      throw new NotFoundError("Policy", id);
    }

    await db
      .update(abacPolicies)
      .set({ status: "inactive" as const, updatedAt: new Date() })
      .where(eq(abacPolicies.id, id));

    const audit = getAuditLogger();
    await audit.log({
      tenantId,
      action: "policy.deleted",
      actorId: c.get("user").id,
      actorType: "user",
      resourceType: "policy",
      resourceId: id,
    });

    return c.json({ data: { id, status: "inactive" } });
  },
);

export { policies };
