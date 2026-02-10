import { generateId, computeAuditHash, createLogger } from "@beacon-os/common";
import { getDb, auditLogs } from "@beacon-os/db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import { redactObjectPii, detectPii } from "./pii.js";
import type { AuditAction } from "@beacon-os/common";

const log = createLogger("audit");

const AUDIT_HMAC_SECRET =
  process.env.AUDIT_HMAC_SECRET ?? process.env.JWT_SECRET ?? "audit-secret";

export interface AuditLogInput {
  tenantId: string;
  action: AuditAction;
  actorId: string;
  actorType: "user" | "agent" | "system";
  resourceType: string;
  resourceId: string;
  metadata?: Record<string, unknown>;
}

export interface AuditQueryOptions {
  tenantId: string;
  action?: AuditAction;
  actorId?: string;
  resourceType?: string;
  resourceId?: string;
  from?: Date;
  to?: Date;
  limit?: number;
  offset?: number;
}

export class AuditLogger {
  private lastHash: string | null = null;

  async log(input: AuditLogInput): Promise<string> {
    const db = getDb();
    const id = generateId();
    const now = new Date();

    // Redact PII from metadata
    const metadata = input.metadata ? redactObjectPii(input.metadata) : {};

    // Check for PII in metadata and log warning
    if (input.metadata) {
      const raw = JSON.stringify(input.metadata);
      const piiMatches = detectPii(raw);
      if (piiMatches.length > 0) {
        log.warn(
          { piiTypes: piiMatches.map((m) => m.type), action: input.action },
          "PII detected and redacted in audit log",
        );
      }
    }

    // Compute HMAC integrity hash
    const hash = computeAuditHash(
      this.lastHash,
      input.action,
      metadata,
      now,
      AUDIT_HMAC_SECRET,
    );

    await db.insert(auditLogs).values({
      id,
      tenantId: input.tenantId,
      action: input.action,
      actorId: input.actorId,
      actorType: input.actorType,
      resourceType: input.resourceType,
      resourceId: input.resourceId,
      metadata,
      previousHash: this.lastHash,
      hash,
      createdAt: now,
    });

    this.lastHash = hash;

    log.debug(
      {
        id,
        action: input.action,
        resourceType: input.resourceType,
        resourceId: input.resourceId,
      },
      "Audit event logged",
    );

    return id;
  }

  async query(options: AuditQueryOptions) {
    const db = getDb();
    const conditions = [eq(auditLogs.tenantId, options.tenantId)];

    if (options.action) conditions.push(eq(auditLogs.action, options.action));
    if (options.actorId)
      conditions.push(eq(auditLogs.actorId, options.actorId));
    if (options.resourceType)
      conditions.push(eq(auditLogs.resourceType, options.resourceType));
    if (options.resourceId)
      conditions.push(eq(auditLogs.resourceId, options.resourceId));
    if (options.from) conditions.push(gte(auditLogs.createdAt, options.from));
    if (options.to) conditions.push(lte(auditLogs.createdAt, options.to));

    const results = await db
      .select()
      .from(auditLogs)
      .where(and(...conditions))
      .orderBy(desc(auditLogs.createdAt))
      .limit(options.limit ?? 50)
      .offset(options.offset ?? 0);

    return results;
  }

  async verifyIntegrity(tenantId: string, limit = 100): Promise<boolean> {
    const db = getDb();
    const entries = await db
      .select()
      .from(auditLogs)
      .where(eq(auditLogs.tenantId, tenantId))
      .orderBy(auditLogs.createdAt)
      .limit(limit);

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i]!;
      const expectedHash = computeAuditHash(
        entry.previousHash,
        entry.action,
        (entry.metadata ?? {}) as Record<string, unknown>,
        entry.createdAt,
        AUDIT_HMAC_SECRET,
      );
      if (entry.hash !== expectedHash) {
        log.error(
          { id: entry.id, expected: expectedHash, actual: entry.hash },
          "Audit integrity violation",
        );
        return false;
      }
    }

    return true;
  }
}

// Singleton instance
let _auditLogger: AuditLogger | null = null;

export function getAuditLogger(): AuditLogger {
  if (!_auditLogger) {
    _auditLogger = new AuditLogger();
  }
  return _auditLogger;
}
