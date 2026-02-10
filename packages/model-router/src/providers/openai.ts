import type {
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
  ModelMessage,
  ModelToolCall,
  ModelToolDefinition,
} from "@beacon-os/common";
import type { ModelProvider } from "./base.js";

interface OpenAIClient {
  chat: {
    completions: {
      create(params: Record<string, unknown>): Promise<OpenAIChatCompletion>;
    };
  };
}

interface OpenAIChatCompletion {
  choices: Array<{
    message: {
      content: string | null;
      tool_calls?: Array<{
        id: string;
        function: { name: string; arguments: string };
      }>;
    };
    finish_reason: string;
  }>;
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export class OpenAIProvider implements ModelProvider {
  readonly name = "openai";
  private client: OpenAIClient;

  constructor(apiKey?: string) {
    // Dynamic import pattern — OpenAI SDK loaded at runtime
    const OpenAI = require("openai").default ?? require("openai");
    this.client = new OpenAI({
      apiKey: apiKey ?? process.env.OPENAI_API_KEY,
    });
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const messages = this.transformMessages(request.messages);
    const tools = request.tools?.map((t) => this.transformTool(t));

    const params: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      messages,
    };

    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    const response = await this.client.chat.completions.create(params);
    return this.transformResponse(response);
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    const messages = this.transformMessages(request.messages);
    const tools = request.tools?.map((t) => this.transformTool(t));

    const params: Record<string, unknown> = {
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      messages,
      stream: true,
      stream_options: { include_usage: true },
    };

    if (tools && tools.length > 0) {
      params.tools = tools;
    }

    const stream = await this.client.chat.completions.create(params) as unknown as AsyncIterable<{
      choices: Array<{
        delta: {
          content?: string | null;
          tool_calls?: Array<{
            index: number;
            id?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
        finish_reason?: string | null;
      }>;
      usage?: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    }>;

    const toolCallAccumulators = new Map<number, { id: string; name: string; args: string }>();

    for await (const chunk of stream) {
      const choice = chunk.choices[0];
      if (!choice) continue;

      const delta = choice.delta;

      if (delta.content) {
        yield { type: "text", content: delta.content };
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (tc.id) {
            toolCallAccumulators.set(tc.index, {
              id: tc.id,
              name: tc.function?.name ?? "",
              args: tc.function?.arguments ?? "",
            });
            yield {
              type: "tool_call_start",
              toolCall: { id: tc.id, name: tc.function?.name },
            };
          } else {
            const acc = toolCallAccumulators.get(tc.index);
            if (acc && tc.function?.arguments) {
              acc.args += tc.function.arguments;
              yield {
                type: "tool_call_delta",
                content: tc.function.arguments,
              };
            }
          }
        }
      }

      if (choice.finish_reason) {
        for (const [, acc] of toolCallAccumulators) {
          try {
            yield {
              type: "tool_call_end",
              toolCall: {
                id: acc.id,
                name: acc.name,
                input: JSON.parse(acc.args || "{}"),
              },
            };
          } catch {
            yield { type: "tool_call_end", toolCall: { id: acc.id, name: acc.name, input: {} } };
          }
        }
        toolCallAccumulators.clear();
      }

      if (chunk.usage) {
        yield {
          type: "done",
          usage: {
            inputTokens: chunk.usage.prompt_tokens,
            outputTokens: chunk.usage.completion_tokens,
            totalTokens: chunk.usage.total_tokens,
          },
        };
      }
    }
  }

  private transformMessages(messages: ModelMessage[]): Record<string, unknown>[] {
    return messages.map((msg) => {
      if (msg.role === "tool_result") {
        return {
          role: "tool",
          tool_call_id: msg.toolCallId,
          content: msg.content,
        };
      }
      return {
        role: msg.role,
        content: msg.content,
      };
    });
  }

  private transformTool(tool: ModelToolDefinition): Record<string, unknown> {
    return {
      type: "function",
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema,
      },
    };
  }

  private transformResponse(response: OpenAIChatCompletion): ModelResponse {
    const choice = response.choices[0]!;
    const message = choice.message;
    const toolCalls: ModelToolCall[] = [];

    if (message.tool_calls) {
      for (const tc of message.tool_calls) {
        toolCalls.push({
          id: tc.id,
          name: tc.function.name,
          input: JSON.parse(tc.function.arguments),
        });
      }
    }

    const finishReason =
      choice.finish_reason === "tool_calls"
        ? "tool_use"
        : choice.finish_reason === "length"
          ? "max_tokens"
          : choice.finish_reason === "stop"
            ? "end_turn"
            : "end_turn";

    return {
      content: message.content ?? "",
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usage.prompt_tokens,
        outputTokens: response.usage.completion_tokens,
        totalTokens: response.usage.total_tokens,
      },
      finishReason,
    };
  }
}
