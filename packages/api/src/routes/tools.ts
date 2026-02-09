import { Hono } from "hono";
import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import { ValidationError, generateToolId } from "@beacon-os/common";
import { getDb, toolRegistrations } from "@beacon-os/db";
import { getAuditLogger } from "@beacon-os/audit";
import { requirePermission, Permission } from "@beacon-os/auth";

const tools = new Hono();

const RegisterToolSchema = z.object({
  name: z.string().min(1),
  version: z.string().default("0.1.0"),
  description: z.string(),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional(),
  permissions: z.array(z.string()).default([]),
  timeoutMs: z.number().positive().default(30_000),
});

// POST /api/v1/tools — Register a tool
tools.post("/", requirePermission(Permission.TOOLS_REGISTER), async (c) => {
  const tenantId = c.get("tenantId");
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = RegisterToolSchema.safeParse(body);

  if (!parsed.success) {
    throw new ValidationError("Invalid tool registration", {
      issues: parsed.error.issues,
    });
  }

  const db = getDb();
  const id = generateToolId();
  const data = parsed.data;

  await db.insert(toolRegistrations).values({
    id,
    tenantId,
    name: data.name,
    version: data.version,
    description: data.description,
    inputSchema: data.inputSchema,
    outputSchema: data.outputSchema,
    permissions: data.permissions,
    timeoutMs: data.timeoutMs,
  });

  const audit = getAuditLogger();
  await audit.log({
    tenantId,
    action: "tool.invoked",
    actorId: user.id,
    actorType: "user",
    resourceType: "tool",
    resourceId: id,
    metadata: { name: data.name, action: "registered" },
  });

  const tool = await db
    .select()
    .from(toolRegistrations)
    .where(eq(toolRegistrations.id, id))
    .then((rows) => rows[0]);

  return c.json({ data: tool }, 201);
});

// GET /api/v1/tools — List registered tools
tools.get("/", requirePermission(Permission.TOOLS_READ), async (c) => {
  const tenantId = c.get("tenantId");
  const db = getDb();

  const results = await db
    .select()
    .from(toolRegistrations)
    .where(eq(toolRegistrations.tenantId, tenantId))
    .orderBy(desc(toolRegistrations.createdAt));

  return c.json({ data: results });
});

export { tools };
