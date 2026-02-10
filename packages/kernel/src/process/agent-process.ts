import {
  createLogger,
  type RunId,
  type AgentId,
  type TenantId,
  type RunStatus,
  type StepType,
  type ModelMessage,
  type ModelRequest,
  type ModelToolDefinition,
  generateStepId,
} from "@beacon-os/common";
import { ModelRouter } from "@beacon-os/model-router";
import type { MemoryManager } from "../memory/memory-manager.js";
import type { ResourceManager } from "../resource/resource-manager.js";

const log = createLogger("kernel:process");

export interface AgentProcessConfig {
  runId: RunId;
  agentId: AgentId;
  tenantId: TenantId;
  model: string;
  systemPrompt?: string;
  tools?: ModelToolDefinition[];
  maxSteps: number;
  maxTokens: number;
  temperature: number;
  timeoutMs: number;
}

export interface StepRecord {
  id: string;
  stepNumber: number;
  type: StepType;
  input: Record<string, unknown>;
  output: Record<string, unknown>;
  tokensUsed: number;
  durationMs: number;
}

export type ProcessStatus =
  | "idle"
  | "running"
  | "suspended"
  | "completed"
  | "failed";

export class AgentProcess {
  readonly config: AgentProcessConfig;
  private status: ProcessStatus = "idle";
  private steps: StepRecord[] = [];
  private messages: ModelMessage[] = [];
  private totalTokens = 0;
  private modelRouter: ModelRouter;
  private memoryManager: MemoryManager;
  private resourceManager: ResourceManager;
  private abortController: AbortController;

  constructor(
    config: AgentProcessConfig,
    modelRouter: ModelRouter,
    memoryManager: MemoryManager,
    resourceManager: ResourceManager,
  ) {
    this.config = config;
    this.modelRouter = modelRouter;
    this.memoryManager = memoryManager;
    this.resourceManager = resourceManager;
    this.abortController = new AbortController();

    // Initialize with system prompt
    if (config.systemPrompt) {
      this.messages.push({ role: "system", content: config.systemPrompt });
    }
  }

  async run(input: Record<string, unknown>): Promise<{
    status: RunStatus;
    output: Record<string, unknown> | null;
    steps: StepRecord[];
    totalTokens: number;
  }> {
    this.status = "running";

    // Load memory context
    const memoryContext = await this.memoryManager.getWorkingMemory(
      this.config.agentId,
    );
    if (memoryContext) {
      this.messages.push({
        role: "system",
        content: `Context from memory:\n${JSON.stringify(memoryContext)}`,
      });
    }

    // Add user input
    this.messages.push({
      role: "user",
      content: JSON.stringify(input),
    });

    const startMs = Date.now();
    let stepNumber = 0;

    try {
      // Agent loop — iterate until completion or limit
      while (stepNumber < this.config.maxSteps) {
        if (this.abortController.signal.aborted) {
          this.status = "failed";
          return {
            status: "cancelled",
            output: null,
            steps: this.steps,
            totalTokens: this.totalTokens,
          };
        }

        // Check timeout
        if (Date.now() - startMs > this.config.timeoutMs) {
          this.status = "failed";
          return {
            status: "failed",
            output: { error: "Timeout exceeded" },
            steps: this.steps,
            totalTokens: this.totalTokens,
          };
        }

        // Check token budget
        const withinBudget = await this.resourceManager.checkTokenBudget(
          this.config.tenantId,
          this.config.maxTokens - this.totalTokens,
        );
        if (!withinBudget) {
          this.status = "failed";
          return {
            status: "failed",
            output: { error: "Token budget exceeded" },
            steps: this.steps,
            totalTokens: this.totalTokens,
          };
        }

        stepNumber++;
        const stepStart = Date.now();

        // Make model call
        const request: ModelRequest = {
          provider: "claude",
          model: this.config.model,
          messages: this.messages,
          maxTokens: Math.min(4096, this.config.maxTokens - this.totalTokens),
          temperature: this.config.temperature,
          tools: this.config.tools,
        };

        const response = await this.modelRouter.complete(request, {
          tenantId: this.config.tenantId,
          agentId: this.config.agentId,
          runId: this.config.runId,
        });

        this.totalTokens += response.usage.totalTokens;

        // Record model call step
        const modelStep: StepRecord = {
          id: generateStepId(),
          stepNumber,
          type: "model_call",
          input: { messageCount: this.messages.length },
          output: {
            content: response.content,
            finishReason: response.finishReason,
            toolCalls: response.toolCalls,
          },
          tokensUsed: response.usage.totalTokens,
          durationMs: Date.now() - stepStart,
        };
        this.steps.push(modelStep);

        // Add assistant response to messages
        this.messages.push({
          role: "assistant",
          content: response.content,
        });

        // Check if done (no tool calls)
        if (
          response.finishReason === "end_turn" ||
          !response.toolCalls?.length
        ) {
          this.status = "completed";

          // Save to memory
          await this.memoryManager.setWorkingMemory(this.config.agentId, {
            lastOutput: response.content,
          });

          return {
            status: "completed",
            output: { content: response.content },
            steps: this.steps,
            totalTokens: this.totalTokens,
          };
        }

        // Process tool calls — for now just record them as steps
        // (actual tool execution is handled in Sprint 3 with the tools package)
        if (response.toolCalls) {
          for (const toolCall of response.toolCalls) {
            stepNumber++;
            const toolStep: StepRecord = {
              id: generateStepId(),
              stepNumber,
              type: "tool_call",
              input: { tool: toolCall.name, args: toolCall.input },
              output: {
                result: `Tool "${toolCall.name}" execution placeholder — tool system not yet connected`,
              },
              tokensUsed: 0,
              durationMs: 0,
            };
            this.steps.push(toolStep);

            // Add tool result to messages so the model can continue
            this.messages.push({
              role: "tool_result",
              content: JSON.stringify({
                result: `Tool "${toolCall.name}" executed successfully (placeholder)`,
              }),
              toolCallId: toolCall.id,
              toolName: toolCall.name,
            });
          }
        }
      }

      // Exceeded max steps
      this.status = "failed";
      return {
        status: "failed",
        output: { error: "Maximum steps exceeded" },
        steps: this.steps,
        totalTokens: this.totalTokens,
      };
    } catch (error) {
      this.status = "failed";
      const message = error instanceof Error ? error.message : String(error);
      log.error(
        { runId: this.config.runId, error: message },
        "Agent process failed",
      );

      const errorStep: StepRecord = {
        id: generateStepId(),
        stepNumber: stepNumber + 1,
        type: "error",
        input: {},
        output: { error: message },
        tokensUsed: 0,
        durationMs: Date.now() - startMs,
      };
      this.steps.push(errorStep);

      return {
        status: "failed",
        output: { error: message },
        steps: this.steps,
        totalTokens: this.totalTokens,
      };
    }
  }

  suspend(): void {
    this.status = "suspended";
  }

  terminate(): void {
    this.abortController.abort();
    this.status = "failed";
  }

  getStatus(): ProcessStatus {
    return this.status;
  }

  getSteps(): StepRecord[] {
    return [...this.steps];
  }

  getTotalTokens(): number {
    return this.totalTokens;
  }
}
