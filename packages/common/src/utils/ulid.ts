import { ulid } from "ulid";
import type { TenantId, UserId, AgentId, RunId, StepId, ToolId, WorkflowId, ApiKeyId } from "../types/ids.js";

export function generateId(): string {
  return ulid();
}

export function generateTenantId(): TenantId {
  return `tnt_${ulid()}` as TenantId;
}

export function generateUserId(): UserId {
  return `usr_${ulid()}` as UserId;
}

export function generateAgentId(): AgentId {
  return `agt_${ulid()}` as AgentId;
}

export function generateRunId(): RunId {
  return `run_${ulid()}` as RunId;
}

export function generateStepId(): StepId {
  return `stp_${ulid()}` as StepId;
}

export function generateToolId(): ToolId {
  return `tol_${ulid()}` as ToolId;
}

export function generateWorkflowId(): WorkflowId {
  return `wfl_${ulid()}` as WorkflowId;
}

export function generateApiKeyId(): ApiKeyId {
  return `key_${ulid()}` as ApiKeyId;
}
