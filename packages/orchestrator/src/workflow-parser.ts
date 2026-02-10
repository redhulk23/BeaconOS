import { parse as parseYaml } from "yaml";
import { ValidationError } from "@beacon-os/common";

export type StepType =
  | "agent"
  | "tool"
  | "approval"
  | "condition"
  | "transform";

export interface WorkflowStep {
  id: string;
  name: string;
  type: StepType;
  config: Record<string, unknown>;
  inputMapping?: Record<string, string>;
  outputMapping?: Record<string, string>;
  condition?: string;
  onError?: "fail" | "skip" | "retry";
  retryCount?: number;
  timeoutMs?: number;
}

export interface WorkflowDefinitionParsed {
  name: string;
  version: string;
  description?: string;
  steps: WorkflowStep[];
  pattern?: string;
  config?: Record<string, unknown>;
}

export function parseWorkflow(yamlContent: string): WorkflowDefinitionParsed {
  let raw: unknown;
  try {
    raw = parseYaml(yamlContent);
  } catch (err) {
    throw new ValidationError("Invalid workflow YAML", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  return parseWorkflowFromObject(raw);
}

export function parseWorkflowFromObject(
  obj: unknown,
): WorkflowDefinitionParsed {
  if (!obj || typeof obj !== "object") {
    throw new ValidationError("Workflow must be an object");
  }

  const raw = obj as Record<string, unknown>;

  if (!raw.name || typeof raw.name !== "string") {
    throw new ValidationError("Workflow must have a name");
  }

  const steps = raw.steps as unknown[];
  if (!Array.isArray(steps) || steps.length === 0) {
    throw new ValidationError("Workflow must have at least one step");
  }

  const parsedSteps: WorkflowStep[] = steps.map((step, i) => {
    const s = step as Record<string, unknown>;
    if (!s.id) s.id = `step_${i + 1}`;
    if (!s.type) {
      throw new ValidationError(`Step ${s.id} must have a type`);
    }

    return {
      id: s.id as string,
      name: (s.name as string) ?? s.id,
      type: s.type as StepType,
      config: (s.config as Record<string, unknown>) ?? {},
      inputMapping: s.inputMapping as Record<string, string> | undefined,
      outputMapping: s.outputMapping as Record<string, string> | undefined,
      condition: s.condition as string | undefined,
      onError: (s.onError as "fail" | "skip" | "retry") ?? "fail",
      retryCount: (s.retryCount as number) ?? 0,
      timeoutMs: s.timeoutMs as number | undefined,
    };
  });

  return {
    name: raw.name as string,
    version: (raw.version as string) ?? "0.1.0",
    description: raw.description as string | undefined,
    steps: parsedSteps,
    pattern: raw.pattern as string | undefined,
    config: raw.config as Record<string, unknown> | undefined,
  };
}
