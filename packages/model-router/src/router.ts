import { createLogger } from "@beacon-os/common";
import type {
  ModelRequest,
  ModelResponse,
  ModelStreamChunk,
} from "@beacon-os/common";
import type { ModelProvider } from "./providers/base.js";
import { ClaudeProvider } from "./providers/claude.js";
import { OpenAIProvider } from "./providers/openai.js";
import { GoogleProvider } from "./providers/google.js";
import { TokenTracker } from "./token-tracker.js";
import { FallbackChain } from "./fallback.js";
import { getAuditLogger } from "@beacon-os/audit";

const log = createLogger("model-router");

export interface RoutingRule {
  match: (request: ModelRequest) => boolean;
  provider: string;
}

export interface ModelRouterConfig {
  defaultProvider?: string;
  rules?: RoutingRule[];
  providers?: Record<string, ModelProvider>;
}

export class ModelRouter {
  private providers: Map<string, ModelProvider> = new Map();
  private rules: RoutingRule[];
  private defaultProvider: string;
  private tokenTracker: TokenTracker;
  private fallbackChain: FallbackChain | null = null;

  constructor(config: ModelRouterConfig = {}) {
    this.defaultProvider = config.defaultProvider ?? "claude";
    this.rules = config.rules ?? [];
    this.tokenTracker = new TokenTracker();

    // Register default Claude provider
    if (!config.providers?.claude) {
      this.providers.set("claude", new ClaudeProvider());
    }

    // Auto-register OpenAI if API key available
    if (!config.providers?.openai && process.env.OPENAI_API_KEY) {
      this.providers.set("openai", new OpenAIProvider());
    }

    // Auto-register Google if API key available
    if (!config.providers?.google && process.env.GOOGLE_AI_API_KEY) {
      this.providers.set("google", new GoogleProvider());
    }

    // Register custom providers
    if (config.providers) {
      for (const [name, provider] of Object.entries(config.providers)) {
        this.providers.set(name, provider);
      }
    }

    // Build fallback chain from all providers
    const allProviders = Array.from(this.providers.values());
    if (allProviders.length > 1) {
      this.fallbackChain = new FallbackChain(allProviders);
    }
  }

  registerProvider(name: string, provider: ModelProvider): void {
    this.providers.set(name, provider);
  }

  async complete(
    request: ModelRequest,
    context?: { tenantId: string; agentId: string; runId?: string },
  ): Promise<ModelResponse> {
    const provider = this.resolveProvider(request);
    const startMs = Date.now();

    log.debug(
      {
        provider: provider.name,
        model: request.model,
        tenantId: context?.tenantId,
        agentId: context?.agentId,
      },
      "Model call starting",
    );

    // Audit: model call started
    if (context) {
      const audit = getAuditLogger();
      await audit.log({
        tenantId: context.tenantId,
        action: "model.call.started",
        actorId: context.agentId,
        actorType: "agent",
        resourceType: "model",
        resourceId: request.model,
        metadata: {
          provider: provider.name,
          model: request.model,
          runId: context.runId,
          messageCount: request.messages.length,
          toolCount: request.tools?.length ?? 0,
        },
      });
    }

    try {
      const response = await provider.complete(request);
      const durationMs = Date.now() - startMs;

      // Track tokens
      if (context) {
        await this.tokenTracker.track(
          context.tenantId,
          context.agentId,
          response.usage,
        );

        // Audit: model call completed
        const audit = getAuditLogger();
        await audit.log({
          tenantId: context.tenantId,
          action: "model.call.completed",
          actorId: context.agentId,
          actorType: "agent",
          resourceType: "model",
          resourceId: request.model,
          metadata: {
            runId: context.runId,
            durationMs,
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            finishReason: response.finishReason,
            toolCallCount: response.toolCalls?.length ?? 0,
          },
        });
      }

      log.debug(
        {
          durationMs,
          tokens: response.usage.totalTokens,
          finishReason: response.finishReason,
        },
        "Model call completed",
      );

      return response;
    } catch (error) {
      // Try fallback if available
      if (this.fallbackChain) {
        log.warn(
          { provider: provider.name, error: String(error) },
          "Primary provider failed, using fallback chain",
        );
        return this.fallbackChain.complete(request);
      }
      throw error;
    }
  }

  async *stream(
    request: ModelRequest,
    context?: { tenantId: string; agentId: string; runId?: string },
  ): AsyncIterable<ModelStreamChunk> {
    const provider = this.resolveProvider(request);

    log.debug(
      { provider: provider.name, model: request.model },
      "Model stream starting",
    );

    if (context) {
      const audit = getAuditLogger();
      await audit.log({
        tenantId: context.tenantId,
        action: "model.call.started",
        actorId: context.agentId,
        actorType: "agent",
        resourceType: "model",
        resourceId: request.model,
        metadata: {
          provider: provider.name,
          model: request.model,
          runId: context.runId,
          streaming: true,
        },
      });
    }

    for await (const chunk of provider.stream(request)) {
      // Track usage from final chunk
      if (chunk.type === "done" && chunk.usage && context) {
        await this.tokenTracker.track(
          context.tenantId,
          context.agentId,
          chunk.usage,
        );

        const audit = getAuditLogger();
        await audit.log({
          tenantId: context.tenantId,
          action: "model.call.completed",
          actorId: context.agentId,
          actorType: "agent",
          resourceType: "model",
          resourceId: request.model,
          metadata: {
            runId: context.runId,
            streaming: true,
            inputTokens: chunk.usage.inputTokens,
            outputTokens: chunk.usage.outputTokens,
          },
        });
      }
      yield chunk;
    }
  }

  getTokenTracker(): TokenTracker {
    return this.tokenTracker;
  }

  private resolveProvider(request: ModelRequest): ModelProvider {
    // Check explicit provider in request
    if (request.provider) {
      const provider = this.providers.get(request.provider);
      if (provider) return provider;
    }

    // Check routing rules
    for (const rule of this.rules) {
      if (rule.match(request)) {
        const provider = this.providers.get(rule.provider);
        if (provider) return provider;
      }
    }

    // Default provider
    const provider = this.providers.get(this.defaultProvider);
    if (!provider) {
      throw new Error(`Default provider "${this.defaultProvider}" not found`);
    }
    return provider;
  }
}
