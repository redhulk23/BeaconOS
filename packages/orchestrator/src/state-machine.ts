export type WorkflowStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type StepStatus =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "failed"
  | "skipped";

const VALID_TRANSITIONS: Record<WorkflowStatus, WorkflowStatus[]> = {
  pending: ["running", "cancelled"],
  running: ["waiting_approval", "completed", "failed", "cancelled"],
  waiting_approval: ["running", "completed", "failed", "cancelled"],
  completed: [],
  failed: [],
  cancelled: [],
};

export function canTransition(
  from: WorkflowStatus,
  to: WorkflowStatus,
): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}

export function isTerminal(status: WorkflowStatus): boolean {
  return (
    status === "completed" || status === "failed" || status === "cancelled"
  );
}

export interface WorkflowState {
  status: WorkflowStatus;
  currentStep: string | null;
  data: Record<string, unknown>;
  stepResults: Record<string, { status: StepStatus; output: unknown }>;
  error?: string;
  startedAt?: Date;
  completedAt?: Date;
}

export function createInitialState(
  input?: Record<string, unknown>,
): WorkflowState {
  return {
    status: "pending",
    currentStep: null,
    data: input ?? {},
    stepResults: {},
  };
}
