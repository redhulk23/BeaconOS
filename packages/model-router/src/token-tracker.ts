import { getRedis } from "@beacon-os/db";
import type { ModelUsage } from "@beacon-os/common";

const KEY_PREFIX = "beacon:tokens";
const WINDOW_SECONDS = 3600; // 1 hour windows

export class TokenTracker {
  async track(
    tenantId: string,
    agentId: string,
    usage: ModelUsage,
  ): Promise<void> {
    const redis = getRedis();
    const now = Math.floor(Date.now() / 1000);
    const window = Math.floor(now / WINDOW_SECONDS) * WINDOW_SECONDS;

    const pipeline = redis.pipeline();

    // Track per-tenant
    const tenantKey = `${KEY_PREFIX}:tenant:${tenantId}:${window}`;
    pipeline.incrby(tenantKey, usage.totalTokens);
    pipeline.expire(tenantKey, WINDOW_SECONDS * 24); // Keep 24 hours

    // Track per-agent
    const agentKey = `${KEY_PREFIX}:agent:${agentId}:${window}`;
    pipeline.incrby(agentKey, usage.totalTokens);
    pipeline.expire(agentKey, WINDOW_SECONDS * 24);

    // Track totals
    const totalKey = `${KEY_PREFIX}:total:${tenantId}`;
    pipeline.incrby(totalKey, usage.totalTokens);

    // Track input/output separately
    const detailKey = `${KEY_PREFIX}:detail:${agentId}:${window}`;
    pipeline.hincrby(detailKey, "input", usage.inputTokens);
    pipeline.hincrby(detailKey, "output", usage.outputTokens);
    pipeline.expire(detailKey, WINDOW_SECONDS * 24);

    await pipeline.exec();
  }

  async getUsage(
    tenantId: string,
    windowCount = 1,
  ): Promise<{ tokens: number; windows: number }> {
    const redis = getRedis();
    const now = Math.floor(Date.now() / 1000);
    let total = 0;

    for (let i = 0; i < windowCount; i++) {
      const window =
        Math.floor(now / WINDOW_SECONDS) * WINDOW_SECONDS - i * WINDOW_SECONDS;
      const key = `${KEY_PREFIX}:tenant:${tenantId}:${window}`;
      const val = await redis.get(key);
      if (val) total += parseInt(val, 10);
    }

    return { tokens: total, windows: windowCount };
  }

  async getAgentUsage(
    agentId: string,
    windowCount = 1,
  ): Promise<{ input: number; output: number; total: number }> {
    const redis = getRedis();
    const now = Math.floor(Date.now() / 1000);
    let input = 0;
    let output = 0;

    for (let i = 0; i < windowCount; i++) {
      const window =
        Math.floor(now / WINDOW_SECONDS) * WINDOW_SECONDS - i * WINDOW_SECONDS;
      const key = `${KEY_PREFIX}:detail:${agentId}:${window}`;
      const data = await redis.hgetall(key);
      if (data.input) input += parseInt(data.input, 10);
      if (data.output) output += parseInt(data.output, 10);
    }

    return { input, output, total: input + output };
  }

  async checkBudget(
    tenantId: string,
    maxTokensPerHour: number,
  ): Promise<boolean> {
    const usage = await this.getUsage(tenantId, 1);
    return usage.tokens < maxTokensPerHour;
  }
}
