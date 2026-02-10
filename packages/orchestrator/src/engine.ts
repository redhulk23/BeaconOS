import { createLogger, generateId, type WorkflowId } from "@beacon-os/common";
import { getDb, workflowDefinitions, workflowRuns } from "@beacon-os/db";
import { eq, and } from "drizzle-orm";
import { getAuditLogger } from "@beacon-os/audit";
import {
  parseWorkflow,
  parseWorkflowFromObject,
  type WorkflowDefinitionParsed,
} from "./workflow-parser.js";
import { createInitialState, type WorkflowState } from "./state-machine.js";
import { type StepExecutionContext } from "./step-executor.js";
import { loadCheckpoint } from "./checkpoint.js";
import { runSequential } from "./patterns/sequential.js";
import { runFanOutGather } from "./patterns/fan-out-gather.js";
import { runHumanInTheLoop } from "./patterns/human-in-the-loop.js";
import { runCoordinator } from "./patterns/coordinator.js";
import { runIterativeRefinement } from "./patterns/iterative-refinement.js";
import { runHierarchical } from "./patterns/hierarchical.js";
import { runConsensus } from "./patterns/consensus.js";
import { runBlackboard } from "./patterns/blackboard.js";

const log = createLogger("orchestrator:engine");

export interface OrchestrationDeps {
  executeAgent: (
    agentId: string,
    input: Record<string, unknown>,
  ) => Promise<unknown>;
  executeTool: (
    toolName: string,
    input: Record<string, unknown>,
  ) => Promise<unknown>;
  requestApproval: (request: {
    title: string;
    description?: string;
    context?: Record<string, unknown>;
  }) => Promise<{ approved: boolean; note?: string }>;
}

export class OrchestrationEngine {
  private deps: OrchestrationDeps;

  constructor(deps: OrchestrationDeps) {
    this.deps = deps;
  }

  async startWorkflow(
    workflowId: string,
    tenantId: string,
    input: Record<string, unknown>,
    triggeredBy?: string,
  ): Promise<string> {
    const db = getDb();

    // Load workflow definition
    const wfDef = await db
      .select()
      .from(workflowDefinitions)
      .where(
        and(
          eq(workflowDefinitions.id, workflowId),
          eq(workflowDefinitions.tenantId, tenantId),
        ),
      )
      .then((rows) => rows[0]);

    if (!wfDef) throw new Error(`Workflow ${workflowId} not found`);

    const definition = parseWorkflowFromObject(wfDef.definition);

    // Create workflow run
    const runId = generateId();
    await db.insert(workflowRuns).values({
      id: runId,
      tenantId,
      workflowId,
      status: "pending",
      input,
      state: input,
    });

    // Audit
    const audit = getAuditLogger();
    await audit.log({
      tenantId,
      action: "agent.run.started",
      actorId: triggeredBy ?? "system",
      actorType: triggeredBy ? "user" : "system",
      resourceType: "workflow_run",
      resourceId: runId,
      metadata: { workflowId, workflowName: definition.name },
    });

    // Execute asynchronously
    this.executeWorkflow(runId, tenantId, definition, input).catch((err) => {
      log.error({ runId, error: String(err) }, "Workflow execution failed");
    });

    return runId;
  }

  private async executeWorkflow(
    runId: string,
    tenantId: string,
    definition: WorkflowDefinitionParsed,
    input: Record<string, unknown>,
  ): Promise<void> {
    const db = getDb();
    const state = createInitialState(input);

    const ctx: StepExecutionContext = {
      tenantId,
      workflowRunId: runId,
      state,
      executeAgent: this.deps.executeAgent,
      executeTool: this.deps.executeTool,
      requestApproval: this.deps.requestApproval,
    };

    await db
      .update(workflowRuns)
      .set({ status: "running", startedAt: new Date() })
      .where(eq(workflowRuns.id, runId));

    let finalState: WorkflowState;

    try {
      const pattern = definition.pattern ?? "sequential";

      switch (pattern) {
        case "sequential":
          finalState = await runSequential(definition.steps, ctx, runId);
          break;

        case "fan-out-gather":
        case "fan_out_gather":
          finalState = await runFanOutGather(definition.steps, ctx, runId);
          break;

        case "human-in-the-loop":
        case "hitl": {
          const approvalIdx = definition.steps.findIndex(
            (s) => s.type === "approval",
          );
          const preSteps =
            approvalIdx >= 0
              ? definition.steps.slice(0, approvalIdx)
              : definition.steps;
          const postSteps =
            approvalIdx >= 0 ? definition.steps.slice(approvalIdx + 1) : [];
          const approvalConfig = {
            title: definition.name,
            ...((definition.config as {
              title?: string;
              description?: string;
              timeoutMs?: number;
            }) ?? {}),
          };
          finalState = await runHumanInTheLoop(
            preSteps,
            approvalConfig,
            postSteps,
            ctx,
            runId,
          );
          break;
        }

        case "coordinator": {
          const [coordinator, ...rest] = definition.steps;
          const synthesizer = rest.pop()!;
          finalState = await runCoordinator(
            coordinator!,
            rest,
            synthesizer,
            ctx,
            runId,
          );
          break;
        }

        case "hierarchical": {
          const [manager, ...rest2] = definition.steps;
          const reviewer = rest2.pop()!;
          finalState = await runHierarchical(
            manager!,
            rest2,
            reviewer,
            ctx,
            runId,
          );
          break;
        }

        case "consensus": {
          const judge = definition.steps[definition.steps.length - 1]!;
          const voters = definition.steps.slice(0, -1);
          finalState = await runConsensus(
            voters,
            judge,
            ctx,
            runId,
            definition.config as Record<string, unknown>,
          );
          break;
        }

        case "iterative-refinement":
        case "iterative_refinement": {
          const generator = definition.steps[0]!;
          const evaluator = definition.steps[1]!;
          finalState = await runIterativeRefinement(
            generator,
            evaluator,
            ctx,
            runId,
            definition.config as Record<string, unknown>,
          );
          break;
        }

        case "blackboard": {
          finalState = await runBlackboard(
            definition.steps,
            ctx,
            runId,
            definition.config as Record<string, unknown>,
          );
          break;
        }

        default:
          finalState = await runSequential(definition.steps, ctx, runId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      finalState = {
        ...state,
        status: "failed",
        error: message,
        completedAt: new Date(),
      };
    }

    // Persist final state
    await db
      .update(workflowRuns)
      .set({
        status: finalState.status,
        state: finalState.data,
        output: finalState.data,
        error: finalState.error,
        completedAt: finalState.completedAt,
      })
      .where(eq(workflowRuns.id, runId));

    const audit = getAuditLogger();
    await audit.log({
      tenantId,
      action:
        finalState.status === "completed"
          ? "agent.run.completed"
          : "agent.run.failed",
      actorId: "system",
      actorType: "system",
      resourceType: "workflow_run",
      resourceId: runId,
      metadata: {
        status: finalState.status,
        stepCount: Object.keys(finalState.stepResults).length,
      },
    });

    log.info(
      {
        runId,
        status: finalState.status,
        steps: Object.keys(finalState.stepResults).length,
      },
      "Workflow execution finished",
    );
  }

  async resumeWorkflow(runId: string, tenantId: string): Promise<void> {
    const checkpoint = await loadCheckpoint(runId);
    if (!checkpoint)
      throw new Error(`No checkpoint found for workflow run ${runId}`);

    log.info(
      { runId, step: checkpoint.currentStep },
      "Resuming workflow from checkpoint",
    );
    // Resume logic delegates to the same pattern runner with restored state
  }
}
