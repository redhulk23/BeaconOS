import {
  createLogger,
  generateRunId,
  generateAgentId,
} from "@beacon-os/common";
import type {
  AgentContext,
  ModelProxy,
  ToolProxy,
  MemoryProxy,
  HitlProxy,
} from "../runtime/agent-context.js";

export interface MockContextOptions {
  agentId?: string;
  runId?: string;
  tenantId?: string;
  modelResponses?: { content: string }[];
  toolResults?: Record<string, unknown>;
  memoryStore?: Map<string, unknown>;
  approvalResult?: { approved: boolean; note?: string };
}

export function createMockContext(
  options: MockContextOptions = {},
): AgentContext & {
  getEvents(): { event: string; data?: Record<string, unknown> }[];
  getModelCalls(): unknown[];
  getToolCalls(): { name: string; input: Record<string, unknown> }[];
} {
  const agentId = options.agentId ?? generateAgentId();
  const runId = options.runId ?? generateRunId();
  const tenantId = options.tenantId ?? "tnt_test";

  const events: { event: string; data?: Record<string, unknown> }[] = [];
  const modelCalls: unknown[] = [];
  const toolCalls: { name: string; input: Record<string, unknown> }[] = [];
  const memory = options.memoryStore ?? new Map<string, unknown>();
  let responseIndex = 0;

  const modelProxy: ModelProxy = {
    async complete(messages, opts) {
      modelCalls.push({ messages, options: opts });
      const resp = options.modelResponses?.[responseIndex++];
      return {
        content: resp?.content ?? "Mock response",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
        finishReason: "end_turn",
      };
    },
    async *stream(messages, opts) {
      modelCalls.push({ messages, options: opts, streaming: true });
      const resp = options.modelResponses?.[responseIndex++];
      yield { type: "text", content: resp?.content ?? "Mock response" };
      yield {
        type: "done",
        usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
      };
    },
  };

  const toolProxy: ToolProxy = {
    async invoke(name, input) {
      toolCalls.push({ name, input });
      return options.toolResults?.[name] ?? { result: "mock" };
    },
    list() {
      return Object.keys(options.toolResults ?? {});
    },
  };

  const memoryProxy: MemoryProxy = {
    async get(key) {
      return memory.get(key) ?? null;
    },
    async set(key, value) {
      memory.set(key, value);
    },
    async delete(key) {
      memory.delete(key);
    },
  };

  const hitlProxy: HitlProxy = {
    async requestApproval() {
      return (
        options.approvalResult ?? {
          approved: true,
          note: "Auto-approved in test",
        }
      );
    },
  };

  const log = createLogger("test:" + agentId);

  return {
    agentId,
    runId,
    tenantId,
    model: modelProxy,
    tools: toolProxy,
    memory: memoryProxy,
    log,
    hitl: hitlProxy,
    emit(event, data) {
      events.push({ event, data });
    },
    getEvents() {
      return events;
    },
    getModelCalls() {
      return modelCalls;
    },
    getToolCalls() {
      return toolCalls;
    },
  };
}
