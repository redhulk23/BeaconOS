import { z } from "zod";
import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-connectors:yardi");

// --- Schemas matching Yardi Voyager API shapes ---

export const YardiPropertySchema = z.object({
  propertyCode: z.string(),
  propertyName: z.string(),
  address: z.object({
    street1: z.string(),
    street2: z.string().optional(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
  }),
  propertyType: z.string(),
  totalUnits: z.number(),
  totalSqFt: z.number().optional(),
  yearBuilt: z.number().optional(),
});

export const YardiUnitSchema = z.object({
  unitCode: z.string(),
  propertyCode: z.string(),
  unitType: z.string(),
  sqFt: z.number(),
  bedrooms: z.number().optional(),
  bathrooms: z.number().optional(),
  marketRent: z.number(),
  status: z.enum(["vacant", "occupied", "notice", "down"]),
});

export const YardiLeaseSchema = z.object({
  leaseId: z.string(),
  propertyCode: z.string(),
  unitCode: z.string(),
  tenantCode: z.string(),
  tenantName: z.string(),
  leaseType: z.enum(["new", "renewal", "transfer", "month_to_month"]),
  leaseStartDate: z.string(),
  leaseEndDate: z.string(),
  monthlyRent: z.number(),
  securityDeposit: z.number().optional(),
  status: z.enum(["current", "past", "future", "eviction"]),
  charges: z
    .array(
      z.object({
        chargeCode: z.string(),
        description: z.string(),
        amount: z.number(),
        frequency: z.enum(["monthly", "annual", "one_time"]),
      }),
    )
    .default([]),
});

export const YardiFinancialSchema = z.object({
  propertyCode: z.string(),
  period: z.string(),
  glAccounts: z.array(
    z.object({
      accountCode: z.string(),
      accountName: z.string(),
      category: z.enum(["revenue", "expense", "asset", "liability"]),
      actual: z.number(),
      budget: z.number(),
      priorYear: z.number().optional(),
    }),
  ),
});

export type YardiProperty = z.infer<typeof YardiPropertySchema>;
export type YardiUnit = z.infer<typeof YardiUnitSchema>;
export type YardiLease = z.infer<typeof YardiLeaseSchema>;
export type YardiFinancial = z.infer<typeof YardiFinancialSchema>;

// --- Mock Data ---

const MOCK_PROPERTIES: YardiProperty[] = [
  {
    propertyCode: "PROP001",
    propertyName: "Beacon Tower",
    address: {
      street1: "100 Main St",
      city: "Austin",
      state: "TX",
      zip: "78701",
    },
    propertyType: "office",
    totalUnits: 50,
    totalSqFt: 125000,
    yearBuilt: 2015,
  },
  {
    propertyCode: "PROP002",
    propertyName: "Harbor View Apartments",
    address: {
      street1: "200 Harbor Blvd",
      city: "San Diego",
      state: "CA",
      zip: "92101",
    },
    propertyType: "multifamily",
    totalUnits: 120,
    totalSqFt: 96000,
    yearBuilt: 2019,
  },
];

const MOCK_UNITS: YardiUnit[] = [
  {
    unitCode: "101",
    propertyCode: "PROP001",
    unitType: "office",
    sqFt: 2500,
    marketRent: 5000,
    status: "occupied",
  },
  {
    unitCode: "102",
    propertyCode: "PROP001",
    unitType: "office",
    sqFt: 3000,
    marketRent: 6000,
    status: "vacant",
  },
  {
    unitCode: "A101",
    propertyCode: "PROP002",
    unitType: "1BR",
    sqFt: 750,
    bedrooms: 1,
    bathrooms: 1,
    marketRent: 1800,
    status: "occupied",
  },
  {
    unitCode: "A102",
    propertyCode: "PROP002",
    unitType: "2BR",
    sqFt: 1050,
    bedrooms: 2,
    bathrooms: 2,
    marketRent: 2400,
    status: "occupied",
  },
  {
    unitCode: "A103",
    propertyCode: "PROP002",
    unitType: "2BR",
    sqFt: 1050,
    bedrooms: 2,
    bathrooms: 2,
    marketRent: 2400,
    status: "notice",
  },
];

const MOCK_LEASES: YardiLease[] = [
  {
    leaseId: "LSE001",
    propertyCode: "PROP001",
    unitCode: "101",
    tenantCode: "T001",
    tenantName: "Acme Corp",
    leaseType: "new",
    leaseStartDate: "2024-01-01",
    leaseEndDate: "2028-12-31",
    monthlyRent: 5000,
    securityDeposit: 10000,
    status: "current",
    charges: [
      {
        chargeCode: "RENT",
        description: "Base Rent",
        amount: 5000,
        frequency: "monthly",
      },
      {
        chargeCode: "CAM",
        description: "Common Area Maintenance",
        amount: 850,
        frequency: "monthly",
      },
    ],
  },
  {
    leaseId: "LSE002",
    propertyCode: "PROP002",
    unitCode: "A101",
    tenantCode: "T002",
    tenantName: "John Smith",
    leaseType: "renewal",
    leaseStartDate: "2024-06-01",
    leaseEndDate: "2025-05-31",
    monthlyRent: 1800,
    securityDeposit: 1800,
    status: "current",
    charges: [
      {
        chargeCode: "RENT",
        description: "Base Rent",
        amount: 1800,
        frequency: "monthly",
      },
    ],
  },
];

// --- MCP Tool Functions ---

export async function yardiReadRentRoll(input: {
  propertyCode: string;
}): Promise<{
  property: YardiProperty;
  units: YardiUnit[];
  occupancy: { total: number; occupied: number; rate: number };
}> {
  log.info(
    { propertyCode: input.propertyCode },
    "Reading rent roll from Yardi",
  );

  const property = MOCK_PROPERTIES.find(
    (p) => p.propertyCode === input.propertyCode,
  );
  if (!property)
    throw new Error(`Property ${input.propertyCode} not found in Yardi`);

  const units = MOCK_UNITS.filter((u) => u.propertyCode === input.propertyCode);
  const occupied = units.filter((u) => u.status === "occupied").length;

  return {
    property,
    units,
    occupancy: {
      total: units.length,
      occupied,
      rate: units.length > 0 ? occupied / units.length : 0,
    },
  };
}

export async function yardiReadLease(input: {
  leaseId?: string;
  propertyCode?: string;
}): Promise<YardiLease[]> {
  log.info(input, "Reading lease(s) from Yardi");

  if (input.leaseId) {
    const lease = MOCK_LEASES.find((l) => l.leaseId === input.leaseId);
    return lease ? [lease] : [];
  }
  if (input.propertyCode) {
    return MOCK_LEASES.filter((l) => l.propertyCode === input.propertyCode);
  }
  return MOCK_LEASES;
}

export async function yardiWriteLease(input: {
  propertyCode: string;
  unitCode: string;
  tenantName: string;
  leaseStartDate: string;
  leaseEndDate: string;
  monthlyRent: number;
}): Promise<{ leaseId: string; status: string }> {
  log.info(
    { propertyCode: input.propertyCode, unitCode: input.unitCode },
    "Writing lease to Yardi",
  );

  // Mock — in production this would POST to Yardi Voyager API
  const leaseId = `LSE${String(Date.now()).slice(-6)}`;
  return { leaseId, status: "created" };
}

export async function yardiReadFinancials(input: {
  propertyCode: string;
  period: string;
}): Promise<YardiFinancial> {
  log.info(input, "Reading financials from Yardi");

  return {
    propertyCode: input.propertyCode,
    period: input.period,
    glAccounts: [
      {
        accountCode: "4000",
        accountName: "Rental Revenue",
        category: "revenue",
        actual: 125000,
        budget: 130000,
        priorYear: 118000,
      },
      {
        accountCode: "4100",
        accountName: "CAM Revenue",
        category: "revenue",
        actual: 21250,
        budget: 22000,
        priorYear: 20000,
      },
      {
        accountCode: "4200",
        accountName: "Parking Revenue",
        category: "revenue",
        actual: 8500,
        budget: 9000,
        priorYear: 8000,
      },
      {
        accountCode: "5000",
        accountName: "Property Taxes",
        category: "expense",
        actual: 18000,
        budget: 18500,
        priorYear: 17200,
      },
      {
        accountCode: "5100",
        accountName: "Insurance",
        category: "expense",
        actual: 4200,
        budget: 4000,
        priorYear: 3800,
      },
      {
        accountCode: "5200",
        accountName: "Utilities",
        category: "expense",
        actual: 9800,
        budget: 10000,
        priorYear: 9200,
      },
      {
        accountCode: "5300",
        accountName: "Repairs & Maintenance",
        category: "expense",
        actual: 6500,
        budget: 7000,
        priorYear: 5800,
      },
      {
        accountCode: "5400",
        accountName: "Management Fee",
        category: "expense",
        actual: 4650,
        budget: 4700,
        priorYear: 4400,
      },
    ],
  };
}

// --- Tool Definitions for MCP registration ---

export const yardiTools = [
  {
    name: "yardi_read_rent_roll",
    description: "Read the current rent roll for a property from Yardi Voyager",
    inputSchema: {
      type: "object",
      properties: { propertyCode: { type: "string" } },
      required: ["propertyCode"],
    },
    execute: yardiReadRentRoll,
  },
  {
    name: "yardi_read_lease",
    description:
      "Read lease details from Yardi Voyager by lease ID or property code",
    inputSchema: {
      type: "object",
      properties: {
        leaseId: { type: "string" },
        propertyCode: { type: "string" },
      },
    },
    execute: yardiReadLease,
  },
  {
    name: "yardi_write_lease",
    description: "Create a new lease in Yardi Voyager",
    inputSchema: {
      type: "object",
      properties: {
        propertyCode: { type: "string" },
        unitCode: { type: "string" },
        tenantName: { type: "string" },
        leaseStartDate: { type: "string" },
        leaseEndDate: { type: "string" },
        monthlyRent: { type: "number" },
      },
      required: [
        "propertyCode",
        "unitCode",
        "tenantName",
        "leaseStartDate",
        "leaseEndDate",
        "monthlyRent",
      ],
    },
    execute: yardiWriteLease,
  },
  {
    name: "yardi_read_financials",
    description:
      "Read financial statements (GL accounts) for a property from Yardi Voyager",
    inputSchema: {
      type: "object",
      properties: {
        propertyCode: { type: "string" },
        period: { type: "string" },
      },
      required: ["propertyCode", "period"],
    },
    execute: yardiReadFinancials,
  },
] as const;
