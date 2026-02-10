import type { RecordedCall } from "../mocks/mock-model-provider.js";

export function toHaveToolCall(calls: RecordedCall[], toolName: string): boolean {
  return calls.some((c) => c.response.toolCalls?.some((tc) => tc.name === toolName));
}

export function toHaveCompleted(output: unknown): boolean {
  if (!output || typeof output !== "object") return false;
  const obj = output as Record<string, unknown>;
  return obj.status === "completed" || obj.status === "extracted" || obj.status === "classified" || obj.status === "written";
}

export function toHaveOutput(output: unknown, key: string): boolean {
  if (!output || typeof output !== "object") return false;
  return key in (output as Record<string, unknown>);
}

export function toHaveMinTokenUsage(calls: RecordedCall[], minTokens: number): boolean {
  const total = calls.reduce((sum, c) => sum + c.response.usage.totalTokens, 0);
  return total >= minTokens;
}

export function toHaveMaxSteps(calls: RecordedCall[], maxSteps: number): boolean {
  return calls.length <= maxSteps;
}
