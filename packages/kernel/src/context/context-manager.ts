import type { ModelMessage, ModelToolDefinition } from "@beacon-os/common";
import type { MemoryManager } from "../memory/memory-manager.js";

export interface ContextWindow {
  messages: ModelMessage[];
  tools: ModelToolDefinition[];
  tokenEstimate: number;
}

export class ContextManager {
  private memoryManager: MemoryManager;
  private maxContextTokens: number;

  constructor(memoryManager: MemoryManager, maxContextTokens = 100_000) {
    this.memoryManager = memoryManager;
    this.maxContextTokens = maxContextTokens;
  }

  async buildContext(
    agentId: string,
    systemPrompt: string | undefined,
    userInput: string,
    conversationHistory: ModelMessage[],
    tools: ModelToolDefinition[],
  ): Promise<ContextWindow> {
    const messages: ModelMessage[] = [];

    // System prompt
    if (systemPrompt) {
      messages.push({ role: "system", content: systemPrompt });
    }

    // Memory context
    const memory = await this.memoryManager.getWorkingMemory(agentId);
    if (memory && Object.keys(memory).length > 0) {
      messages.push({
        role: "system",
        content: `Relevant context:\n${JSON.stringify(memory, null, 2)}`,
      });
    }

    // Conversation history (trimmed if needed)
    const trimmedHistory = this.trimHistory(conversationHistory);
    messages.push(...trimmedHistory);

    // User input
    messages.push({ role: "user", content: userInput });

    // Estimate tokens (rough: ~4 chars per token)
    const tokenEstimate = this.estimateTokens(messages, tools);

    return { messages, tools, tokenEstimate };
  }

  private trimHistory(history: ModelMessage[]): ModelMessage[] {
    // Keep last N messages that fit within context budget
    // Reserve ~30% of context for system prompt + response
    const budgetTokens = Math.floor(this.maxContextTokens * 0.5);
    let currentTokens = 0;
    const trimmed: ModelMessage[] = [];

    // Work backwards through history
    for (let i = history.length - 1; i >= 0; i--) {
      const msg = history[i]!;
      const msgTokens = this.estimateMessageTokens(msg);
      if (currentTokens + msgTokens > budgetTokens) break;
      currentTokens += msgTokens;
      trimmed.unshift(msg);
    }

    return trimmed;
  }

  private estimateTokens(
    messages: ModelMessage[],
    tools: ModelToolDefinition[],
  ): number {
    let tokens = 0;
    for (const msg of messages) {
      tokens += this.estimateMessageTokens(msg);
    }
    // Tool definitions ~100 tokens each
    tokens += tools.length * 100;
    return tokens;
  }

  private estimateMessageTokens(msg: ModelMessage): number {
    // Rough estimate: ~4 chars per token + overhead
    return Math.ceil(msg.content.length / 4) + 10;
  }
}
