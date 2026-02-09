import type {
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
} from "@beacon-os/common";

export interface ModelProvider {
  readonly name: string;
  complete(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterable<ModelStreamChunk>;
}
