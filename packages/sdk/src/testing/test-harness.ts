import type { AgentDefinition } from "../agent-builder.js";
import { createMockContext, type MockContextOptions } from "./mock-context.js";

export interface TestResult {
  output: Record<string, unknown>;
  events: { event: string; data?: Record<string, unknown> }[];
  modelCalls: unknown[];
  toolCalls: { name: string; input: Record<string, unknown> }[];
  durationMs: number;
}

export async function runAgentTest(
  agent: AgentDefinition,
  input: Record<string, unknown>,
  mockOptions?: MockContextOptions,
): Promise<TestResult> {
  const ctx = createMockContext(mockOptions);
  const start = Date.now();

  const output = await agent.handler(ctx, input);

  return {
    output,
    events: ctx.getEvents(),
    modelCalls: ctx.getModelCalls(),
    toolCalls: ctx.getToolCalls(),
    durationMs: Date.now() - start,
  };
}
