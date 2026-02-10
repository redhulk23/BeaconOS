import { z } from "zod";
import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-connectors:vts");

// --- Schemas ---

export const VtsTenantSchema = z.object({
  tenantId: z.string(),
  name: z.string(),
  industry: z.string(),
  creditRating: z.string().optional(),
  currentSqft: z.number(),
  leaseExpiration: z.string(),
  renewalProbability: z.number(),
});

export const VtsLeaseSchema = z.object({
  dealId: z.string(),
  propertyId: z.string(),
  tenantName: z.string(),
  spaceId: z.string(),
  sqft: z.number(),
  askingRent: z.number(),
  proposedRent: z.number().optional(),
  stage: z.enum([
    "prospect",
    "tour",
    "proposal",
    "negotiation",
    "lease_out",
    "executed",
  ]),
  dealType: z.enum(["new", "renewal", "expansion"]),
  probability: z.number(),
  expectedCloseDate: z.string().optional(),
  broker: z.string().optional(),
  lastActivity: z.string(),
});

export const VtsPipelineSchema = z.object({
  propertyId: z.string(),
  totalDeals: z.number(),
  totalSqft: z.number(),
  weightedPipelineValue: z.number(),
  stageBreakdown: z.record(z.number()),
  avgDaysInPipeline: z.number(),
});

export const VtsBenchmarkSchema = z.object({
  market: z.string(),
  propertyType: z.string(),
  avgDaysOnMarket: z.number(),
  avgConversionRate: z.number(),
  avgTourToProposal: z.number(),
  avgProposalToLease: z.number(),
  newLeaseVelocity: z.number(),
  renewalRate: z.number(),
  period: z.string(),
});

export type VtsTenant = z.infer<typeof VtsTenantSchema>;
export type VtsLease = z.infer<typeof VtsLeaseSchema>;
export type VtsPipeline = z.infer<typeof VtsPipelineSchema>;
export type VtsBenchmark = z.infer<typeof VtsBenchmarkSchema>;

// --- Mock Data ---

const MOCK_DEALS: VtsLease[] = [
  {
    dealId: "VTS001",
    propertyId: "PROP001",
    tenantName: "FinServ Inc",
    spaceId: "STE-400",
    sqft: 12000,
    askingRent: 55.0,
    proposedRent: 52.0,
    stage: "negotiation",
    dealType: "new",
    probability: 0.7,
    expectedCloseDate: "2024-09-15",
    broker: "CBRE",
    lastActivity: "2024-06-20",
  },
  {
    dealId: "VTS002",
    propertyId: "PROP001",
    tenantName: "Acme Corp",
    spaceId: "STE-100",
    sqft: 2500,
    askingRent: 52.0,
    stage: "proposal",
    dealType: "renewal",
    probability: 0.85,
    expectedCloseDate: "2024-11-01",
    lastActivity: "2024-06-18",
  },
  {
    dealId: "VTS003",
    propertyId: "PROP001",
    tenantName: "StartupXYZ",
    spaceId: "STE-200",
    sqft: 3000,
    askingRent: 50.0,
    stage: "tour",
    dealType: "new",
    probability: 0.2,
    broker: "JLL",
    lastActivity: "2024-06-22",
  },
];

const MOCK_TENANTS: VtsTenant[] = [
  {
    tenantId: "VT001",
    name: "Acme Corp",
    industry: "Technology",
    creditRating: "A",
    currentSqft: 2500,
    leaseExpiration: "2028-12-31",
    renewalProbability: 0.85,
  },
  {
    tenantId: "VT002",
    name: "Legal Eagles",
    industry: "Legal",
    creditRating: "A+",
    currentSqft: 5000,
    leaseExpiration: "2026-03-31",
    renewalProbability: 0.6,
  },
];

// --- MCP Tool Functions ---

export async function vtsGetLeasingPipeline(input: {
  propertyId: string;
}): Promise<{ pipeline: VtsPipeline; deals: VtsLease[] }> {
  log.info(
    { propertyId: input.propertyId },
    "Getting leasing pipeline from VTS",
  );
  const deals = MOCK_DEALS.filter((d) => d.propertyId === input.propertyId);
  const stageBreakdown: Record<string, number> = {};
  for (const deal of deals) {
    stageBreakdown[deal.stage] = (stageBreakdown[deal.stage] ?? 0) + 1;
  }
  return {
    pipeline: {
      propertyId: input.propertyId,
      totalDeals: deals.length,
      totalSqft: deals.reduce((sum, d) => sum + d.sqft, 0),
      weightedPipelineValue: deals.reduce(
        (sum, d) => sum + d.sqft * d.askingRent * d.probability,
        0,
      ),
      stageBreakdown,
      avgDaysInPipeline: 45,
    },
    deals,
  };
}

export async function vtsGetTenantData(input: {
  propertyId: string;
  tenantId?: string;
}): Promise<VtsTenant[]> {
  log.info(input, "Getting tenant data from VTS");
  if (input.tenantId) {
    return MOCK_TENANTS.filter((t) => t.tenantId === input.tenantId);
  }
  return MOCK_TENANTS;
}

export async function vtsGetBenchmarks(input: {
  market: string;
  propertyType?: string;
}): Promise<VtsBenchmark> {
  log.info(input, "Getting benchmarks from VTS");
  return {
    market: input.market,
    propertyType: input.propertyType ?? "office",
    avgDaysOnMarket: 120,
    avgConversionRate: 0.15,
    avgTourToProposal: 0.35,
    avgProposalToLease: 0.45,
    newLeaseVelocity: 8500,
    renewalRate: 0.72,
    period: "2024-Q2",
  };
}

export async function vtsGetDealActivity(input: {
  dealId: string;
}): Promise<{
  dealId: string;
  activities: Array<{ date: string; type: string; note: string }>;
}> {
  log.info({ dealId: input.dealId }, "Getting deal activity from VTS");
  return {
    dealId: input.dealId,
    activities: [
      {
        date: "2024-06-20",
        type: "proposal_sent",
        note: "Sent LOI with $52/sf NNN",
      },
      {
        date: "2024-06-15",
        type: "tour",
        note: "Second tour — tenant liked the space",
      },
      {
        date: "2024-06-01",
        type: "inquiry",
        note: "Inbound inquiry from CBRE broker",
      },
    ],
  };
}

// --- Tool Definitions ---

export const vtsTools = [
  {
    name: "vts_get_leasing_pipeline",
    description:
      "Get the leasing pipeline for a property from VTS including all active deals",
    inputSchema: {
      type: "object",
      properties: { propertyId: { type: "string" } },
      required: ["propertyId"],
    },
    execute: vtsGetLeasingPipeline,
  },
  {
    name: "vts_get_tenant_data",
    description: "Get tenant data and renewal probability from VTS",
    inputSchema: {
      type: "object",
      properties: {
        propertyId: { type: "string" },
        tenantId: { type: "string" },
      },
      required: ["propertyId"],
    },
    execute: vtsGetTenantData,
  },
  {
    name: "vts_get_benchmarks",
    description: "Get leasing benchmarks and market velocity data from VTS",
    inputSchema: {
      type: "object",
      properties: {
        market: { type: "string" },
        propertyType: { type: "string" },
      },
      required: ["market"],
    },
    execute: vtsGetBenchmarks,
  },
  {
    name: "vts_get_deal_activity",
    description: "Get activity timeline for a specific deal from VTS",
    inputSchema: {
      type: "object",
      properties: { dealId: { type: "string" } },
      required: ["dealId"],
    },
    execute: vtsGetDealActivity,
  },
] as const;
