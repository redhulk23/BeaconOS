export const TENANT_COMMUNICATION_MANIFEST = {
  apiVersion: "beacon-os/v1",
  kind: "Agent",
  metadata: {
    name: "tenant-communication",
    version: "0.1.0",
    description:
      "Manages tenant communications including inquiry classification, response generation, delinquency workflows, and renewal outreach",
    tags: ["cre", "tenant", "communication", "compliance"],
  },
  spec: {
    model: {
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250929",
      temperature: 0.5,
      maxTokens: 4096,
    },
    tools: [
      "yardi_read_lease",
      "yardi_read_rent_roll",
      "vts_get_tenant_data",
      "sf_log_activity",
    ],
    memory: {
      shortTerm: true,
      longTerm: true,
    },
    resources: {
      maxStepsPerRun: 15,
      maxTokensPerRun: 150_000,
      timeoutMs: 300_000,
    },
    permissions: ["agents:run", "tools:execute", "approvals:read"],
    guardrails: {
      piiRedaction: true,
      fairHousing: true,
      auditLogging: true,
    },
    sponsor: "operator",
  },
} as const;

export const TENANT_COMMUNICATION_WORKFLOW = {
  name: "tenant-communication-workflow",
  version: "0.1.0",
  description:
    "Human-in-the-loop workflow for tenant communication with compliance review",
  pattern: "human-in-the-loop",
  steps: [
    {
      name: "classify-inquiry",
      type: "agent" as const,
      agent: "tenant-communication",
      input: { task: "classify" },
      output: "classification",
    },
    {
      name: "generate-response",
      type: "agent" as const,
      agent: "tenant-communication",
      input: { task: "respond" },
      output: "draftResponse",
    },
    {
      name: "review-response",
      type: "approval" as const,
      title: "Review Tenant Communication",
      description:
        "Review generated tenant communication for accuracy and compliance before sending",
    },
  ],
  config: {
    title: "Tenant Communication Review",
    description: "Review and approve tenant communication before delivery",
    timeoutMs: 86_400_000,
  },
} as const;
