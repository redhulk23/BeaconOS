import {
  createLogger,
  ValidationError,
  type ToolResult,
  generateId,
  elapsed,
  nowMs,
} from "@beacon-os/common";
import { getAuditLogger } from "@beacon-os/audit";
import type { ToolRegistry, RegisteredTool } from "./registry.js";
import { checkToolPermission } from "./permissions.js";

const log = createLogger("tools:executor");

export class ToolExecutor {
  private registry: ToolRegistry;

  constructor(registry: ToolRegistry) {
    this.registry = registry;
  }

  async execute(
    tenantId: string,
    toolName: string,
    input: unknown,
    context: {
      agentId: string;
      runId: string;
      agentPermissions: string[];
    },
  ): Promise<ToolResult> {
    const startMs = nowMs();
    const tool = this.registry.get(tenantId, toolName);

    if (!tool) {
      return {
        success: false,
        output: null,
        durationMs: 0,
        error: `Tool "${toolName}" not found`,
      };
    }

    // Permission check
    if (!checkToolPermission(tool, context.agentPermissions)) {
      const audit = getAuditLogger();
      await audit.log({
        tenantId,
        action: "tool.invoked",
        actorId: context.agentId,
        actorType: "agent",
        resourceType: "tool",
        resourceId: tool.id,
        metadata: {
          toolName,
          denied: true,
          reason: "insufficient permissions",
        },
      });

      return {
        success: false,
        output: null,
        durationMs: 0,
        error: `Permission denied for tool "${toolName}"`,
      };
    }

    // Validate input
    const validation = tool.inputSchema.safeParse(input);
    if (!validation.success) {
      return {
        success: false,
        output: null,
        durationMs: elapsed(startMs),
        error: `Input validation failed: ${validation.error.message}`,
      };
    }

    // Audit: tool invoked
    const audit = getAuditLogger();
    await audit.log({
      tenantId,
      action: "tool.invoked",
      actorId: context.agentId,
      actorType: "agent",
      resourceType: "tool",
      resourceId: tool.id,
      metadata: { toolName, runId: context.runId },
    });

    // Execute with timeout
    try {
      const output = await executeWithTimeout(
        () => tool.execute(validation.data),
        tool.timeoutMs,
      );
      const durationMs = elapsed(startMs);

      // Validate output if schema exists
      if (tool.outputSchema) {
        const outValidation = tool.outputSchema.safeParse(output);
        if (!outValidation.success) {
          log.warn(
            { toolName, error: outValidation.error.message },
            "Tool output validation failed",
          );
        }
      }

      // Audit: tool completed
      await audit.log({
        tenantId,
        action: "tool.completed",
        actorId: context.agentId,
        actorType: "agent",
        resourceType: "tool",
        resourceId: tool.id,
        metadata: { toolName, runId: context.runId, durationMs, success: true },
      });

      log.debug({ toolName, durationMs }, "Tool executed successfully");

      return {
        success: true,
        output,
        durationMs,
      };
    } catch (error) {
      const durationMs = elapsed(startMs);
      const message = error instanceof Error ? error.message : String(error);

      await audit.log({
        tenantId,
        action: "tool.completed",
        actorId: context.agentId,
        actorType: "agent",
        resourceType: "tool",
        resourceId: tool.id,
        metadata: {
          toolName,
          runId: context.runId,
          durationMs,
          success: false,
          error: message,
        },
      });

      log.error(
        { toolName, durationMs, error: message },
        "Tool execution failed",
      );

      return {
        success: false,
        output: null,
        durationMs,
        error: message,
      };
    }
  }
}

async function executeWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(
        () =>
          reject(new Error(`Tool execution timed out after ${timeoutMs}ms`)),
        timeoutMs,
      ),
    ),
  ]);
}
