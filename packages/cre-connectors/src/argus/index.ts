import { z } from "zod";
import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-connectors:argus");

// --- Schemas ---

export const ArgusPropertySchema = z.object({
  propertyId: z.string(),
  propertyName: z.string(),
  address: z.string(),
  propertyType: z.enum([
    "office",
    "retail",
    "industrial",
    "multifamily",
    "mixed_use",
  ]),
  totalSqft: z.number(),
  acquisitionDate: z.string(),
  acquisitionPrice: z.number(),
});

export const ArgusCashFlowSchema = z.object({
  propertyId: z.string(),
  year: z.number(),
  month: z.number(),
  grossPotentialRent: z.number(),
  vacancyLoss: z.number(),
  effectiveGrossIncome: z.number(),
  operatingExpenses: z.number(),
  netOperatingIncome: z.number(),
  capitalExpenditures: z.number(),
  cashFlowBeforeDebt: z.number(),
});

export const ArgusValuationSchema = z.object({
  propertyId: z.string(),
  valuationDate: z.string(),
  approachType: z.enum(["dcf", "direct_cap", "sales_comparison"]),
  value: z.number(),
  capRate: z.number(),
  discountRate: z.number().optional(),
  terminalCapRate: z.number().optional(),
  irr: z.number().optional(),
});

export const ArgusDcfModelSchema = z.object({
  propertyId: z.string(),
  modelName: z.string(),
  holdPeriodYears: z.number(),
  discountRate: z.number(),
  terminalCapRate: z.number(),
  reversion: z.number(),
  npv: z.number(),
  irr: z.number(),
  cashFlows: z.array(ArgusCashFlowSchema),
});

export type ArgusProperty = z.infer<typeof ArgusPropertySchema>;
export type ArgusCashFlow = z.infer<typeof ArgusCashFlowSchema>;
export type ArgusValuation = z.infer<typeof ArgusValuationSchema>;
export type ArgusDcfModel = z.infer<typeof ArgusDcfModelSchema>;

// --- Mock Data ---

const MOCK_DCF_MODEL: ArgusDcfModel = {
  propertyId: "ARG001",
  modelName: "Beacon Tower 10-Year DCF",
  holdPeriodYears: 10,
  discountRate: 0.08,
  terminalCapRate: 0.065,
  reversion: 28_500_000,
  npv: 24_200_000,
  irr: 0.092,
  cashFlows: [
    {
      propertyId: "ARG001",
      year: 2024,
      month: 0,
      grossPotentialRent: 1_875_000,
      vacancyLoss: 93_750,
      effectiveGrossIncome: 1_781_250,
      operatingExpenses: 625_000,
      netOperatingIncome: 1_156_250,
      capitalExpenditures: 62_500,
      cashFlowBeforeDebt: 1_093_750,
    },
    {
      propertyId: "ARG001",
      year: 2025,
      month: 0,
      grossPotentialRent: 1_931_250,
      vacancyLoss: 96_563,
      effectiveGrossIncome: 1_834_688,
      operatingExpenses: 643_750,
      netOperatingIncome: 1_190_938,
      capitalExpenditures: 50_000,
      cashFlowBeforeDebt: 1_140_938,
    },
  ],
};

const MOCK_VALUATION: ArgusValuation = {
  propertyId: "ARG001",
  valuationDate: "2024-06-01",
  approachType: "dcf",
  value: 24_200_000,
  capRate: 0.058,
  discountRate: 0.08,
  terminalCapRate: 0.065,
  irr: 0.092,
};

// --- MCP Tool Functions ---

export async function argusGetDcfModel(input: {
  propertyId: string;
}): Promise<ArgusDcfModel> {
  log.info({ propertyId: input.propertyId }, "Getting DCF model from Argus");
  return MOCK_DCF_MODEL;
}

export async function argusExportCashFlows(input: {
  propertyId: string;
  startYear?: number;
  endYear?: number;
}): Promise<ArgusCashFlow[]> {
  log.info(input, "Exporting cash flows from Argus");
  return MOCK_DCF_MODEL.cashFlows.filter((cf) => {
    if (input.startYear && cf.year < input.startYear) return false;
    if (input.endYear && cf.year > input.endYear) return false;
    return true;
  });
}

export async function argusGetValuation(input: {
  propertyId: string;
  approachType?: string;
}): Promise<ArgusValuation> {
  log.info(input, "Getting valuation from Argus");
  return MOCK_VALUATION;
}

export async function argusRunScenario(input: {
  propertyId: string;
  discountRate?: number;
  terminalCapRate?: number;
  vacancyRate?: number;
}): Promise<{
  scenarioName: string;
  npv: number;
  irr: number;
  valueDelta: number;
}> {
  log.info(input, "Running scenario in Argus");
  const baseNpv = MOCK_DCF_MODEL.npv;
  const adjustedNpv =
    baseNpv * (1 - (input.discountRate ? (input.discountRate - 0.08) * 5 : 0));
  return {
    scenarioName: `Scenario ${Date.now()}`,
    npv: Math.round(adjustedNpv),
    irr: input.discountRate ? input.discountRate + 0.012 : 0.092,
    valueDelta: Math.round(adjustedNpv - baseNpv),
  };
}

// --- Tool Definitions ---

export const argusTools = [
  {
    name: "argus_get_dcf_model",
    description:
      "Get the DCF (Discounted Cash Flow) model for a property from Argus Enterprise",
    inputSchema: {
      type: "object",
      properties: { propertyId: { type: "string" } },
      required: ["propertyId"],
    },
    execute: argusGetDcfModel,
  },
  {
    name: "argus_export_cash_flows",
    description:
      "Export projected cash flows for a property from Argus Enterprise",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        startYear: { type: "number" },
        endYear: { type: "number" },
      },
      required: ["propertyId"],
    },
    execute: argusExportCashFlows,
  },
  {
    name: "argus_get_valuation",
    description:
      "Get the current valuation for a property from Argus Enterprise",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        approachType: { type: "string" },
      },
      required: ["propertyId"],
    },
    execute: argusGetValuation,
  },
  {
    name: "argus_run_scenario",
    description:
      "Run a what-if scenario analysis in Argus Enterprise with modified assumptions",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        discountRate: { type: "number" },
        terminalCapRate: { type: "number" },
        vacancyRate: { type: "number" },
      },
      required: ["propertyId"],
    },
    execute: argusRunScenario,
  },
] as const;
