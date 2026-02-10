import { z } from "zod";
import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-connectors:compstak");

// --- Schemas ---

export const CompStakLeaseCompSchema = z.object({
  compId: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  submarket: z.string(),
  tenantName: z.string(),
  tenantIndustry: z.string().optional(),
  startingRent: z.number(),
  effectiveRent: z.number(),
  rentType: z.enum(["nnn", "gross", "modified_gross"]),
  sqft: z.number(),
  term: z.number(),
  freeRent: z.number().optional(),
  tiAllowance: z.number().optional(),
  escalation: z.string().optional(),
  transactionType: z.enum(["new", "renewal", "expansion", "relocation"]),
  executionDate: z.string(),
  commencementDate: z.string(),
  expirationDate: z.string(),
  propertyType: z.enum(["office", "retail", "industrial"]),
  floor: z.number().optional(),
});

export const CompStakMarketStatsSchema = z.object({
  submarket: z.string(),
  propertyType: z.string(),
  avgStartingRent: z.number(),
  avgEffectiveRent: z.number(),
  avgTermMonths: z.number(),
  avgTiAllowance: z.number(),
  avgFreeRentMonths: z.number(),
  transactionCount: z.number(),
  period: z.string(),
});

export type CompStakLeaseComp = z.infer<typeof CompStakLeaseCompSchema>;
export type CompStakMarketStats = z.infer<typeof CompStakMarketStatsSchema>;

// --- Mock Data ---

const MOCK_COMPS: CompStakLeaseComp[] = [
  {
    compId: "CS001",
    address: "200 Congress Ave",
    city: "Austin",
    state: "TX",
    submarket: "CBD",
    tenantName: "TechCo Inc",
    tenantIndustry: "Technology",
    startingRent: 52.0,
    effectiveRent: 48.5,
    rentType: "nnn",
    sqft: 15000,
    term: 84,
    freeRent: 3,
    tiAllowance: 65,
    escalation: "3% annual",
    transactionType: "new",
    executionDate: "2024-03-15",
    commencementDate: "2024-07-01",
    expirationDate: "2031-06-30",
    propertyType: "office",
    floor: 12,
  },
  {
    compId: "CS002",
    address: "300 Colorado St",
    city: "Austin",
    state: "TX",
    submarket: "CBD",
    tenantName: "Legal Partners LLP",
    tenantIndustry: "Legal",
    startingRent: 48.0,
    effectiveRent: 45.0,
    rentType: "nnn",
    sqft: 8000,
    term: 60,
    freeRent: 2,
    tiAllowance: 45,
    escalation: "2.5% annual",
    transactionType: "renewal",
    executionDate: "2024-01-20",
    commencementDate: "2024-04-01",
    expirationDate: "2029-03-31",
    propertyType: "office",
    floor: 5,
  },
  {
    compId: "CS003",
    address: "500 E 5th St",
    city: "Austin",
    state: "TX",
    submarket: "East Austin",
    tenantName: "Creative Studios",
    tenantIndustry: "Media",
    startingRent: 38.0,
    effectiveRent: 35.5,
    rentType: "modified_gross",
    sqft: 5000,
    term: 36,
    freeRent: 1,
    tiAllowance: 25,
    transactionType: "new",
    executionDate: "2024-05-10",
    commencementDate: "2024-08-01",
    expirationDate: "2027-07-31",
    propertyType: "office",
  },
];

const MOCK_STATS: CompStakMarketStats = {
  submarket: "CBD",
  propertyType: "office",
  avgStartingRent: 50.0,
  avgEffectiveRent: 46.75,
  avgTermMonths: 72,
  avgTiAllowance: 55,
  avgFreeRentMonths: 2.5,
  transactionCount: 142,
  period: "2024-Q2",
};

// --- MCP Tool Functions ---

export async function compstakSearchComps(input: {
  city: string;
  state: string;
  submarket?: string;
  propertyType?: string;
  minSqft?: number;
  maxSqft?: number;
}): Promise<CompStakLeaseComp[]> {
  log.info(input, "Searching lease comps in CompStak");
  return MOCK_COMPS.filter((c) => {
    if (c.city.toLowerCase() !== input.city.toLowerCase()) return false;
    if (c.state.toLowerCase() !== input.state.toLowerCase()) return false;
    if (
      input.submarket &&
      c.submarket.toLowerCase() !== input.submarket.toLowerCase()
    )
      return false;
    if (input.propertyType && c.propertyType !== input.propertyType)
      return false;
    if (input.minSqft && c.sqft < input.minSqft) return false;
    if (input.maxSqft && c.sqft > input.maxSqft) return false;
    return true;
  });
}

export async function compstakGetCompDetail(input: {
  compId: string;
}): Promise<CompStakLeaseComp | null> {
  log.info({ compId: input.compId }, "Getting comp detail from CompStak");
  return MOCK_COMPS.find((c) => c.compId === input.compId) ?? null;
}

export async function compstakMarketStats(input: {
  city: string;
  state: string;
  submarket?: string;
  propertyType?: string;
}): Promise<CompStakMarketStats> {
  log.info(input, "Getting market stats from CompStak");
  return {
    ...MOCK_STATS,
    submarket: input.submarket ?? "CBD",
    propertyType: input.propertyType ?? "office",
  };
}

// --- Tool Definitions ---

export const compstakTools = [
  {
    name: "compstak_search_comps",
    description:
      "Search for lease comparables in CompStak by location, property type, and size",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string" },
        state: { type: "string" },
        submarket: { type: "string" },
        propertyType: { type: "string" },
        minSqft: { type: "number" },
        maxSqft: { type: "number" },
      },
      required: ["city", "state"],
    },
    execute: compstakSearchComps,
  },
  {
    name: "compstak_get_comp_detail",
    description:
      "Get detailed information about a specific lease comparable from CompStak",
    inputSchema: {
      type: "object",
      properties: { compId: { type: "string" } },
      required: ["compId"],
    },
    execute: compstakGetCompDetail,
  },
  {
    name: "compstak_market_stats",
    description:
      "Get aggregate market statistics for a submarket from CompStak",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string" },
        state: { type: "string" },
        submarket: { type: "string" },
        propertyType: { type: "string" },
      },
      required: ["city", "state"],
    },
    execute: compstakMarketStats,
  },
] as const;
