import { createLogger } from "@beacon-os/common";
import type { ModelProvider } from "./providers/base.js";
import type {
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
} from "@beacon-os/common";

const log = createLogger("model-router:fallback");

export class FallbackChain {
  private providers: ModelProvider[];

  constructor(providers: ModelProvider[]) {
    if (providers.length === 0) {
      throw new Error("FallbackChain requires at least one provider");
    }
    this.providers = providers;
  }

  async complete(request: ModelRequest): Promise<ModelResponse> {
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        log.debug({ provider: provider.name }, "Attempting completion");
        return await provider.complete(request);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log.warn(
          { provider: provider.name, error: lastError.message },
          "Provider failed, trying fallback",
        );
      }
    }

    throw lastError ?? new Error("All providers failed");
  }

  async *stream(request: ModelRequest): AsyncIterable<ModelStreamChunk> {
    let lastError: Error | null = null;

    for (const provider of this.providers) {
      try {
        log.debug({ provider: provider.name }, "Attempting stream");
        yield* provider.stream(request);
        return;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        log.warn(
          { provider: provider.name, error: lastError.message },
          "Provider stream failed, trying fallback",
        );
      }
    }

    throw lastError ?? new Error("All providers failed");
  }
}
