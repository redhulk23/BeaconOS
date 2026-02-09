import { z } from "zod";

export const ManifestModelSchema = z.object({
  provider: z.string().default("claude"),
  model: z.string().default("claude-sonnet-4-5-20250929"),
  temperature: z.number().min(0).max(1).default(0.7),
  maxTokens: z.number().positive().default(4096),
});

export const ManifestMemorySchema = z.object({
  shortTerm: z.boolean().default(true),
  longTerm: z.boolean().default(false),
});

export const ManifestResourcesSchema = z.object({
  maxTokensPerRun: z.number().positive().default(100_000),
  maxStepsPerRun: z.number().positive().default(50),
  timeoutMs: z.number().positive().default(300_000),
});

export const ManifestGuardrailsSchema = z.object({
  piiDetection: z.boolean().default(true),
  contentFiltering: z.boolean().default(true),
});

export const ManifestSpecSchema = z.object({
  model: ManifestModelSchema.default({}),
  tools: z.array(z.string()).default([]),
  memory: ManifestMemorySchema.default({}),
  resources: ManifestResourcesSchema.default({}),
  permissions: z.array(z.string()).default([]),
  guardrails: ManifestGuardrailsSchema.default({}),
  sponsor: z.string().optional(),
  systemPrompt: z.string().optional(),
});

export const ManifestMetadataSchema = z.object({
  name: z.string().min(1),
  version: z.string().default("0.1.0"),
  description: z.string().optional(),
  tags: z.array(z.string()).default([]),
});

export const AgentManifestFileSchema = z.object({
  apiVersion: z.string().default("beacon-os/v1"),
  metadata: ManifestMetadataSchema,
  spec: ManifestSpecSchema,
});

export type AgentManifestFile = z.infer<typeof AgentManifestFileSchema>;
