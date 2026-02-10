import type {
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
} from "@beacon-os/common";

export interface MockModelProviderConfig {
  responses?: ModelResponse[];
  responseFunction?: (request: ModelRequest) => ModelResponse;
  defaultResponse?: ModelResponse;
}

export interface RecordedCall {
  request: ModelRequest;
  response: ModelResponse;
  timestamp: number;
}

const DEFAULT_RESPONSE: ModelResponse = {
  content: "Mock response",
  usage: { inputTokens: 100, outputTokens: 50, totalTokens: 150 },
  finishReason: "end_turn",
};

export class MockModelProvider {
  readonly name = "mock";
  private responses: ModelResponse[];
  private responseFunction?: (request: ModelRequest) => ModelResponse;
  private defaultResponse: ModelResponse;
  private callIndex = 0;
  readonly calls: RecordedCall[] = [];

  constructor(config: MockModelProviderConfig = {}) {
    this.responses = config.responses ?? [];
    this.responseFunction = config.responseFunction;
    this.defaultResponse = config.defaultResponse ?? DEFAULT_RESPONSE;
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    let response: ModelResponse;

    if (this.responseFunction) {
      response = this.responseFunction(request);
    } else if (this.callIndex < this.responses.length) {
      response = this.responses[this.callIndex]!;
    } else {
      response = this.defaultResponse;
    }

    this.calls.push({ request, response, timestamp: Date.now() });
    this.callIndex++;
    return response;
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    const response = await this.complete(request);
    yield { type: "text", content: response.content };
    if (response.toolCalls) {
      for (const tc of response.toolCalls) {
        yield { type: "tool_call_start", toolCall: tc };
        yield { type: "tool_call_end", toolCall: tc };
      }
    }
    yield { type: "done", usage: response.usage };
  }

  reset(): void {
    this.calls.length = 0;
    this.callIndex = 0;
  }

  getCallCount(): number {
    return this.calls.length;
  }

  getLastCall(): RecordedCall | undefined {
    return this.calls[this.calls.length - 1];
  }
}
