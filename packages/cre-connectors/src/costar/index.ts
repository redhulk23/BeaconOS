import { z } from "zod";
import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-connectors:costar");

// --- Schemas matching CoStar API shapes ---

export const CoStarPropertySchema = z.object({
  costarId: z.string(),
  name: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  propertyType: z.enum([
    "office",
    "industrial",
    "retail",
    "multifamily",
    "hospitality",
    "land",
  ]),
  subType: z.string().optional(),
  buildingSqFt: z.number(),
  yearBuilt: z.number(),
  floors: z.number().optional(),
  starRating: z.number().optional(),
  owner: z.string().optional(),
  lastSaleDate: z.string().optional(),
  lastSalePrice: z.number().optional(),
});

export const CoStarCompSchema = z.object({
  compId: z.string(),
  propertyName: z.string(),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  propertyType: z.string(),
  saleDate: z.string(),
  salePrice: z.number(),
  pricePerSqFt: z.number(),
  capRate: z.number().optional(),
  sqFt: z.number(),
  yearBuilt: z.number(),
  buyer: z.string().optional(),
  seller: z.string().optional(),
});

export const CoStarMarketDataSchema = z.object({
  market: z.string(),
  submarket: z.string().optional(),
  propertyType: z.string(),
  period: z.string(),
  vacancyRate: z.number(),
  askingRentPerSqFt: z.number(),
  effectiveRentPerSqFt: z.number(),
  absorptionSqFt: z.number(),
  deliveriesSqFt: z.number(),
  underConstructionSqFt: z.number(),
  capRate: z.number().optional(),
  inventorySqFt: z.number(),
});

export type CoStarProperty = z.infer<typeof CoStarPropertySchema>;
export type CoStarComp = z.infer<typeof CoStarCompSchema>;
export type CoStarMarketData = z.infer<typeof CoStarMarketDataSchema>;

// --- Mock Data ---

const MOCK_PROPERTIES: CoStarProperty[] = [
  {
    costarId: "CS-100001",
    name: "One Congress Plaza",
    address: "111 Congress Ave",
    city: "Austin",
    state: "TX",
    zip: "78701",
    propertyType: "office",
    subType: "Class A",
    buildingSqFt: 350000,
    yearBuilt: 2018,
    floors: 28,
    starRating: 4,
    owner: "Blackstone Real Estate",
    lastSaleDate: "2022-06-15",
    lastSalePrice: 210000000,
  },
  {
    costarId: "CS-100002",
    name: "Tech Corridor Center",
    address: "5000 N Lamar Blvd",
    city: "Austin",
    state: "TX",
    zip: "78751",
    propertyType: "office",
    subType: "Class B",
    buildingSqFt: 120000,
    yearBuilt: 2005,
    floors: 8,
    starRating: 3,
    lastSaleDate: "2023-02-10",
    lastSalePrice: 48000000,
  },
  {
    costarId: "CS-100003",
    name: "Gateway Industrial Park",
    address: "8900 Gateway Blvd",
    city: "Dallas",
    state: "TX",
    zip: "75247",
    propertyType: "industrial",
    subType: "Warehouse/Distribution",
    buildingSqFt: 450000,
    yearBuilt: 2020,
    floors: 1,
    starRating: 4,
    lastSaleDate: "2024-01-20",
    lastSalePrice: 67500000,
  },
];

const MOCK_COMPS: CoStarComp[] = [
  {
    compId: "COMP-001",
    propertyName: "One Congress Plaza",
    address: "111 Congress Ave",
    city: "Austin",
    state: "TX",
    propertyType: "office",
    saleDate: "2022-06-15",
    salePrice: 210000000,
    pricePerSqFt: 600,
    capRate: 5.2,
    sqFt: 350000,
    yearBuilt: 2018,
    buyer: "Blackstone Real Estate",
    seller: "Hines Interests",
  },
  {
    compId: "COMP-002",
    propertyName: "Tech Corridor Center",
    address: "5000 N Lamar Blvd",
    city: "Austin",
    state: "TX",
    propertyType: "office",
    saleDate: "2023-02-10",
    salePrice: 48000000,
    pricePerSqFt: 400,
    capRate: 6.1,
    sqFt: 120000,
    yearBuilt: 2005,
    buyer: "KBS Realty",
    seller: "Lincoln Property Co",
  },
  {
    compId: "COMP-003",
    propertyName: "Gateway Industrial Park",
    address: "8900 Gateway Blvd",
    city: "Dallas",
    state: "TX",
    propertyType: "industrial",
    saleDate: "2024-01-20",
    salePrice: 67500000,
    pricePerSqFt: 150,
    capRate: 4.8,
    sqFt: 450000,
    yearBuilt: 2020,
    buyer: "Prologis",
    seller: "Duke Realty",
  },
];

const MOCK_MARKET_DATA: CoStarMarketData[] = [
  {
    market: "Austin",
    submarket: "CBD",
    propertyType: "office",
    period: "2024-Q4",
    vacancyRate: 0.142,
    askingRentPerSqFt: 52.5,
    effectiveRentPerSqFt: 48.75,
    absorptionSqFt: 125000,
    deliveriesSqFt: 200000,
    underConstructionSqFt: 350000,
    capRate: 5.5,
    inventorySqFt: 15000000,
  },
  {
    market: "Dallas",
    submarket: "Northwest Dallas",
    propertyType: "industrial",
    period: "2024-Q4",
    vacancyRate: 0.068,
    askingRentPerSqFt: 8.25,
    effectiveRentPerSqFt: 7.9,
    absorptionSqFt: 2500000,
    deliveriesSqFt: 3200000,
    underConstructionSqFt: 4100000,
    capRate: 4.9,
    inventorySqFt: 180000000,
  },
];

// --- MCP Tool Functions (Read-Only) ---

export async function costarSearchProperties(input: {
  city?: string;
  state?: string;
  propertyType?: string;
  minSqFt?: number;
  maxSqFt?: number;
}): Promise<CoStarProperty[]> {
  log.info(input, "Searching properties on CoStar");

  let results = [...MOCK_PROPERTIES];
  if (input.city)
    results = results.filter(
      (p) => p.city.toLowerCase() === input.city!.toLowerCase(),
    );
  if (input.state)
    results = results.filter(
      (p) => p.state.toLowerCase() === input.state!.toLowerCase(),
    );
  if (input.propertyType)
    results = results.filter((p) => p.propertyType === input.propertyType);
  if (input.minSqFt)
    results = results.filter((p) => p.buildingSqFt >= input.minSqFt!);
  if (input.maxSqFt)
    results = results.filter((p) => p.buildingSqFt <= input.maxSqFt!);

  return results;
}

export async function costarGetComps(input: {
  city?: string;
  state?: string;
  propertyType?: string;
  minSalePrice?: number;
  maxSalePrice?: number;
}): Promise<CoStarComp[]> {
  log.info(input, "Getting comps from CoStar");

  let results = [...MOCK_COMPS];
  if (input.city)
    results = results.filter(
      (c) => c.city.toLowerCase() === input.city!.toLowerCase(),
    );
  if (input.state)
    results = results.filter(
      (c) => c.state.toLowerCase() === input.state!.toLowerCase(),
    );
  if (input.propertyType)
    results = results.filter((c) => c.propertyType === input.propertyType);
  if (input.minSalePrice)
    results = results.filter((c) => c.salePrice >= input.minSalePrice!);
  if (input.maxSalePrice)
    results = results.filter((c) => c.salePrice <= input.maxSalePrice!);

  return results;
}

export async function costarMarketData(input: {
  market: string;
  propertyType?: string;
  period?: string;
}): Promise<CoStarMarketData[]> {
  log.info(input, "Getting market data from CoStar");

  let results = [...MOCK_MARKET_DATA];
  results = results.filter(
    (m) => m.market.toLowerCase() === input.market.toLowerCase(),
  );
  if (input.propertyType)
    results = results.filter((m) => m.propertyType === input.propertyType);
  if (input.period) results = results.filter((m) => m.period === input.period);

  return results;
}

// --- Tool Definitions ---

export const costarTools = [
  {
    name: "costar_search_properties",
    description:
      "Search for commercial real estate properties on CoStar (read-only)",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string" },
        state: { type: "string" },
        propertyType: {
          type: "string",
          enum: [
            "office",
            "industrial",
            "retail",
            "multifamily",
            "hospitality",
            "land",
          ],
        },
        minSqFt: { type: "number" },
        maxSqFt: { type: "number" },
      },
    },
    execute: costarSearchProperties,
  },
  {
    name: "costar_get_comps",
    description: "Get comparable sale transactions from CoStar (read-only)",
    inputSchema: {
      type: "object",
      properties: {
        city: { type: "string" },
        state: { type: "string" },
        propertyType: { type: "string" },
        minSalePrice: { type: "number" },
        maxSalePrice: { type: "number" },
      },
    },
    execute: costarGetComps,
  },
  {
    name: "costar_market_data",
    description:
      "Get market analytics data from CoStar (vacancy, rents, absorption, etc.)",
    inputSchema: {
      type: "object",
      properties: {
        market: { type: "string" },
        propertyType: { type: "string" },
        period: { type: "string" },
      },
      required: ["market"],
    },
    execute: costarMarketData,
  },
] as const;
