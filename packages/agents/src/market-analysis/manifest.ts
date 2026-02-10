export const MARKET_ANALYSIS_MANIFEST = {
  apiVersion: "beacon-os/v1",
  kind: "Agent",
  metadata: {
    name: "market-analysis",
    version: "0.1.0",
    description: "Performs market analysis including comparable research, submarket fundamentals, and market study generation",
    tags: ["cre", "market", "comps", "analysis"],
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
      "compstak_search_comps",
      "compstak_market_stats",
      "vts_get_benchmarks",
      "argus_get_valuation",
    ],
    memory: {
      shortTerm: true,
      longTerm: true,
    },
    resources: {
      maxStepsPerRun: 30,
      maxTokensPerRun: 350_000,
      timeoutMs: 900_000,
    },
    permissions: [
      "agents:run",
      "tools:execute",
    ],
    guardrails: {
      piiRedaction: false,
      fairHousing: false,
      auditLogging: true,
    },
    sponsor: "operator",
  },
} as const;

export const MARKET_ANALYSIS_WORKFLOW = {
  name: "market-analysis-workflow",
  version: "0.1.0",
  description: "Fan-out/gather workflow for comprehensive market analysis across data sources",
  pattern: "fan_out_gather",
  steps: [
    {
      name: "search-comps",
      type: "agent" as const,
      agent: "market-analysis",
      input: { task: "search_comps" },
      output: "rawComps",
    },
    {
      name: "score-comps",
      type: "agent" as const,
      agent: "market-analysis",
      input: { task: "score_comps" },
      output: "scoredComps",
    },
    {
      name: "analyze-submarket",
      type: "agent" as const,
      agent: "market-analysis",
      input: { task: "analyze_submarket" },
      output: "submarketAnalysis",
    },
    {
      name: "generate-report",
      type: "agent" as const,
      agent: "market-analysis",
      input: { task: "generate_report" },
      output: "marketReport",
    },
  ],
  config: {
    title: "Market Analysis",
    description: "Comprehensive market analysis with comparable research",
    timeoutMs: 1_800_000,
  },
} as const;
