import pino from "pino";

export interface LogContext {
  tenantId?: string;
  agentId?: string;
  runId?: string;
  traceId?: string;
  [key: string]: unknown;
}

export function createLogger(name: string, context?: LogContext) {
  return pino({
    name,
    level: process.env.LOG_LEVEL ?? "info",
    ...(process.env.NODE_ENV === "development"
      ? { transport: { target: "pino/file", options: { destination: 1 } } }
      : {}),
  }).child(context ?? {});
}

export type Logger = ReturnType<typeof createLogger>;
