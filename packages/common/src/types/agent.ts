import { z } from "zod";

export const ModelConfigSchema = z.object({
  provider: z.string().default("claude"),
  model: z.string().default("claude-sonnet-4-5-20250929"),
  temperature: z.number().min(0).max(1).default(0.7),
  maxTokens: z.number().positive().default(4096),
});

export type ModelConfig = z.infer<typeof ModelConfigSchema>;

export const AgentManifestSchema = z.object({
  apiVersion: z.string().default("beacon-os/v1"),
  metadata: z.object({
    name: z.string().min(1),
    version: z.string().default("0.1.0"),
    description: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
  spec: z.object({
    model: ModelConfigSchema.default({}),
    tools: z.array(z.string()).default([]),
    memory: z
      .object({
        shortTerm: z.boolean().default(true),
        longTerm: z.boolean().default(false),
      })
      .default({}),
    resources: z
      .object({
        maxTokensPerRun: z.number().positive().default(100_000),
        maxStepsPerRun: z.number().positive().default(50),
        timeoutMs: z.number().positive().default(300_000),
      })
      .default({}),
    permissions: z.array(z.string()).default([]),
    guardrails: z
      .object({
        piiDetection: z.boolean().default(true),
        contentFiltering: z.boolean().default(true),
      })
      .default({}),
    sponsor: z.string().optional(),
    systemPrompt: z.string().optional(),
  }),
});

export type AgentManifest = z.infer<typeof AgentManifestSchema>;

export type AgentStatus = "registered" | "active" | "inactive" | "archived";

export type RunStatus =
  | "pending"
  | "running"
  | "waiting_approval"
  | "completed"
  | "failed"
  | "cancelled";

export type StepType =
  | "model_call"
  | "tool_call"
  | "approval_request"
  | "decision"
  | "error";
