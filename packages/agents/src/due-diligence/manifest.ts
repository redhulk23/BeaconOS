export const DUE_DILIGENCE_MANIFEST = {
  apiVersion: "beacon-os/v1",
  kind: "Agent",
  metadata: {
    name: "due-diligence",
    version: "0.1.0",
    description: "Supports acquisition due diligence with document classification, data extraction, estoppel comparison, and risk flagging",
    tags: ["cre", "due-diligence", "acquisition", "risk"],
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
      "yardi_read_financials",
      "costar_search_properties",
      "argus_get_dcf_model",
      "argus_export_cash_flows",
      "dealpath_get_checklist",
      "dealpath_get_underwriting",
      "dealpath_update_deal_stage",
    ],
    memory: {
      shortTerm: true,
      longTerm: true,
    },
    resources: {
      maxStepsPerRun: 40,
      maxTokensPerRun: 500_000,
      timeoutMs: 1_200_000,
    },
    permissions: [
      "agents:run",
      "tools:execute",
      "approvals:read",
    ],
    guardrails: {
      piiRedaction: true,
      fairHousing: false,
      auditLogging: true,
    },
    sponsor: "operator",
  },
} as const;

export const DUE_DILIGENCE_WORKFLOW = {
  name: "due-diligence-workflow",
  version: "0.1.0",
  description: "Hierarchical workflow for comprehensive due diligence analysis",
  pattern: "hierarchical",
  steps: [
    {
      name: "classify-documents",
      type: "agent" as const,
      agent: "due-diligence",
      input: { task: "classify_documents" },
      output: "documentClassification",
    },
    {
      name: "extract-data",
      type: "agent" as const,
      agent: "due-diligence",
      input: { task: "extract_data" },
      output: "extractedData",
    },
    {
      name: "compare-estoppels",
      type: "agent" as const,
      agent: "due-diligence",
      input: { task: "compare_estoppels" },
      output: "estoppelComparison",
    },
    {
      name: "flag-risks",
      type: "agent" as const,
      agent: "due-diligence",
      input: { task: "flag_risks" },
      output: "riskFlags",
    },
    {
      name: "review-findings",
      type: "approval" as const,
      title: "Review Due Diligence Findings",
      description: "Review flagged risks and due diligence findings before updating checklist",
    },
    {
      name: "update-checklist",
      type: "agent" as const,
      agent: "due-diligence",
      input: { task: "update_checklist" },
      output: "updatedChecklist",
    },
  ],
  config: {
    title: "Due Diligence Review",
    description: "Comprehensive due diligence analysis with human review of findings",
    timeoutMs: 172_800_000,
  },
} as const;
