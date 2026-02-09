export const DEAL_SOURCING_MANIFEST = {
  apiVersion: "beacon-os/v1",
  kind: "Agent",
  metadata: {
    name: "deal-sourcing",
    version: "0.1.0",
    description: "Screens potential CRE acquisitions against investment criteria with AML/KYC compliance",
    tags: ["cre", "deal-sourcing", "acquisitions", "compliance"],
  },
  spec: {
    model: {
      provider: "anthropic",
      model: "claude-sonnet-4-5-20250929",
      temperature: 0.3,
      maxTokens: 8192,
    },
    tools: [
      "costar_search_properties",
      "costar_get_comps",
      "costar_market_data",
      "yardi_read_financials",
    ],
    memory: {
      shortTerm: true,
      longTerm: true,
    },
    resources: {
      maxStepsPerRun: 25,
      maxTokensPerRun: 250_000,
      timeoutMs: 600_000,
    },
    permissions: [
      "agents:run",
      "tools:execute",
    ],
    guardrails: {
      piiRedaction: true,
      fairHousing: true,
      amlKyc: true,
      auditLogging: true,
    },
    sponsor: "operator",
  },
} as const;

export const DEAL_SOURCING_WORKFLOW = {
  name: "deal-sourcing-workflow",
  version: "0.1.0",
  description: "Fan-out search across markets then consolidate ranked results",
  pattern: "fan_out_gather",
  steps: [
    {
      name: "search-market-austin",
      type: "agent" as const,
      agent: "deal-sourcing",
      input: { task: "search_market", market: "Austin" },
      output: "austinResults",
    },
    {
      name: "search-market-dallas",
      type: "agent" as const,
      agent: "deal-sourcing",
      input: { task: "search_market", market: "Dallas" },
      output: "dallasResults",
    },
    {
      name: "consolidate-results",
      type: "agent" as const,
      agent: "deal-sourcing",
      input: { task: "consolidate" },
      output: "rankedDeals",
    },
  ],
} as const;
