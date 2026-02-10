import { createLogger, generateId } from "@beacon-os/common";
import { getDb, getRedis, memoryEntries } from "@beacon-os/db";
import { eq, and } from "drizzle-orm";

const log = createLogger("kernel:memory");
const REDIS_PREFIX = "beacon:memory";
const SHORT_TERM_TTL = 3600; // 1 hour

export class MemoryManager {
  // Tier 1: Working memory (in-process Map)
  private workingMemory: Map<string, Record<string, unknown>> = new Map();

  // --- Tier 1: Working Memory (in-process) ---

  async getWorkingMemory(
    agentId: string,
  ): Promise<Record<string, unknown> | null> {
    return this.workingMemory.get(agentId) ?? null;
  }

  async setWorkingMemory(
    agentId: string,
    data: Record<string, unknown>,
  ): Promise<void> {
    const existing = this.workingMemory.get(agentId) ?? {};
    this.workingMemory.set(agentId, { ...existing, ...data });
  }

  clearWorkingMemory(agentId: string): void {
    this.workingMemory.delete(agentId);
  }

  // --- Tier 2: Short-term Memory (Redis) ---

  async getShortTerm(agentId: string, key: string): Promise<unknown | null> {
    const redis = getRedis();
    const redisKey = `${REDIS_PREFIX}:${agentId}:${key}`;
    const value = await redis.get(redisKey);
    if (!value) return null;
    try {
      return JSON.parse(value);
    } catch {
      return value;
    }
  }

  async setShortTerm(
    agentId: string,
    key: string,
    value: unknown,
    ttlSeconds = SHORT_TERM_TTL,
  ): Promise<void> {
    const redis = getRedis();
    const redisKey = `${REDIS_PREFIX}:${agentId}:${key}`;
    const serialized = JSON.stringify(value);
    await redis.setex(redisKey, ttlSeconds, serialized);
  }

  async deleteShortTerm(agentId: string, key: string): Promise<void> {
    const redis = getRedis();
    const redisKey = `${REDIS_PREFIX}:${agentId}:${key}`;
    await redis.del(redisKey);
  }

  // --- Tier 3: Long-term Memory (Postgres) ---

  async getLongTerm(agentId: string, key: string): Promise<unknown | null> {
    const db = getDb();
    const result = await db
      .select()
      .from(memoryEntries)
      .where(
        and(eq(memoryEntries.agentId, agentId), eq(memoryEntries.key, key)),
      )
      .then((rows) => rows[0]);

    if (!result) return null;

    // Check expiration
    if (result.expiresAt && result.expiresAt < new Date()) {
      await this.deleteLongTerm(agentId, key);
      return null;
    }

    return result.value;
  }

  async setLongTerm(
    agentId: string,
    tenantId: string,
    key: string,
    value: unknown,
    expiresAt?: Date,
  ): Promise<void> {
    const db = getDb();

    // Upsert
    const existing = await db
      .select()
      .from(memoryEntries)
      .where(
        and(eq(memoryEntries.agentId, agentId), eq(memoryEntries.key, key)),
      )
      .then((rows) => rows[0]);

    if (existing) {
      await db
        .update(memoryEntries)
        .set({
          value: value as Record<string, unknown>,
          expiresAt,
          updatedAt: new Date(),
        })
        .where(eq(memoryEntries.id, existing.id));
    } else {
      await db.insert(memoryEntries).values({
        id: generateId(),
        tenantId,
        agentId,
        key,
        value: value as Record<string, unknown>,
        expiresAt,
      });
    }
  }

  async deleteLongTerm(agentId: string, key: string): Promise<void> {
    const db = getDb();
    await db
      .delete(memoryEntries)
      .where(
        and(eq(memoryEntries.agentId, agentId), eq(memoryEntries.key, key)),
      );
  }

  // --- Unified interface ---

  async get(agentId: string, key: string): Promise<unknown | null> {
    // Check working memory first
    const working = this.workingMemory.get(agentId);
    if (working && key in working) return working[key];

    // Then short-term (Redis)
    const shortTerm = await this.getShortTerm(agentId, key);
    if (shortTerm !== null) return shortTerm;

    // Finally long-term (Postgres)
    return this.getLongTerm(agentId, key);
  }

  async set(
    agentId: string,
    tenantId: string,
    key: string,
    value: unknown,
    tier: "working" | "short" | "long" = "short",
  ): Promise<void> {
    switch (tier) {
      case "working":
        await this.setWorkingMemory(agentId, { [key]: value });
        break;
      case "short":
        await this.setShortTerm(agentId, key, value);
        break;
      case "long":
        await this.setLongTerm(agentId, tenantId, key, value);
        break;
    }
  }
}
