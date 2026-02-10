import {
  createLogger,
  type AgentId,
  type TenantId,
  type RunId,
  type ModelMessage,
  type ModelRequest,
} from "@beacon-os/common";
import { ModelRouter } from "@beacon-os/model-router";
import { MemoryManager } from "@beacon-os/kernel";
import { ToolExecutor, ToolRegistry } from "@beacon-os/tools";
import type {
  AgentContext,
  ModelProxy,
  ToolProxy,
  MemoryProxy,
  HitlProxy,
} from "./agent-context.js";
import type { AgentManifestFile } from "../manifest/schema.js";

export function createAgentContext(
  manifest: AgentManifestFile,
  runId: string,
  tenantId: string,
  agentId: string,
  deps: {
    modelRouter: ModelRouter;
    memoryManager: MemoryManager;
    toolRegistry: ToolRegistry;
    toolExecutor: ToolExecutor;
  },
): AgentContext {
  const log = createLogger("agent:" + manifest.metadata.name, {
    agentId,
    runId,
    tenantId,
  });

  const modelProxy: ModelProxy = {
    async complete(messages, options) {
      const request: ModelRequest = {
        provider: manifest.spec.model.provider as "claude",
        model: manifest.spec.model.model,
        messages: messages.map((m) => ({
          role: m.role as ModelMessage["role"],
          content: m.content,
        })),
        maxTokens: options?.maxTokens ?? manifest.spec.model.maxTokens,
        temperature: options?.temperature ?? manifest.spec.model.temperature,
      };
      return deps.modelRouter.complete(request, { tenantId, agentId, runId });
    },
    async *stream(messages, options) {
      const request: ModelRequest = {
        provider: manifest.spec.model.provider as "claude",
        model: manifest.spec.model.model,
        messages: messages.map((m) => ({
          role: m.role as ModelMessage["role"],
          content: m.content,
        })),
        maxTokens: options?.maxTokens ?? manifest.spec.model.maxTokens,
        temperature: options?.temperature ?? manifest.spec.model.temperature,
        stream: true,
      };
      yield* deps.modelRouter.stream(request, { tenantId, agentId, runId });
    },
  };

  const toolProxy: ToolProxy = {
    async invoke(toolName, input) {
      const result = await deps.toolExecutor.execute(
        tenantId,
        toolName,
        input,
        {
          agentId,
          runId,
          agentPermissions: manifest.spec.permissions,
        },
      );
      if (!result.success) {
        throw new Error(result.error ?? "Tool execution failed");
      }
      return result.output;
    },
    list() {
      return manifest.spec.tools;
    },
  };

  const memoryProxy: MemoryProxy = {
    async get(key) {
      return deps.memoryManager.get(agentId, key);
    },
    async set(key, value, tier = "short") {
      return deps.memoryManager.set(agentId, tenantId, key, value, tier);
    },
    async delete(key) {
      await deps.memoryManager.deleteShortTerm(agentId, key);
    },
  };

  const hitlProxy: HitlProxy = {
    async requestApproval(request) {
      // HITL placeholder — full implementation in Sprint 4 with orchestrator
      log.info(
        { title: request.title },
        "HITL approval requested (placeholder)",
      );
      return { approved: true, note: "Auto-approved (HITL not yet connected)" };
    },
  };

  const events: { event: string; data?: Record<string, unknown> }[] = [];

  return {
    agentId,
    runId,
    tenantId,
    model: modelProxy,
    tools: toolProxy,
    memory: memoryProxy,
    log,
    hitl: hitlProxy,
    emit(event, data) {
      events.push({ event, data });
      log.debug({ event, data }, "Event emitted");
    },
  };
}
