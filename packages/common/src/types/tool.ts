import { z } from "zod";

export const ToolDefinitionSchema = z.object({
  name: z.string().min(1),
  description: z.string(),
  version: z.string().default("0.1.0"),
  inputSchema: z.record(z.unknown()),
  outputSchema: z.record(z.unknown()).optional(),
  permissions: z.array(z.string()).default([]),
  timeoutMs: z.number().positive().default(30_000),
});

export type ToolDefinition = z.infer<typeof ToolDefinitionSchema>;

export interface ToolInvocation {
  toolName: string;
  input: Record<string, unknown>;
  runId: string;
  agentId: string;
  tenantId: string;
}

export interface ToolResult {
  success: boolean;
  output: unknown;
  durationMs: number;
  error?: string;
}
