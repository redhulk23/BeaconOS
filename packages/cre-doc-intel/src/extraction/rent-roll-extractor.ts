import { createLogger } from "@beacon-os/common";
import type { ModelRouter } from "@beacon-os/model-router";
import { RENT_ROLL_EXTRACTION_PROMPT } from "../nlp/prompt-templates.js";

const log = createLogger("cre-doc-intel:rent-roll-extractor");

export interface RentRollUnit {
  unitNumber: string;
  tenantName: string;
  sqft: number;
  leaseStart?: string;
  leaseExpiration?: string;
  monthlyRent?: number;
  annualRent?: number;
  rentPerSqft?: number;
  leaseType?: string;
  status: "occupied" | "vacant";
}

export interface RentRollExtractionResult {
  units: RentRollUnit[];
  summary: {
    totalSqft: number;
    occupiedSqft: number;
    occupancyRate: number;
    totalMonthlyRent: number;
    avgRentPerSqft: number;
  };
  asOfDate?: string;
  confidence: number;
  rawResponse: string;
}

export async function extractRentRoll(
  text: string,
  modelRouter: ModelRouter,
  tenantId: string,
  agentId: string,
): Promise<RentRollExtractionResult> {
  log.info({ textLength: text.length }, "Starting rent roll extraction");

  const response = await modelRouter.complete(
    {
      provider: "claude",
      model: "claude-sonnet-4-5-20250929",
      messages: [
        { role: "system", content: RENT_ROLL_EXTRACTION_PROMPT },
        {
          role: "user",
          content: `Extract rent roll data from this document:\n\n${text}`,
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

  const units = ((parsed.units as unknown[]) ?? []).map((u) => {
    const unit = u as Record<string, unknown>;
    return {
      unitNumber: String(unit.unitNumber ?? ""),
      tenantName: String(unit.tenantName ?? ""),
      sqft: Number(unit.sqft ?? 0),
      leaseStart: unit.leaseStart as string | undefined,
      leaseExpiration: unit.leaseExpiration as string | undefined,
      monthlyRent: unit.monthlyRent as number | undefined,
      annualRent: unit.annualRent as number | undefined,
      rentPerSqft: unit.rentPerSqft as number | undefined,
      leaseType: unit.leaseType as string | undefined,
      status: (unit.status as "occupied" | "vacant") ?? "occupied",
    };
  });

  const summary = (parsed.summary as Record<string, unknown>) ?? {};

  return {
    units,
    summary: {
      totalSqft: Number(summary.totalSqft ?? 0),
      occupiedSqft: Number(summary.occupiedSqft ?? 0),
      occupancyRate: Number(summary.occupancyRate ?? 0),
      totalMonthlyRent: Number(summary.totalMonthlyRent ?? 0),
      avgRentPerSqft: Number(summary.avgRentPerSqft ?? 0),
    },
    asOfDate: parsed.asOfDate as string | undefined,
    confidence: Number(parsed.confidence ?? 0.5),
    rawResponse: response.content,
  };
}
