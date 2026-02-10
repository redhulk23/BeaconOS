import { Hono } from "hono";
import { z } from "zod";
import { eq, and, desc } from "drizzle-orm";
import {
  generateWorkflowId,
  NotFoundError,
  ValidationError,
} from "@beacon-os/common";
import { getDb, workflowDefinitions, workflowRuns } from "@beacon-os/db";
import { getAuditLogger } from "@beacon-os/audit";
import { requirePermission, Permission } from "@beacon-os/auth";
import {
  OrchestrationEngine,
  type OrchestrationDeps,
} from "@beacon-os/orchestrator";
import {
  ProcessManager,
  MemoryManager,
  ResourceManager,
} from "@beacon-os/kernel";
import { ModelRouter } from "@beacon-os/model-router";

const workflows = new Hono();

// Shared orchestration engine (initialized lazily)
let _engine: OrchestrationEngine | null = null;

function getEngine(): OrchestrationEngine {
  if (!_engine) {
    const modelRouter = new ModelRouter();
    const memoryManager = new MemoryManager();
    const resourceManager = new ResourceManager();
    const pm = new ProcessManager(modelRouter, memoryManager, resourceManager);

    const deps: OrchestrationDeps = {
      executeAgent: async (agentId, input) => {
        // Delegates to process manager for agent execution
        const runId = await pm.spawn(
          agentId as never,
          "system" as never,
          input,
          {
            model: "claude-sonnet-4-5-20250929",
            maxSteps: 50,
            maxTokensPerRun: 100_000,
            temperature: 0.7,
            timeoutMs: 300_000,
          },
        );
        return { runId };
      },
      executeTool: async (toolName, input) => {
        return { tool: toolName, input, result: "tool_execution_placeholder" };
      },
      requestApproval: async (request) => {
        // Returns pending — the HITL approval gate handles polling
        return { approved: false, note: "Approval pending" };
      },
    };

    _engine = new OrchestrationEngine(deps);
  }
  return _engine;
}

const CreateWorkflowSchema = z.object({
  name: z.string().min(1).max(200),
  version: z.string().default("0.1.0"),
  description: z.string().optional(),
  definition: z.record(z.unknown()),
});

const StartWorkflowRunSchema = z.object({
  input: z.record(z.unknown()).default({}),
});

// POST /api/v1/workflows — Create workflow definition
workflows.post(
  "/",
  requirePermission(Permission.WORKFLOWS_CREATE),
  async (c) => {
    const tenantId = c.get("tenantId");
    const user = c.get("user");
    const body = await c.req.json();
    const parsed = CreateWorkflowSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("Invalid workflow definition", {
        issues: parsed.error.issues,
      });
    }

    const db = getDb();
    const id = generateWorkflowId();
    const data = parsed.data;

    await db.insert(workflowDefinitions).values({
      id,
      tenantId,
      name: data.name,
      version: data.version,
      description: data.description,
      definition: data.definition,
      status: "active",
      createdBy: user.id,
    });

    const audit = getAuditLogger();
    await audit.log({
      tenantId,
      action: "agent.registered",
      actorId: user.id,
      actorType: "user",
      resourceType: "workflow",
      resourceId: id,
      metadata: { name: data.name, version: data.version },
    });

    const workflow = await db
      .select()
      .from(workflowDefinitions)
      .where(eq(workflowDefinitions.id, id))
      .then((rows) => rows[0]);

    return c.json({ data: workflow }, 201);
  },
);

// GET /api/v1/workflows — List workflow definitions
workflows.get("/", requirePermission(Permission.WORKFLOWS_READ), async (c) => {
  const tenantId = c.get("tenantId");
  const db = getDb();

  const page = parseInt(c.req.query("page") ?? "1");
  const pageSize = Math.min(100, parseInt(c.req.query("pageSize") ?? "20"));
  const offset = (Math.max(1, page) - 1) * pageSize;

  const results = await db
    .select()
    .from(workflowDefinitions)
    .where(eq(workflowDefinitions.tenantId, tenantId))
    .orderBy(desc(workflowDefinitions.createdAt))
    .limit(pageSize)
    .offset(offset);

  return c.json({ data: results, page, pageSize });
});

// GET /api/v1/workflows/:id — Get workflow definition
workflows.get(
  "/:id",
  requirePermission(Permission.WORKFLOWS_READ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const db = getDb();

    const workflow = await db
      .select()
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.id, id),
          eq(workflowDefinitions.tenantId, tenantId),
        ),
      )
      .then((rows) => rows[0]);

    if (!workflow) {
      throw new NotFoundError("Workflow", id);
    }

    return c.json({ data: workflow });
  },
);

// POST /api/v1/workflows/:id/runs — Start a workflow run
workflows.post(
  "/:id/runs",
  requirePermission(Permission.WORKFLOWS_RUN),
  async (c) => {
    const tenantId = c.get("tenantId");
    const workflowId = c.req.param("id");
    const user = c.get("user");

    const body = await c.req.json();
    const parsed = StartWorkflowRunSchema.safeParse(body);

    if (!parsed.success) {
      throw new ValidationError("Invalid workflow run request", {
        issues: parsed.error.issues,
      });
    }

    const engine = getEngine();
    const runId = await engine.startWorkflow(
      workflowId,
      tenantId,
      parsed.data.input,
      user.id,
    );

    return c.json({ data: { runId, status: "pending" } }, 201);
  },
);

// GET /api/v1/workflows/:id/runs — List workflow runs
workflows.get(
  "/:id/runs",
  requirePermission(Permission.WORKFLOWS_READ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const workflowId = c.req.param("id");
    const db = getDb();

    const page = parseInt(c.req.query("page") ?? "1");
    const pageSize = Math.min(100, parseInt(c.req.query("pageSize") ?? "20"));
    const offset = (Math.max(1, page) - 1) * pageSize;

    const results = await db
      .select()
      .from(workflowRuns)
      .where(
        and(
          eq(workflowRuns.workflowId, workflowId),
          eq(workflowRuns.tenantId, tenantId),
        ),
      )
      .orderBy(desc(workflowRuns.createdAt))
      .limit(pageSize)
      .offset(offset);

    return c.json({ data: results, page, pageSize });
  },
);

// GET /api/v1/workflow-runs/:id — Get workflow run details
workflows.get(
  "-runs/:id",
  requirePermission(Permission.WORKFLOWS_READ),
  async (c) => {
    const tenantId = c.get("tenantId");
    const id = c.req.param("id");
    const db = getDb();

    const run = await db
      .select()
      .from(workflowRuns)
      .where(and(eq(workflowRuns.id, id), eq(workflowRuns.tenantId, tenantId)))
      .then((rows) => rows[0]);

    if (!run) {
      throw new NotFoundError("WorkflowRun", id);
    }

    return c.json({ data: run });
  },
);

export { workflows };
