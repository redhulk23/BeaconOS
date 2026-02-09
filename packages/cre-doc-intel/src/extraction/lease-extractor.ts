import { createLogger } from "@beacon-os/common";
import type { ModelRouter } from "@beacon-os/model-router";
import { LEASE_EXTRACTION_PROMPT } from "../nlp/prompt-templates.js";
import { scoreExtraction, type ConfidenceReport } from "../nlp/confidence-scorer.js";

const log = createLogger("cre-doc-intel:lease-extractor");

const REQUIRED_LEASE_FIELDS = [
  "landlord_name", "tenant_name", "property_address", "premises_sqft",
  "lease_type", "commencement_date", "expiration_date", "lease_term_months",
  "base_rent_monthly", "base_rent_annual", "rent_per_sqft",
  "rent_escalation_type", "security_deposit", "cam_charges",
  "renewal_options", "termination_options", "permitted_use",
];

export interface LeaseExtractionResult {
  fields: Record<string, { value: unknown; confidence: number; page?: number; sourceText?: string }>;
  summary: string;
  warnings: string[];
  confidenceReport: ConfidenceReport;
  rawResponse: string;
}

export async function extractLease(
  text: string,
  modelRouter: ModelRouter,
  tenantId: string,
  agentId: string,
): Promise<LeaseExtractionResult> {
  log.info({ textLength: text.length }, "Starting lease extraction");

  const response = await modelRouter.complete(
    {
      provider: "claude",
      model: "claude-sonnet-4-5-20250929",
      messages: [
        { role: "system", content: LEASE_EXTRACTION_PROMPT },
        { role: "user", content: `Extract data from this lease document:\n\n${text}` },
      ],
      maxTokens: 8192,
      temperature: 0.1,
    },
    { tenantId, agentId },
  );

  // Parse JSON response
  let parsed: { fields: Record<string, unknown>; summary: string; warnings: string[] };
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : { fields: {}, summary: "", warnings: [] };
  } catch {
    log.warn("Failed to parse extraction response as JSON");
    parsed = { fields: {}, summary: response.content, warnings: ["Failed to parse structured response"] };
  }

  // Build typed fields
  const fields: LeaseExtractionResult["fields"] = {};
  for (const [key, value] of Object.entries(parsed.fields)) {
    if (typeof value === "object" && value !== null) {
      const v = value as Record<string, unknown>;
      fields[key] = {
        value: v.value,
        confidence: (v.confidence as number) ?? 0.5,
        page: v.page as number | undefined,
        sourceText: v.source_text as string | undefined,
      };
    } else {
      fields[key] = { value, confidence: 0.5 };
    }
  }

  const confidenceReport = scoreExtraction(
    fields as Record<string, { value: unknown; confidence: number }>,
    REQUIRED_LEASE_FIELDS,
  );

  log.info(
    {
      overallConfidence: confidenceReport.overallConfidence,
      reviewRequired: confidenceReport.reviewRequired,
      fieldCount: Object.keys(fields).length,
    },
    "Lease extraction completed",
  );

  return {
    fields,
    summary: parsed.summary ?? "",
    warnings: parsed.warnings ?? [],
    confidenceReport,
    rawResponse: response.content,
  };
}
