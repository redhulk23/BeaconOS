import { createLogger } from "@beacon-os/common";
import type { WorkflowStep } from "./workflow-parser.js";
import type { WorkflowState } from "./state-machine.js";

const log = createLogger("orchestrator:step-executor");

export interface StepExecutionContext {
  tenantId: string;
  workflowRunId: string;
  state: WorkflowState;
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

export interface StepResult {
  stepId: string;
  status: "completed" | "failed" | "skipped" | "waiting";
  output: unknown;
  error?: string;
  durationMs: number;
}

export async function executeStep(
  step: WorkflowStep,
  ctx: StepExecutionContext,
): Promise<StepResult> {
  const startMs = Date.now();

  // Evaluate condition
  if (step.condition) {
    const shouldRun = evaluateCondition(step.condition, ctx.state.data);
    if (!shouldRun) {
      return {
        stepId: step.id,
        status: "skipped",
        output: null,
        durationMs: Date.now() - startMs,
      };
    }
  }

  // Resolve input from mappings
  const input = resolveInputMapping(step.inputMapping, ctx.state.data);

  try {
    let output: unknown;

    switch (step.type) {
      case "agent": {
        const agentId = step.config.agentId as string;
        if (!agentId) throw new Error(`Step ${step.id}: agentId is required`);
        output = await ctx.executeAgent(agentId, input);
        break;
      }

      case "tool": {
        const toolName = step.config.toolName as string;
        if (!toolName) throw new Error(`Step ${step.id}: toolName is required`);
        output = await ctx.executeTool(toolName, input);
        break;
      }

      case "approval": {
        const result = await ctx.requestApproval({
          title: (step.config.title as string) ?? step.name,
          description: step.config.description as string | undefined,
          context: input,
        });
        if (!result.approved) {
          return {
            stepId: step.id,
            status: "failed",
            output: result,
            error: `Approval denied: ${result.note ?? "no reason given"}`,
            durationMs: Date.now() - startMs,
          };
        }
        output = result;
        break;
      }

      case "condition": {
        const expr = step.config.expression as string;
        if (!expr) throw new Error(`Step ${step.id}: expression is required`);
        output = { result: evaluateCondition(expr, ctx.state.data) };
        break;
      }

      case "transform": {
        output = applyTransform(step.config, ctx.state.data);
        break;
      }

      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }

    // Apply output mapping
    if (step.outputMapping && typeof output === "object" && output !== null) {
      const mapped = resolveOutputMapping(
        step.outputMapping,
        output as Record<string, unknown>,
      );
      Object.assign(ctx.state.data, mapped);
    } else if (output !== undefined) {
      ctx.state.data[step.id] = output;
    }

    return {
      stepId: step.id,
      status: "completed",
      output,
      durationMs: Date.now() - startMs,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    log.error({ stepId: step.id, error: message }, "Step execution failed");

    if (step.onError === "skip") {
      return {
        stepId: step.id,
        status: "skipped",
        output: null,
        error: message,
        durationMs: Date.now() - startMs,
      };
    }

    return {
      stepId: step.id,
      status: "failed",
      output: null,
      error: message,
      durationMs: Date.now() - startMs,
    };
  }
}

function resolveInputMapping(
  mapping: Record<string, string> | undefined,
  data: Record<string, unknown>,
): Record<string, unknown> {
  if (!mapping) return { ...data };

  const result: Record<string, unknown> = {};
  for (const [targetKey, sourcePath] of Object.entries(mapping)) {
    result[targetKey] = getNestedValue(data, sourcePath);
  }
  return result;
}

function resolveOutputMapping(
  mapping: Record<string, string>,
  output: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [targetKey, sourceKey] of Object.entries(mapping)) {
    result[targetKey] = getNestedValue(output, sourceKey);
  }
  return result;
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

function evaluateCondition(
  expression: string,
  data: Record<string, unknown>,
): boolean {
  // Simple expression evaluator for conditions like "data.score > 0.8"
  // Supports: ==, !=, >, <, >=, <=, &&, ||, !
  try {
    const parts = expression.split(/\s+(==|!=|>=|<=|>|<)\s+/);
    if (parts.length === 3) {
      const left = resolveValue(parts[0]!.trim(), data);
      const op = parts[1]!.trim();
      const right = resolveValue(parts[2]!.trim(), data);

      switch (op) {
        case "==":
          return left == right;
        case "!=":
          return left != right;
        case ">":
          return Number(left) > Number(right);
        case "<":
          return Number(left) < Number(right);
        case ">=":
          return Number(left) >= Number(right);
        case "<=":
          return Number(left) <= Number(right);
      }
    }

    // Truthy check for simple path references
    const value = getNestedValue(data, expression);
    return !!value;
  } catch {
    return false;
  }
}

function resolveValue(token: string, data: Record<string, unknown>): unknown {
  // Number literal
  if (/^-?\d+(\.\d+)?$/.test(token)) return Number(token);
  // String literal
  if (token.startsWith('"') && token.endsWith('"')) return token.slice(1, -1);
  if (token === "true") return true;
  if (token === "false") return false;
  if (token === "null") return null;
  // Path reference
  return getNestedValue(data, token);
}

function applyTransform(
  config: Record<string, unknown>,
  data: Record<string, unknown>,
): unknown {
  const operation = config.operation as string;
  switch (operation) {
    case "merge":
      return { ...data, ...((config.values as Record<string, unknown>) ?? {}) };
    case "pick": {
      const keys = config.keys as string[];
      const result: Record<string, unknown> = {};
      for (const key of keys ?? []) {
        result[key] = getNestedValue(data, key);
      }
      return result;
    }
    case "set": {
      const key = config.key as string;
      const value = config.value;
      return { [key]: value };
    }
    default:
      return data;
  }
}
