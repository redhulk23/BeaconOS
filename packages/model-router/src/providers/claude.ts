import Anthropic from "@anthropic-ai/sdk";
import type {
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
  ModelMessage,
  ModelToolCall,
  ModelToolDefinition,
} from "@beacon-os/common";
import type { ModelProvider } from "./base.js";

export class ClaudeProvider implements ModelProvider {
  readonly name = "claude";
  private client: Anthropic;

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? process.env.ANTHROPIC_API_KEY,
    });
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const { system, messages } = this.transformMessages(request.messages);
    const tools = request.tools?.map((t) => this.transformTool(t));

    const response = await this.client.messages.create({
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      ...(system ? { system } : {}),
      messages,
      ...(tools && tools.length > 0 ? { tools } : {}),
    });

    return this.transformResponse(response);
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    const { system, messages } = this.transformMessages(request.messages);
    const tools = request.tools?.map((t) => this.transformTool(t));

    const stream = this.client.messages.stream({
      model: request.model,
      max_tokens: request.maxTokens ?? 4096,
      temperature: request.temperature ?? 0.7,
      ...(system ? { system } : {}),
      messages,
      ...(tools && tools.length > 0 ? { tools } : {}),
    });

    let currentToolCall: Partial<ModelToolCall> | null = null;

    for await (const event of stream) {
      if (event.type === "content_block_start") {
        const block = event.content_block;
        if (block.type === "text") {
          // Text block starting — nothing to emit yet
        } else if (block.type === "tool_use") {
          currentToolCall = {
            id: block.id,
            name: block.name,
            input: {},
          };
          yield {
            type: "tool_call_start",
            toolCall: currentToolCall,
          };
        }
      } else if (event.type === "content_block_delta") {
        const delta = event.delta;
        if (delta.type === "text_delta") {
          yield { type: "text", content: delta.text };
        } else if (delta.type === "input_json_delta") {
          yield {
            type: "tool_call_delta",
            content: delta.partial_json,
          };
        }
      } else if (event.type === "content_block_stop") {
        if (currentToolCall) {
          yield { type: "tool_call_end", toolCall: currentToolCall };
          currentToolCall = null;
        }
      } else if (event.type === "message_stop") {
        // We'll get usage from the final message
      }
    }

    const finalMessage = await stream.finalMessage();
    yield {
      type: "done",
      usage: {
        inputTokens: finalMessage.usage.input_tokens,
        outputTokens: finalMessage.usage.output_tokens,
        totalTokens:
          finalMessage.usage.input_tokens + finalMessage.usage.output_tokens,
      },
    };
  }

  private transformMessages(messages: ModelMessage[]): {
    system: string | undefined;
    messages: Anthropic.MessageParam[];
  } {
    let system: string | undefined;
    const transformed: Anthropic.MessageParam[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system = msg.content;
      } else if (msg.role === "tool_result") {
        transformed.push({
          role: "user",
          content: [
            {
              type: "tool_result",
              tool_use_id: msg.toolCallId!,
              content: msg.content,
            },
          ],
        });
      } else {
        transformed.push({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        });
      }
    }

    return { system, messages: transformed };
  }

  private transformTool(tool: ModelToolDefinition): Anthropic.Tool {
    return {
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema as Anthropic.Tool["input_schema"],
    };
  }

  private transformResponse(response: Anthropic.Message): ModelResponse {
    let content = "";
    const toolCalls: ModelToolCall[] = [];

    for (const block of response.content) {
      if (block.type === "text") {
        content += block.text;
      } else if (block.type === "tool_use") {
        toolCalls.push({
          id: block.id,
          name: block.name,
          input: block.input as Record<string, unknown>,
        });
      }
    }

    const finishReason =
      response.stop_reason === "tool_use"
        ? "tool_use"
        : response.stop_reason === "max_tokens"
          ? "max_tokens"
          : "end_turn";

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        totalTokens:
          response.usage.input_tokens + response.usage.output_tokens,
      },
      finishReason,
    };
  }
}
