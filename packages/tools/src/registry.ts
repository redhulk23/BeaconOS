import { createLogger, generateToolId, type ToolId, type TenantId } from "@beacon-os/common";
import { getDb, toolRegistrations } from "@beacon-os/db";
import { eq, and } from "drizzle-orm";
import { z, type ZodSchema } from "zod";

const log = createLogger("tools:registry");

export interface RegisteredTool {
  id: string;
  tenantId: string;
  name: string;
  version: string;
  description: string;
  inputSchema: ZodSchema;
  outputSchema?: ZodSchema;
  permissions: string[];
  timeoutMs: number;
  execute: (input: unknown) => Promise<unknown>;
}

export interface ToolRegistrationInput {
  tenantId: string;
  name: string;
  version?: string;
  description: string;
  inputSchema: ZodSchema;
  outputSchema?: ZodSchema;
  permissions?: string[];
  timeoutMs?: number;
  execute: (input: unknown) => Promise<unknown>;
}

export class ToolRegistry {
  private tools: Map<string, RegisteredTool> = new Map();

  register(input: ToolRegistrationInput): RegisteredTool {
    const id = generateToolId();
    const tool: RegisteredTool = {
      id,
      tenantId: input.tenantId,
      name: input.name,
      version: input.version ?? "0.1.0",
      description: input.description,
      inputSchema: input.inputSchema,
      outputSchema: input.outputSchema,
      permissions: input.permissions ?? [],
      timeoutMs: input.timeoutMs ?? 30_000,
      execute: input.execute,
    };

    const key = `${input.tenantId}:${input.name}`;
    this.tools.set(key, tool);

    log.info({ name: input.name, id }, "Tool registered");
    return tool;
  }

  get(tenantId: string, name: string): RegisteredTool | undefined {
    return this.tools.get(`${tenantId}:${name}`);
  }

  list(tenantId: string): RegisteredTool[] {
    return Array.from(this.tools.values()).filter(
      (t) => t.tenantId === tenantId,
    );
  }

  unregister(tenantId: string, name: string): boolean {
    return this.tools.delete(`${tenantId}:${name}`);
  }

  has(tenantId: string, name: string): boolean {
    return this.tools.has(`${tenantId}:${name}`);
  }

  async persistRegistration(tool: RegisteredTool): Promise<void> {
    const db = getDb();
    await db.insert(toolRegistrations).values({
      id: tool.id,
      tenantId: tool.tenantId,
      name: tool.name,
      version: tool.version,
      description: tool.description,
      inputSchema: zodSchemaToJson(tool.inputSchema),
      outputSchema: tool.outputSchema
        ? zodSchemaToJson(tool.outputSchema)
        : undefined,
      permissions: tool.permissions,
      timeoutMs: tool.timeoutMs,
    });
  }

  async loadFromDb(tenantId: string): Promise<number> {
    const db = getDb();
    const rows = await db
      .select()
      .from(toolRegistrations)
      .where(eq(toolRegistrations.tenantId, tenantId));

    // DB-loaded tools get a no-op executor (must be bound at runtime)
    for (const row of rows) {
      const key = `${tenantId}:${row.name}`;
      if (!this.tools.has(key)) {
        this.tools.set(key, {
          id: row.id,
          tenantId: row.tenantId,
          name: row.name,
          version: row.version,
          description: row.description ?? "",
          inputSchema: z.record(z.unknown()),
          permissions: (row.permissions ?? []) as string[],
          timeoutMs: row.timeoutMs ?? 30_000,
          execute: async () => {
            throw new Error(`Tool "${row.name}" loaded from DB but has no bound executor`);
          },
        });
      }
    }

    return rows.length;
  }
}

function zodSchemaToJson(schema: ZodSchema): Record<string, unknown> {
  // Simple JSON representation for storage
  if ("shape" in schema && typeof schema.shape === "object") {
    const shape = schema.shape as Record<string, unknown>;
    const properties: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(shape)) {
      properties[key] = { type: "unknown" };
    }
    return { type: "object", properties };
  }
  return { type: "unknown" };
}

// Singleton
let _registry: ToolRegistry | null = null;

export function getToolRegistry(): ToolRegistry {
  if (!_registry) {
    _registry = new ToolRegistry();
  }
  return _registry;
}
