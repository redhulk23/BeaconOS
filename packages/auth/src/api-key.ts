import { randomBytes } from "node:crypto";
import bcrypt from "bcrypt";
import { eq, and, isNull } from "drizzle-orm";
import { getDb, apiKeys } from "@beacon-os/db";
import { generateApiKeyId } from "@beacon-os/common";

const BCRYPT_ROUNDS = 12;
const KEY_PREFIX_LENGTH = 8;

export interface ApiKeyCreateResult {
  id: string;
  key: string; // Only returned once at creation time
  prefix: string;
}

export async function createApiKey(
  tenantId: string,
  userId: string,
  name: string,
  permissions: string[],
  expiresAt?: Date,
): Promise<ApiKeyCreateResult> {
  const db = getDb();
  const id = generateApiKeyId();
  const rawKey = `bos_${randomBytes(32).toString("hex")}`;
  const prefix = rawKey.slice(0, KEY_PREFIX_LENGTH);
  const keyHash = await bcrypt.hash(rawKey, BCRYPT_ROUNDS);

  await db.insert(apiKeys).values({
    id,
    tenantId,
    userId,
    name,
    keyHash,
    keyPrefix: prefix,
    permissions,
    expiresAt,
  });

  return { id, key: rawKey, prefix };
}

export interface ValidatedApiKey {
  id: string;
  tenantId: string;
  userId: string;
  permissions: string[];
}

export async function validateApiKey(
  key: string,
): Promise<ValidatedApiKey | null> {
  const db = getDb();
  const prefix = key.slice(0, KEY_PREFIX_LENGTH);

  const candidates = await db
    .select()
    .from(apiKeys)
    .where(and(eq(apiKeys.keyPrefix, prefix), isNull(apiKeys.revokedAt)));

  for (const candidate of candidates) {
    const valid = await bcrypt.compare(key, candidate.keyHash);
    if (valid) {
      // Check expiration
      if (candidate.expiresAt && candidate.expiresAt < new Date()) {
        return null;
      }

      // Update last used
      await db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, candidate.id));

      return {
        id: candidate.id,
        tenantId: candidate.tenantId,
        userId: candidate.userId,
        permissions: (candidate.permissions ?? []) as string[],
      };
    }
  }

  return null;
}

export async function revokeApiKey(
  id: string,
  tenantId: string,
): Promise<boolean> {
  const db = getDb();
  const result = await db
    .update(apiKeys)
    .set({ revokedAt: new Date() })
    .where(and(eq(apiKeys.id, id), eq(apiKeys.tenantId, tenantId)));

  return (result.rowCount ?? 0) > 0;
}
