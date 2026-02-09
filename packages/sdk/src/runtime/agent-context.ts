import type { ModelResponse, ModelStreamChunk, Logger } from "@beacon-os/common";

export interface ModelProxy {
  complete(
    messages: { role: string; content: string }[],
    options?: { maxTokens?: number; temperature?: number },
  ): Promise<ModelResponse>;
  stream(
    messages: { role: string; content: string }[],
    options?: { maxTokens?: number; temperature?: number },
  ): AsyncIterable<ModelStreamChunk>;
}

export interface ToolProxy {
  invoke(toolName: string, input: Record<string, unknown>): Promise<unknown>;
  list(): string[];
}

export interface MemoryProxy {
  get(key: string): Promise<unknown | null>;
  set(key: string, value: unknown, tier?: "working" | "short" | "long"): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface HitlProxy {
  requestApproval(request: {
    title: string;
    description?: string;
    context?: Record<string, unknown>;
    timeoutMs?: number;
  }): Promise<{ approved: boolean; note?: string }>;
}

export interface AgentContext {
  readonly agentId: string;
  readonly runId: string;
  readonly tenantId: string;
  readonly model: ModelProxy;
  readonly tools: ToolProxy;
  readonly memory: MemoryProxy;
  readonly log: Logger;
  readonly hitl: HitlProxy;
  emit(event: string, data?: Record<string, unknown>): void;
}
