import { createLogger, RateLimitError, ResourceExhaustedError } from "@beacon-os/common";
import { getRedis } from "@beacon-os/db";
import { TokenTracker } from "@beacon-os/model-router";

const log = createLogger("kernel:resource");
const RATE_LIMIT_PREFIX = "beacon:ratelimit";

export interface ResourceLimits {
  maxTokensPerHour: number;
  maxRunsPerHour: number;
  maxConcurrentRuns: number;
}

const DEFAULT_LIMITS: ResourceLimits = {
  maxTokensPerHour: 1_000_000,
  maxRunsPerHour: 100,
  maxConcurrentRuns: 10,
};

export class ResourceManager {
  private limits: ResourceLimits;
  private tokenTracker: TokenTracker;

  constructor(limits?: Partial<ResourceLimits>, tokenTracker?: TokenTracker) {
    this.limits = { ...DEFAULT_LIMITS, ...limits };
    this.tokenTracker = tokenTracker ?? new TokenTracker();
  }

  async checkTokenBudget(tenantId: string, requiredTokens: number): Promise<boolean> {
    const usage = await this.tokenTracker.getUsage(tenantId, 1);
    const remaining = this.limits.maxTokensPerHour - usage.tokens;

    if (remaining < requiredTokens) {
      log.warn(
        { tenantId, used: usage.tokens, limit: this.limits.maxTokensPerHour },
        "Token budget exceeded",
      );
      return false;
    }

    return true;
  }

  async checkRateLimit(tenantId: string): Promise<boolean> {
    const redis = getRedis();
    const now = Math.floor(Date.now() / 1000);
    const windowKey = `${RATE_LIMIT_PREFIX}:runs:${tenantId}:${Math.floor(now / 3600) * 3600}`;

    const count = await redis.incr(windowKey);
    if (count === 1) {
      await redis.expire(windowKey, 3600);
    }

    if (count > this.limits.maxRunsPerHour) {
      log.warn(
        { tenantId, count, limit: this.limits.maxRunsPerHour },
        "Run rate limit exceeded",
      );
      return false;
    }

    return true;
  }

  async enforceRateLimit(tenantId: string): Promise<void> {
    const allowed = await this.checkRateLimit(tenantId);
    if (!allowed) {
      throw new RateLimitError(`Rate limit exceeded: max ${this.limits.maxRunsPerHour} runs/hour`);
    }
  }

  async enforceTokenBudget(tenantId: string, requiredTokens: number): Promise<void> {
    const allowed = await this.checkTokenBudget(tenantId, requiredTokens);
    if (!allowed) {
      throw new ResourceExhaustedError("token budget");
    }
  }

  getLimits(): ResourceLimits {
    return { ...this.limits };
  }
}
