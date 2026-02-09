import { createHmac } from "node:crypto";

export function hmacSha256(data: string, secret: string): string {
  return createHmac("sha256", secret).update(data).digest("hex");
}

export function computeAuditHash(
  previousHash: string | null,
  action: string,
  metadata: Record<string, unknown>,
  timestamp: Date,
  secret: string,
): string {
  const payload = JSON.stringify({
    previousHash,
    action,
    metadata,
    timestamp: timestamp.toISOString(),
  });
  return hmacSha256(payload, secret);
}
