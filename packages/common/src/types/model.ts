export type ModelProvider = "claude" | "openai" | "custom";

export interface ModelRequest {
  provider: ModelProvider;
  model: string;
  messages: ModelMessage[];
  maxTokens?: number;
  temperature?: number;
  tools?: ModelToolDefinition[];
  stream?: boolean;
}

export interface ModelMessage {
  role: "system" | "user" | "assistant" | "tool_result";
  content: string;
  toolCallId?: string;
  toolName?: string;
}

export interface ModelToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export interface ModelResponse {
  content: string;
  toolCalls?: ModelToolCall[];
  usage: ModelUsage;
  finishReason: "end_turn" | "tool_use" | "max_tokens" | "stop";
}

export interface ModelToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

export interface ModelUsage {
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
}

export interface ModelStreamChunk {
  type: "text" | "tool_call_start" | "tool_call_delta" | "tool_call_end" | "done";
  content?: string;
  toolCall?: Partial<ModelToolCall>;
  usage?: ModelUsage;
}
