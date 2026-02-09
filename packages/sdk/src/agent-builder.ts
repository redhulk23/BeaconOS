import type { AgentManifestFile } from "./manifest/schema.js";
import type { AgentContext } from "./runtime/agent-context.js";

export type AgentHandler = (
  ctx: AgentContext,
  input: Record<string, unknown>,
) => Promise<Record<string, unknown>>;

export interface AgentDefinition {
  manifest: AgentManifestFile;
  handler: AgentHandler;
}

export function defineAgent(
  manifest: AgentManifestFile,
  handler: AgentHandler,
): AgentDefinition {
  return { manifest, handler };
}

export class AgentBuilder {
  private manifest: Partial<AgentManifestFile> = {
    apiVersion: "beacon-os/v1",
    metadata: { name: "", version: "0.1.0", tags: [] },
    spec: {
      model: {
        provider: "claude",
        model: "claude-sonnet-4-5-20250929",
        temperature: 0.7,
        maxTokens: 4096,
      },
      tools: [],
      memory: { shortTerm: true, longTerm: false },
      resources: {
        maxTokensPerRun: 100_000,
        maxStepsPerRun: 50,
        timeoutMs: 300_000,
      },
      permissions: [],
      guardrails: { piiDetection: true, contentFiltering: true },
    },
  };
  private _handler?: AgentHandler;

  static create(name: string): AgentBuilder {
    const builder = new AgentBuilder();
    builder.manifest.metadata = {
      name,
      version: "0.1.0",
      tags: [],
    };
    return builder;
  }

  version(version: string): this {
    this.manifest.metadata!.version = version;
    return this;
  }

  description(description: string): this {
    this.manifest.metadata!.description = description;
    return this;
  }

  tags(...tags: string[]): this {
    this.manifest.metadata!.tags = tags;
    return this;
  }

  model(model: string): this {
    this.manifest.spec!.model.model = model;
    return this;
  }

  temperature(temp: number): this {
    this.manifest.spec!.model.temperature = temp;
    return this;
  }

  systemPrompt(prompt: string): this {
    this.manifest.spec!.systemPrompt = prompt;
    return this;
  }

  withTool(...toolNames: string[]): this {
    this.manifest.spec!.tools.push(...toolNames);
    return this;
  }

  withPermission(...permissions: string[]): this {
    this.manifest.spec!.permissions.push(...permissions);
    return this;
  }

  maxSteps(max: number): this {
    this.manifest.spec!.resources.maxStepsPerRun = max;
    return this;
  }

  maxTokens(max: number): this {
    this.manifest.spec!.resources.maxTokensPerRun = max;
    return this;
  }

  timeout(ms: number): this {
    this.manifest.spec!.resources.timeoutMs = ms;
    return this;
  }

  handler(fn: AgentHandler): this {
    this._handler = fn;
    return this;
  }

  build(): AgentDefinition {
    if (!this.manifest.metadata?.name) {
      throw new Error("Agent name is required");
    }
    if (!this._handler) {
      throw new Error("Agent handler is required");
    }

    return defineAgent(this.manifest as AgentManifestFile, this._handler);
  }
}
