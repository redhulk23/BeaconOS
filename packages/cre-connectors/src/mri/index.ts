import { z } from "zod";
import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-connectors:mri");

// --- Schemas matching MRI Software API shapes ---

export const MriPropertySchema = z.object({
  entityId: z.string(),
  name: z.string(),
  address1: z.string(),
  address2: z.string().optional(),
  city: z.string(),
  stateCode: z.string(),
  postalCode: z.string(),
  propertyType: z.string(),
  unitCount: z.number(),
  grossArea: z.number().optional(),
});

export const MriLeaseSchema = z.object({
  leaseNumber: z.string(),
  entityId: z.string(),
  spaceId: z.string(),
  tenantId: z.string(),
  tenantName: z.string(),
  commencementDate: z.string(),
  expirationDate: z.string(),
  baseRent: z.number(),
  annualEscalation: z.number().optional(),
  leaseClassification: z.enum(["operating", "financing"]).optional(),
  status: z.enum(["active", "expired", "pending", "terminated"]),
});

export const MriPortfolioSchema = z.object({
  portfolioId: z.string(),
  name: z.string(),
  properties: z.array(MriPropertySchema),
  totalUnits: z.number(),
  totalGrossArea: z.number(),
  occupancyRate: z.number(),
});

export const MriAsc842Schema = z.object({
  leaseNumber: z.string(),
  classification: z.enum(["operating", "financing"]),
  rouAsset: z.number(),
  leaseLiability: z.number(),
  discountRate: z.number(),
  remainingTermMonths: z.number(),
  monthlyPayment: z.number(),
});

export type MriProperty = z.infer<typeof MriPropertySchema>;
export type MriLease = z.infer<typeof MriLeaseSchema>;
export type MriPortfolio = z.infer<typeof MriPortfolioSchema>;
export type MriAsc842 = z.infer<typeof MriAsc842Schema>;

// --- Mock Data ---

const MOCK_PROPERTIES: MriProperty[] = [
  {
    entityId: "MRI-E001",
    name: "Commerce Plaza",
    address1: "500 Commerce Dr",
    city: "Chicago",
    stateCode: "IL",
    postalCode: "60601",
    propertyType: "office",
    unitCount: 35,
    grossArea: 87500,
  },
  {
    entityId: "MRI-E002",
    name: "Riverside Industrial",
    address1: "1200 River Rd",
    city: "Dallas",
    stateCode: "TX",
    postalCode: "75201",
    propertyType: "industrial",
    unitCount: 12,
    grossArea: 240000,
  },
];

const MOCK_LEASES: MriLease[] = [
  {
    leaseNumber: "MRI-L001",
    entityId: "MRI-E001",
    spaceId: "SPC-301",
    tenantId: "MRI-T001",
    tenantName: "GlobalTech Inc",
    commencementDate: "2023-03-01",
    expirationDate: "2028-02-28",
    baseRent: 8750,
    annualEscalation: 3.0,
    leaseClassification: "operating",
    status: "active",
  },
  {
    leaseNumber: "MRI-L002",
    entityId: "MRI-E002",
    spaceId: "WH-A",
    tenantId: "MRI-T002",
    tenantName: "Logistics Partners LLC",
    commencementDate: "2022-01-01",
    expirationDate: "2031-12-31",
    baseRent: 24000,
    annualEscalation: 2.5,
    leaseClassification: "financing",
    status: "active",
  },
];

// --- MCP Tool Functions ---

export async function mriReadPortfolio(input: {
  portfolioId?: string;
}): Promise<MriPortfolio> {
  log.info(input, "Reading portfolio from MRI");

  const totalUnits = MOCK_PROPERTIES.reduce((sum, p) => sum + p.unitCount, 0);
  const totalArea = MOCK_PROPERTIES.reduce(
    (sum, p) => sum + (p.grossArea ?? 0),
    0,
  );

  return {
    portfolioId: input.portfolioId ?? "DEFAULT",
    name: "Main Portfolio",
    properties: MOCK_PROPERTIES,
    totalUnits,
    totalGrossArea: totalArea,
    occupancyRate: 0.92,
  };
}

export async function mriReadLease(input: {
  leaseNumber?: string;
  entityId?: string;
}): Promise<MriLease[]> {
  log.info(input, "Reading lease(s) from MRI");

  if (input.leaseNumber) {
    const lease = MOCK_LEASES.find((l) => l.leaseNumber === input.leaseNumber);
    return lease ? [lease] : [];
  }
  if (input.entityId) {
    return MOCK_LEASES.filter((l) => l.entityId === input.entityId);
  }
  return MOCK_LEASES;
}

export async function mriWriteLease(input: {
  entityId: string;
  spaceId: string;
  tenantName: string;
  commencementDate: string;
  expirationDate: string;
  baseRent: number;
}): Promise<{ leaseNumber: string; status: string }> {
  log.info(
    { entityId: input.entityId, spaceId: input.spaceId },
    "Writing lease to MRI",
  );

  const leaseNumber = `MRI-L${String(Date.now()).slice(-6)}`;
  return { leaseNumber, status: "created" };
}

export async function mriGetAsc842(input: {
  leaseNumber: string;
  discountRate?: number;
}): Promise<MriAsc842> {
  log.info(input, "Calculating ASC 842 from MRI");

  const lease = MOCK_LEASES.find((l) => l.leaseNumber === input.leaseNumber);
  if (!lease) throw new Error(`Lease ${input.leaseNumber} not found in MRI`);

  const rate = input.discountRate ?? 0.05;
  const startDate = new Date(lease.commencementDate);
  const endDate = new Date(lease.expirationDate);
  const remainingMonths = Math.max(
    0,
    Math.round((endDate.getTime() - Date.now()) / (30.44 * 24 * 3600 * 1000)),
  );
  const monthlyRate = rate / 12;
  const pvFactor =
    monthlyRate > 0
      ? (1 - Math.pow(1 + monthlyRate, -remainingMonths)) / monthlyRate
      : remainingMonths;
  const liability = lease.baseRent * pvFactor;

  return {
    leaseNumber: lease.leaseNumber,
    classification: lease.leaseClassification ?? "operating",
    rouAsset: liability,
    leaseLiability: liability,
    discountRate: rate,
    remainingTermMonths: remainingMonths,
    monthlyPayment: lease.baseRent,
  };
}

// --- Tool Definitions ---

export const mriTools = [
  {
    name: "mri_read_portfolio",
    description:
      "Read portfolio summary from MRI Software including all properties",
    inputSchema: {
      type: "object",
      properties: { portfolioId: { type: "string" } },
    },
    execute: mriReadPortfolio,
  },
  {
    name: "mri_read_lease",
    description:
      "Read lease details from MRI Software by lease number or entity ID",
    inputSchema: {
      type: "object",
      properties: {
        leaseNumber: { type: "string" },
        entityId: { type: "string" },
      },
    },
    execute: mriReadLease,
  },
  {
    name: "mri_write_lease",
    description: "Create a new lease record in MRI Software",
    inputSchema: {
      type: "object",
      properties: {
        entityId: { type: "string" },
        spaceId: { type: "string" },
        tenantName: { type: "string" },
        commencementDate: { type: "string" },
        expirationDate: { type: "string" },
        baseRent: { type: "number" },
      },
      required: [
        "entityId",
        "spaceId",
        "tenantName",
        "commencementDate",
        "expirationDate",
        "baseRent",
      ],
    },
    execute: mriWriteLease,
  },
  {
    name: "mri_asc842",
    description: "Calculate ASC 842 lease accounting data from MRI Software",
    inputSchema: {
      type: "object",
      properties: {
        leaseNumber: { type: "string" },
        discountRate: { type: "number" },
      },
      required: ["leaseNumber"],
    },
    execute: mriGetAsc842,
  },
] as const;
