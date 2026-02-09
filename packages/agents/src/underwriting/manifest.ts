export const UNDERWRITING_MANIFEST = {
  apiVersion: "beacon-os/v1",
  kind: "Agent",
  metadata: {
    name: "underwriting",
    version: "0.1.0",
    description: "Analyzes T-12 operating statements and generates pro forma projections for CRE underwriting",
    tags: ["cre", "underwriting", "financial-analysis", "pro-forma"],
  },
  spec: {
    model: {
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250929",
      temperature: 0.2,
      maxTokens: 8192,
    },
    tools: [
      "yardi_read_financials",
      "yardi_read_rent_roll",
      "costar_get_comps",
      "costar_market_data",
    ],
    memory: {
      shortTerm: true,
      longTerm: true,
    },
    resources: {
      maxStepsPerRun: 30,
      maxTokensPerRun: 300_000,
      timeoutMs: 900_000,
    },
    permissions: [
      "agents:run",
      "tools:execute",
    ],
    guardrails: {
      piiRedaction: true,
      auditLogging: true,
    },
    sponsor: "operator",
  },
} as const;

export const UNDERWRITING_WORKFLOW = {
  name: "underwriting-workflow",
  version: "0.1.0",
  description: "Sequential analysis with iterative refinement for underwriting",
  pattern: "iterative_refinement",
  steps: [
    {
      name: "extract-financials",
      type: "agent" as const,
      agent: "underwriting",
      input: { task: "extract_financials" },
      output: "financials",
    },
    {
      name: "evaluate-financials",
      type: "agent" as const,
      agent: "underwriting",
      input: { task: "evaluate" },
      output: "evaluation",
    },
  ],
  config: {
    maxIterations: 3,
    qualityThreshold: 0.85,
  },
} as const;
