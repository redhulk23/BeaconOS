export type AuditAction =
  | "agent.registered"
  | "agent.updated"
  | "agent.deleted"
  | "agent.run.started"
  | "agent.run.completed"
  | "agent.run.failed"
  | "model.call.started"
  | "model.call.completed"
  | "tool.invoked"
  | "tool.completed"
  | "approval.requested"
  | "approval.granted"
  | "approval.denied"
  | "data.read"
  | "data.write"
  | "auth.login"
  | "auth.api_key.created"
  | "auth.api_key.revoked";

export interface AuditEvent {
  id: string;
  tenantId: string;
  action: AuditAction;
  actorId: string;
  actorType: "user" | "agent" | "system";
  resourceType: string;
  resourceId: string;
  metadata: Record<string, unknown>;
  previousHash: string | null;
  hash: string;
  timestamp: Date;
}
