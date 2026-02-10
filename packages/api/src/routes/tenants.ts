import { Hono } from "hono";
import { z } from "zod";
import { eq, and } from "drizzle-orm";
import { NotFoundError, ValidationError, generateId } from "@beacon-os/common";
import { getDb, tenants, tenantSettings } from "@beacon-os/db";
import { getAuditLogger } from "@beacon-os/audit";
import { requirePermission, Permission } from "@beacon-os/auth";

const tenantsRouter = new Hono();

const UpdateTenantSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  settings: z.record(z.unknown()).optional(),
});

const SetSettingSchema = z.object({
  value: z.unknown(),
  category: z.string().max(50).optional(),
});

// GET /api/v1/tenants/current — Get current tenant
tenantsRouter.get(
  "/current",
  requirePermission(Permission.TENANTS_READ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const db = getDb();

    const tenant = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .then((rows) => rows[0]);

    if (!tenant) {
      throw new NotFoundError("Tenant", tenantId);
    }

    return c.json({ data: tenant });
  },
);

// PATCH /api/v1/tenants/current — Update current tenant
tenantsRouter.patch(
  "/current",
  requirePermission(Permission.TENANTS_MANAGE),
  async (c) => {
    const tenantId = c.get("tenantId");
    const body = await c.req.json();
    const parsed = UpdateTenantSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("Invalid update", {
        issues: parsed.error.issues,
      });
    }

    const db = getDb();
    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (parsed.data.name !== undefined) updates.name = parsed.data.name;
    if (parsed.data.settings !== undefined)
      updates.settings = parsed.data.settings;

    await db.update(tenants).set(updates).where(eq(tenants.id, tenantId));

    const audit = getAuditLogger();
    await audit.log({
      tenantId,
      action: "tenant.updated",
      actorId: c.get("user").id,
      actorType: "user",
      resourceType: "tenant",
      resourceId: tenantId,
      metadata: { fields: Object.keys(parsed.data) },
    });

    const updated = await db
      .select()
      .from(tenants)
      .where(eq(tenants.id, tenantId))
      .then((rows) => rows[0]);

    return c.json({ data: updated });
  },
);

// GET /api/v1/tenants/current/settings — Get all settings
tenantsRouter.get(
  "/current/settings",
  requirePermission(Permission.TENANTS_READ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const db = getDb();

    const category = c.req.query("category");

    const conditions = [eq(tenantSettings.tenantId, tenantId)];
    if (category) {
      conditions.push(eq(tenantSettings.category, category));
    }

    const settings = await db
      .select()
      .from(tenantSettings)
      .where(and(...conditions));

    return c.json({ data: settings });
  },
);

// PUT /api/v1/tenants/current/settings/:key — Set a setting
tenantsRouter.put(
  "/current/settings/:key",
  requirePermission(Permission.TENANTS_MANAGE),
  async (c) => {
    const tenantId = c.get("tenantId");
    const key = c.req.param("key");
    const body = await c.req.json();
    const parsed = SetSettingSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("Invalid setting", {
        issues: parsed.error.issues,
      });
    }

    const db = getDb();

    // Upsert: check if key exists
    const existing = await db
      .select()
      .from(tenantSettings)
      .where(
        and(eq(tenantSettings.tenantId, tenantId), eq(tenantSettings.key, key)),
      )
      .then((rows) => rows[0]);

    if (existing) {
      await db
        .update(tenantSettings)
        .set({
          value: parsed.data.value as Record<string, unknown>,
          category: parsed.data.category ?? existing.category,
          updatedAt: new Date(),
        })
        .where(eq(tenantSettings.id, existing.id));
    } else {
      await db.insert(tenantSettings).values({
        id: generateId(),
        tenantId,
        key,
        value: parsed.data.value as Record<string, unknown>,
        category: parsed.data.category,
      });
    }

    const audit = getAuditLogger();
    await audit.log({
      tenantId,
      action: "tenant.setting.updated",
      actorId: c.get("user").id,
      actorType: "user",
      resourceType: "tenant_setting",
      resourceId: key,
      metadata: { key, category: parsed.data.category },
    });

    const setting = await db
      .select()
      .from(tenantSettings)
      .where(
        and(eq(tenantSettings.tenantId, tenantId), eq(tenantSettings.key, key)),
      )
      .then((rows) => rows[0]);

    return c.json({ data: setting });
  },
);

export { tenantsRouter };
