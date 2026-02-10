import { createLogger } from "@beacon-os/common";
import type { ModelRouter } from "@beacon-os/model-router";
import { T12_EXTRACTION_PROMPT } from "../nlp/prompt-templates.js";

const log = createLogger("cre-doc-intel:t12-extractor");

export interface T12Period {
  month: string;
  revenue: Record<string, number>;
  expenses: Record<string, number>;
  noi: number;
}

export interface T12ExtractionResult {
  periods: T12Period[];
  annualTotals: {
    revenue: Record<string, number>;
    expenses: Record<string, number>;
    noi: number;
  };
  metrics: {
    noiMargin: number;
    opexRatio: number;
    noiPerSqft?: number;
    noiPerUnit?: number;
  };
  propertyInfo: { name?: string; address?: string };
  confidence: number;
  rawResponse: string;
}

export async function extractT12(
  text: string,
  modelRouter: ModelRouter,
  tenantId: string,
  agentId: string,
): Promise<T12ExtractionResult> {
  log.info({ textLength: text.length }, "Starting T-12 extraction");

  const response = await modelRouter.complete(
    {
      provider: "claude",
      model: "claude-sonnet-4-5-20250929",
      messages: [
        { role: "system", content: T12_EXTRACTION_PROMPT },
        {
          role: "user",
          content: `Extract T-12 operating statement data from this document:\n\n${text}`,
        },
      ],
      maxTokens: 8192,
      temperature: 0.1,
    },
    { tenantId, agentId },
  );

  let parsed: Record<string, unknown>;
  try {
    const jsonMatch = response.content.match(/\{[\s\S]*\}/);
    parsed = jsonMatch ? JSON.parse(jsonMatch[0]) : {};
  } catch {
    parsed = {};
  }

  const periods = ((parsed.periods as unknown[]) ?? []).map((p) => {
    const period = p as Record<string, unknown>;
    return {
      month: String(period.month ?? ""),
      revenue: (period.revenue as Record<string, number>) ?? {},
      expenses: (period.expenses as Record<string, number>) ?? {},
      noi: Number(period.noi ?? 0),
    };
  });

  const annualTotals = (parsed.annualTotals as Record<string, unknown>) ?? {};
  const metrics = (parsed.metrics as Record<string, unknown>) ?? {};

  return {
    periods,
    annualTotals: {
      revenue: (annualTotals.revenue as Record<string, number>) ?? {},
      expenses: (annualTotals.expenses as Record<string, number>) ?? {},
      noi: Number(annualTotals.noi ?? 0),
    },
    metrics: {
      noiMargin: Number(metrics.noiMargin ?? 0),
      opexRatio: Number(metrics.opexRatio ?? 0),
      noiPerSqft: metrics.noiPerSqft as number | undefined,
      noiPerUnit: metrics.noiPerUnit as number | undefined,
    },
    propertyInfo:
      (parsed.propertyInfo as { name?: string; address?: string }) ?? {},
    confidence: Number(parsed.confidence ?? 0.5),
    rawResponse: response.content,
  };
}
