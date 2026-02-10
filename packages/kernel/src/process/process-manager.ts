import {
  createLogger,
  generateRunId,
  type RunId,
  type AgentId,
  type TenantId,
  type RunStatus,
  type ModelToolDefinition,
  nowMs,
  elapsed,
} from "@beacon-os/common";
import { getDb, agentRuns, agentRunSteps } from "@beacon-os/db";
import { eq } from "drizzle-orm";
import { getAuditLogger } from "@beacon-os/audit";
import { ModelRouter } from "@beacon-os/model-router";
import {
  AgentProcess,
  type AgentProcessConfig,
  type StepRecord,
} from "./agent-process.js";
import { AgentScheduler, type ScheduledRun } from "../scheduler/scheduler.js";
import { MemoryManager } from "../memory/memory-manager.js";
import { ResourceManager } from "../resource/resource-manager.js";

const log = createLogger("kernel:process-manager");

export class ProcessManager {
  private processes: Map<string, AgentProcess> = new Map();
  private scheduler: AgentScheduler;
  private modelRouter: ModelRouter;
  private memoryManager: MemoryManager;
  private resourceManager: ResourceManager;

  constructor(
    modelRouter: ModelRouter,
    memoryManager: MemoryManager,
    resourceManager: ResourceManager,
    scheduler?: AgentScheduler,
  ) {
    this.modelRouter = modelRouter;
    this.memoryManager = memoryManager;
    this.resourceManager = resourceManager;
    this.scheduler = scheduler ?? new AgentScheduler();
  }

  async spawn(
    agentId: AgentId,
    tenantId: TenantId,
    input: Record<string, unknown>,
    config: {
      model?: string;
      systemPrompt?: string;
      tools?: ModelToolDefinition[];
      maxSteps?: number;
      maxTokensPerRun?: number;
      temperature?: number;
      timeoutMs?: number;
      priority?: number;
      triggeredBy?: string;
    } = {},
  ): Promise<RunId> {
    const db = getDb();
    const runId = generateRunId();

    // Create run record
    await db.insert(agentRuns).values({
      id: runId,
      tenantId,
      agentId,
      status: "pending",
      input,
      triggeredBy: config.triggeredBy,
    });

    // Audit
    const audit = getAuditLogger();
    await audit.log({
      tenantId,
      action: "agent.run.started",
      actorId: config.triggeredBy ?? "system",
      actorType: config.triggeredBy ? "user" : "system",
      resourceType: "agent_run",
      resourceId: runId,
      metadata: { agentId, input },
    });

    // Create process config
    const processConfig: AgentProcessConfig = {
      runId,
      agentId,
      tenantId,
      model: config.model ?? "claude-sonnet-4-5-20250929",
      systemPrompt: config.systemPrompt,
      tools: config.tools,
      maxSteps: config.maxSteps ?? 50,
      maxTokens: config.maxTokensPerRun ?? 100_000,
      temperature: config.temperature ?? 0.7,
      timeoutMs: config.timeoutMs ?? 300_000,
    };

    // Create and register process
    const process = new AgentProcess(
      processConfig,
      this.modelRouter,
      this.memoryManager,
      this.resourceManager,
    );
    this.processes.set(runId, process);

    // Schedule run
    const scheduledRun: ScheduledRun = {
      runId,
      agentId,
      tenantId,
      priority: config.priority ?? 0,
      enqueuedAt: nowMs(),
    };
    this.scheduler.enqueue(scheduledRun);

    // Execute (dequeue and run)
    this.executeNext(runId, input).catch((err) => {
      log.error({ runId, error: String(err) }, "Execution failed");
    });

    return runId;
  }

  private async executeNext(
    runId: string,
    input: Record<string, unknown>,
  ): Promise<void> {
    const scheduled = this.scheduler.dequeue();
    if (!scheduled) return;

    const process = this.processes.get(scheduled.runId);
    if (!process) return;

    const db = getDb();
    const startMs = nowMs();

    // Update status to running
    await db
      .update(agentRuns)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(agentRuns.id, scheduled.runId));

    try {
      const result = await process.run(input);

      // Persist steps
      for (const step of result.steps) {
        await db.insert(agentRunSteps).values({
          id: step.id,
          runId: scheduled.runId,
          tenantId: scheduled.tenantId,
          stepNumber: step.stepNumber,
          type: step.type,
          input: step.input,
          output: step.output,
          tokensUsed: step.tokensUsed,
          durationMs: step.durationMs,
        });
      }

      // Update run record
      const durationMs = elapsed(startMs);
      await db
        .update(agentRuns)
        .set({
          status: result.status,
          output: result.output ?? undefined,
          error:
            result.status === "failed"
              ? String(result.output?.error)
              : undefined,
          totalTokens: result.totalTokens,
          totalSteps: result.steps.length,
          durationMs,
          completedAt: new Date(),
        })
        .where(eq(agentRuns.id, scheduled.runId));

      // Audit completion
      const audit = getAuditLogger();
      await audit.log({
        tenantId: scheduled.tenantId,
        action:
          result.status === "completed"
            ? "agent.run.completed"
            : "agent.run.failed",
        actorId: scheduled.agentId,
        actorType: "agent",
        resourceType: "agent_run",
        resourceId: scheduled.runId,
        metadata: {
          status: result.status,
          totalTokens: result.totalTokens,
          totalSteps: result.steps.length,
          durationMs,
        },
      });

      log.info(
        {
          runId: scheduled.runId,
          status: result.status,
          steps: result.steps.length,
          tokens: result.totalTokens,
          durationMs,
        },
        "Agent run finished",
      );
    } finally {
      this.scheduler.complete(scheduled.runId);
      this.processes.delete(scheduled.runId);
    }
  }

  getProcess(runId: string): AgentProcess | undefined {
    return this.processes.get(runId);
  }

  terminateProcess(runId: string): boolean {
    const process = this.processes.get(runId);
    if (process) {
      process.terminate();
      this.scheduler.complete(runId);
      this.processes.delete(runId);
      return true;
    }
    return false;
  }

  getScheduler(): AgentScheduler {
    return this.scheduler;
  }
}
