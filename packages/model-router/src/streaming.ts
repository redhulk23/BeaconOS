import type {
  ModelStreamChunk,
  ModelResponse,
  ModelUsage,
} from "@beacon-os/common";

export async function collectStream(
  stream: AsyncIterable<ModelStreamChunk>,
): Promise<ModelResponse> {
  let content = "";
  const toolCalls: { id: string; name: string; inputJson: string }[] = [];
  let currentToolInput = "";
  let usage: ModelUsage = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
  let finishReason: ModelResponse["finishReason"] = "end_turn";

  for await (const chunk of stream) {
    switch (chunk.type) {
      case "text":
        content += chunk.content ?? "";
        break;
      case "tool_call_start":
        currentToolInput = "";
        if (chunk.toolCall?.id && chunk.toolCall?.name) {
          toolCalls.push({
            id: chunk.toolCall.id,
            name: chunk.toolCall.name,
            inputJson: "",
          });
        }
        break;
      case "tool_call_delta":
        currentToolInput += chunk.content ?? "";
        break;
      case "tool_call_end": {
        const last = toolCalls[toolCalls.length - 1];
        if (last) {
          last.inputJson = currentToolInput;
        }
        finishReason = "tool_use";
        break;
      }
      case "done":
        if (chunk.usage) usage = chunk.usage;
        break;
    }
  }

  return {
    content,
    toolCalls:
      toolCalls.length > 0
        ? toolCalls.map((tc) => ({
            id: tc.id,
            name: tc.name,
            input: tc.inputJson ? JSON.parse(tc.inputJson) : {},
          }))
        : undefined,
    usage,
    finishReason,
  };
}

export type StreamCallback = (chunk: ModelStreamChunk) => void;

export async function* tapStream(
  stream: AsyncIterable<ModelStreamChunk>,
  callback: StreamCallback,
): AsyncIterable<ModelStreamChunk> {
  for await (const chunk of stream) {
    callback(chunk);
    yield chunk;
  }
}
