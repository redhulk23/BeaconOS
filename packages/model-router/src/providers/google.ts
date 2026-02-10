import type {
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
  ModelMessage,
  ModelToolCall,
  ModelToolDefinition,
} from "@beacon-os/common";
import type { ModelProvider } from "./base.js";

interface GoogleAIClient {
  getGenerativeModel(params: { model: string }): GoogleGenerativeModel;
}

interface GoogleGenerativeModel {
  generateContent(params: {
    contents: GoogleContent[];
    systemInstruction?: { parts: GooglePart[] };
    tools?: GoogleTool[];
    generationConfig?: Record<string, unknown>;
  }): Promise<GoogleGenerateContentResponse>;
  generateContentStream(params: {
    contents: GoogleContent[];
    systemInstruction?: { parts: GooglePart[] };
    tools?: GoogleTool[];
    generationConfig?: Record<string, unknown>;
  }): Promise<{ stream: AsyncIterable<GoogleGenerateContentResponse> }>;
}

interface GoogleContent {
  role: string;
  parts: GooglePart[];
}

interface GooglePart {
  text?: string;
  functionCall?: { name: string; args: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}

interface GoogleTool {
  functionDeclarations: Array<{
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  }>;
}

interface GoogleGenerateContentResponse {
  response: {
    candidates?: Array<{
      content: { parts: GooglePart[] };
      finishReason: string;
    }>;
    usageMetadata?: {
      promptTokenCount: number;
      candidatesTokenCount: number;
      totalTokenCount: number;
    };
  };
}

export class GoogleProvider implements ModelProvider {
  readonly name = "google";
  private client: GoogleAIClient;

  constructor(apiKey?: string) {
    const { GoogleGenerativeAI } = require("@google/generative-ai");
    this.client = new GoogleGenerativeAI(apiKey ?? process.env.GOOGLE_AI_API_KEY);
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    const model = this.client.getGenerativeModel({ model: request.model });
    const { system, contents } = this.transformMessages(request.messages);
    const tools = request.tools ? this.transformTools(request.tools) : undefined;

    const params: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
      },
    };

    if (system) {
      params.systemInstruction = { parts: [{ text: system }] };
    }
    if (tools) {
      params.tools = tools;
    }

    const result = await model.generateContent(params as Parameters<typeof model.generateContent>[0]);
    return this.transformResponse(result);
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    const model = this.client.getGenerativeModel({ model: request.model });
    const { system, contents } = this.transformMessages(request.messages);
    const tools = request.tools ? this.transformTools(request.tools) : undefined;

    const params: Record<string, unknown> = {
      contents,
      generationConfig: {
        maxOutputTokens: request.maxTokens ?? 4096,
        temperature: request.temperature ?? 0.7,
      },
    };

    if (system) {
      params.systemInstruction = { parts: [{ text: system }] };
    }
    if (tools) {
      params.tools = tools;
    }

    const result = await model.generateContentStream(params as Parameters<typeof model.generateContentStream>[0]);

    let totalInputTokens = 0;
    let totalOutputTokens = 0;

    for await (const chunk of result.stream) {
      const candidate = chunk.response.candidates?.[0];
      if (!candidate) continue;

      for (const part of candidate.content.parts) {
        if (part.text) {
          yield { type: "text", content: part.text };
        }
        if (part.functionCall) {
          yield {
            type: "tool_call_start",
            toolCall: { name: part.functionCall.name },
          };
          yield {
            type: "tool_call_delta",
            content: JSON.stringify(part.functionCall.args),
          };
          yield {
            type: "tool_call_end",
            toolCall: {
              id: `fc_${part.functionCall.name}_${Date.now()}`,
              name: part.functionCall.name,
              input: part.functionCall.args,
            },
          };
        }
      }

      if (chunk.response.usageMetadata) {
        totalInputTokens = chunk.response.usageMetadata.promptTokenCount;
        totalOutputTokens = chunk.response.usageMetadata.candidatesTokenCount;
      }
    }

    yield {
      type: "done",
      usage: {
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        totalTokens: totalInputTokens + totalOutputTokens,
      },
    };
  }

  private transformMessages(messages: ModelMessage[]): {
    system: string | undefined;
    contents: GoogleContent[];
  } {
    let system: string | undefined;
    const contents: GoogleContent[] = [];

    for (const msg of messages) {
      if (msg.role === "system") {
        system = msg.content;
      } else if (msg.role === "tool_result") {
        contents.push({
          role: "function",
          parts: [
            {
              functionResponse: {
                name: msg.toolName ?? "unknown",
                response: { result: msg.content },
              },
            },
          ],
        });
      } else if (msg.role === "assistant") {
        contents.push({
          role: "model",
          parts: [{ text: msg.content }],
        });
      } else {
        contents.push({
          role: "user",
          parts: [{ text: msg.content }],
        });
      }
    }

    return { system, contents };
  }

  private transformTools(tools: ModelToolDefinition[]): GoogleTool[] {
    return [
      {
        functionDeclarations: tools.map((t) => ({
          name: t.name,
          description: t.description,
          parameters: t.inputSchema,
        })),
      },
    ];
  }

  private transformResponse(result: GoogleGenerateContentResponse): ModelResponse {
    const candidate = result.response.candidates?.[0];
    let content = "";
    const toolCalls: ModelToolCall[] = [];

    if (candidate) {
      for (const part of candidate.content.parts) {
        if (part.text) {
          content += part.text;
        }
        if (part.functionCall) {
          toolCalls.push({
            id: `fc_${part.functionCall.name}_${Date.now()}`,
            name: part.functionCall.name,
            input: part.functionCall.args,
          });
        }
      }
    }

    const usage = result.response.usageMetadata;
    const finishReason =
      candidate?.finishReason === "MAX_TOKENS"
        ? "max_tokens"
        : toolCalls.length > 0
          ? "tool_use"
          : "end_turn";

    return {
      content,
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
      usage: {
        inputTokens: usage?.promptTokenCount ?? 0,
        outputTokens: usage?.candidatesTokenCount ?? 0,
        totalTokens: usage?.totalTokenCount ?? 0,
      },
      finishReason,
    };
  }
}
