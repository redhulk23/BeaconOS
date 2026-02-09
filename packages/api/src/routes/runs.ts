import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  NotFoundError,
  ValidationError,
  type AgentId,
  type TenantId,
} from "@beacon-os/common";
import { getDb, agentDefinitions, agentRuns, agentRunSteps } from "@beacon-os/db";
import { requirePermission, Permission } from "@beacon-os/auth";
import { ProcessManager } from "@beacon-os/kernel";
import { ModelRouter } from "@beacon-os/model-router";
import { MemoryManager, ResourceManager } from "@beacon-os/kernel";

const runs = new Hono();

// Shared kernel instances (initialized lazily)
let _processManager: ProcessManager | null = null;

function getProcessManager(): ProcessManager {
  if (!_processManager) {
    const modelRouter = new ModelRouter();
    const memoryManager = new MemoryManager();
    const resourceManager = new ResourceManager();
    _processManager = new ProcessManager(modelRouter, memoryManager, resourceManager);
  }
  return _processManager;
}

const CreateRunSchema = z.object({
  input: z.record(z.unknown()).default({}),
  config: z
    .object({
      model: z.string().optional(),
      maxSteps: z.number().positive().optional(),
      maxTokensPerRun: z.number().positive().optional(),
      temperature: z.number().min(0).max(1).optional(),
      timeoutMs: z.number().positive().optional(),
    })
    .optional(),
});

// POST /api/v1/agents/:agentId/runs — Start a run
runs.post(
  "/agents/:agentId/runs",
  requirePermission(Permission.AGENTS_RUN),
  async (c) => {
    const tenantId = c.get("tenantId");
    const agentId = c.req.param("agentId");
    const user = c.get("user");
    const db = getDb();

    // Verify agent exists
    const agent = await db
      .select()
      .from(agentDefinitions)
      .where(
        and(
          eq(agentDefinitions.id, agentId),
          eq(agentDefinitions.tenantId, tenantId),
        ),
      )
      .then((rows) => rows[0]);

    if (!agent) {
      throw new NotFoundError("Agent", agentId);
    }

    const body = await c.req.json();
    const parsed = CreateRunSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("Invalid run request", {
        issues: parsed.error.issues,
      });
    }

    const manifest = agent.manifest as Record<string, unknown>;
    const spec = (manifest.spec ?? {}) as Record<string, unknown>;
    const modelConfig = (spec.model ?? {}) as Record<string, unknown>;
    const resources = (spec.resources ?? {}) as Record<string, unknown>;

    const pm = getProcessManager();
    const runId = await pm.spawn(
      agentId as AgentId,
      tenantId as TenantId,
      parsed.data.input,
      {
        model:
          parsed.data.config?.model ??
          (modelConfig.model as string) ??
          "claude-sonnet-4-5-20250929",
        systemPrompt: spec.systemPrompt as string | undefined,
        maxSteps:
          parsed.data.config?.maxSteps ??
          (resources.maxStepsPerRun as number) ??
          50,
        maxTokensPerRun:
          parsed.data.config?.maxTokensPerRun ??
          (resources.maxTokensPerRun as number) ??
          100_000,
        temperature:
          parsed.data.config?.temperature ??
          (modelConfig.temperature as number) ??
          0.7,
        timeoutMs:
          parsed.data.config?.timeoutMs ??
          (resources.timeoutMs as number) ??
          300_000,
        triggeredBy: user.id,
      },
    );

    return c.json({ data: { runId, status: "pending" } }, 201);
  },
);

// GET /api/v1/runs/:id — Get run details
runs.get("/runs/:id", requirePermission(Permission.AGENTS_READ), async (c) => {
  const tenantId = c.get("tenantId");
  const id = c.req.param("id");
  const db = getDb();

  const run = await db
    .select()
    .from(agentRuns)
    .where(and(eq(agentRuns.id, id), eq(agentRuns.tenantId, tenantId)))
    .then((rows) => rows[0]);

  if (!run) {
    throw new NotFoundError("Run", id);
  }

  return c.json({ data: run });
});

// GET /api/v1/runs/:id/steps — Get run steps
runs.get(
  "/runs/:id/steps",
  requirePermission(Permission.AGENTS_READ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const db = getDb();

    // Verify run exists
    const run = await db
      .select()
      .from(agentRuns)
      .where(and(eq(agentRuns.id, id), eq(agentRuns.tenantId, tenantId)))
      .then((rows) => rows[0]);

    if (!run) {
      throw new NotFoundError("Run", id);
    }

    const steps = await db
      .select()
      .from(agentRunSteps)
      .where(eq(agentRunSteps.runId, id))
      .orderBy(agentRunSteps.stepNumber);

    return c.json({ data: steps });
  },
);

export { runs };
