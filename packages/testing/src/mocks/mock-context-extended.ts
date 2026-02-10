import type { AgentContext } from "@beacon-os/sdk";
import { createMockContext } from "@beacon-os/sdk";
import {
  MockModelProvider,
  type MockModelProviderConfig,
} from "./mock-model-provider.js";

export interface ExtendedMockContextOptions {
  agentId?: string;
  tenantId?: string;
  modelConfig?: MockModelProviderConfig;
  tools?: Record<string, (...args: unknown[]) => Promise<unknown>>;
}

export interface ExtendedMockContext {
  ctx: AgentContext;
  modelProvider: MockModelProvider;
  toolCalls: Array<{ name: string; input: unknown; output: unknown }>;
  memorySets: Array<{ key: string; value: unknown }>;
}

export function createExtendedMockContext(
  options: ExtendedMockContextOptions = {},
): ExtendedMockContext {
  const modelProvider = new MockModelProvider(options.modelConfig);
  const toolCalls: Array<{ name: string; input: unknown; output: unknown }> =
    [];
  const memorySets: Array<{ key: string; value: unknown }> = [];
  const memoryStore = new Map<string, unknown>();

  const ctx = createMockContext({
    agentId: options.agentId ?? "test-agent",
    tenantId: options.tenantId ?? "test-tenant",
  });

  // Override model proxy to use MockModelProvider
  ctx.model.complete = async (messages) => {
    const request = {
      provider: "custom" as const,
      model: "mock-model",
      messages: messages.map((m) => ({
        role: m.role as "system" | "user" | "assistant" | "tool_result",
        content: m.content,
      })),
    };
    const response = await modelProvider.complete(request);
    return {
      content: response.content,
      usage: response.usage,
      finishReason: response.finishReason ?? "end_turn",
    };
  };

  // Wrap memory to record sets
  const originalMemSet = ctx.memory.set.bind(ctx.memory);
  ctx.memory.set = async (key: string, value: unknown) => {
    memorySets.push({ key, value });
    memoryStore.set(key, value);
    return originalMemSet(key, value);
  };
  const originalMemGet = ctx.memory.get.bind(ctx.memory);
  ctx.memory.get = async (key: string) => {
    const stored = memoryStore.get(key);
    if (stored !== undefined) return stored;
    return originalMemGet(key);
  };

  return { ctx, modelProvider, toolCalls, memorySets };
}
