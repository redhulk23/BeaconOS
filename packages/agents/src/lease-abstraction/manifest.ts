export const LEASE_ABSTRACTION_MANIFEST = {
  apiVersion: "beacon-os/v1",
  kind: "Agent",
  metadata: {
    name: "lease-abstraction",
    version: "0.1.0",
    description:
      "Extracts 200+ data points from commercial lease documents with ASC 842 classification",
    tags: ["cre", "lease", "extraction", "compliance"],
  },
  spec: {
    model: {
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250929",
      temperature: 0.1,
      maxTokens: 8192,
    },
    tools: [
      "yardi_read_lease",
      "yardi_write_lease",
      "mri_read_lease",
      "mri_write_lease",
    ],
    memory: {
      shortTerm: true,
      longTerm: true,
    },
    resources: {
      maxStepsPerRun: 20,
      maxTokensPerRun: 200_000,
      timeoutMs: 600_000,
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

export const LEASE_ABSTRACTION_WORKFLOW = {
  name: "lease-abstraction-workflow",
  version: "0.1.0",
  description: "Sequential pipeline with HITL review for lease abstraction",
  pattern: "human-in-the-loop",
  steps: [
    {
      name: "ingest-document",
      type: "tool" as const,
      tool: "document_intelligence_pipeline",
      input: { documentType: "lease" },
      output: "extractionResult",
    },
    {
      name: "classify-asc842",
      type: "agent" as const,
      agent: "lease-abstraction",
      input: { task: "classify_lease" },
      output: "classification",
    },
    {
      name: "review-extraction",
      type: "approval" as const,
      title: "Review Lease Extraction",
      description:
        "Review extracted lease data points and ASC 842 classification",
    },
    {
      name: "write-to-pms",
      type: "agent" as const,
      agent: "lease-abstraction",
      input: { task: "write_to_system" },
      output: "writeResult",
    },
  ],
  config: {
    title: "Lease Abstraction Review",
    description:
      "Review extracted lease data for accuracy before writing to property management system",
    timeoutMs: 86_400_000,
  },
} as const;
