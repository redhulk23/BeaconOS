import { z } from "zod";

// --- Property ---
export const PropertySchema = z.object({
  id: z.string(),
  name: z.string(),
  propertyType: z.enum([
    "office",
    "retail",
    "industrial",
    "multifamily",
    "mixed_use",
    "hospitality",
    "land",
    "special_purpose",
  ]),
  address: z.string(),
  city: z.string(),
  state: z.string().length(2),
  zip: z.string(),
  county: z.string().optional(),
  market: z.string().optional(),
  submarket: z.string().optional(),
  yearBuilt: z.number().optional(),
  totalSqft: z.number().optional(),
  totalUnits: z.number().optional(),
  floors: z.number().optional(),
  parkingSpaces: z.number().optional(),
  occupancyRate: z.number().min(0).max(100).optional(),
  currentValue: z.number().optional(),
  externalIds: z.record(z.string()).default({}),
});
export type Property = z.infer<typeof PropertySchema>;

// --- Unit ---
export const UnitSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  unitNumber: z.string(),
  unitType: z.string().optional(),
  sqft: z.number().optional(),
  floor: z.number().optional(),
  status: z.enum(["occupied", "vacant", "down", "model"]).default("vacant"),
  monthlyRent: z.number().optional(),
  marketRent: z.number().optional(),
});
export type Unit = z.infer<typeof UnitSchema>;

// --- Lease ---
export const LeaseSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  unitId: z.string().optional(),
  creTenantId: z.string().optional(),
  leaseType: z.enum([
    "gross",
    "net",
    "nn",
    "nnn",
    "modified_gross",
    "percentage",
    "ground",
  ]),
  status: z
    .enum(["active", "expired", "pending", "terminated"])
    .default("active"),
  startDate: z.string(),
  endDate: z.string(),
  monthlyRent: z.number(),
  annualRent: z.number().optional(),
  rentPerSqft: z.number().optional(),
  securityDeposit: z.number().optional(),
  escalationType: z
    .enum(["fixed", "cpi", "percentage", "step", "none"])
    .optional(),
  escalationRate: z.number().optional(),
  camCharges: z.number().optional(),
  insuranceCharges: z.number().optional(),
  taxCharges: z.number().optional(),
  asc842Classification: z.enum(["operating", "financing"]).optional(),
  abstractedData: z.record(z.unknown()).optional(),
  externalIds: z.record(z.string()).default({}),
});
export type Lease = z.infer<typeof LeaseSchema>;

// --- CRE Tenant ---
export const CRETenantSchema = z.object({
  id: z.string(),
  name: z.string(),
  entityType: z.string().optional(),
  industry: z.string().optional(),
  creditRating: z.string().optional(),
  contactName: z.string().optional(),
  contactEmail: z.string().email().optional(),
  contactPhone: z.string().optional(),
  address: z.string().optional(),
  externalIds: z.record(z.string()).default({}),
});
export type CRETenant = z.infer<typeof CRETenantSchema>;

// --- Market ---
export const MarketSchema = z.object({
  id: z.string(),
  name: z.string(),
  region: z.string(),
  state: z.string(),
  propertyType: z.string(),
  avgCapRate: z.number().optional(),
  avgRentPsf: z.number().optional(),
  vacancyRate: z.number().optional(),
  absorptionSqft: z.number().optional(),
  newSupplySqft: z.number().optional(),
  asOfDate: z.string().optional(),
});
export type Market = z.infer<typeof MarketSchema>;

// --- Comp ---
export const CompSchema = z.object({
  id: z.string(),
  propertyType: z.string(),
  transactionType: z.enum(["sale", "lease"]),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  date: z.string(),
  price: z.number().optional(),
  pricePerSqft: z.number().optional(),
  capRate: z.number().optional(),
  sqft: z.number().optional(),
  source: z.string().optional(),
  externalIds: z.record(z.string()).default({}),
});
export type Comp = z.infer<typeof CompSchema>;

// --- Financial (Operating Statement line items) ---
export const FinancialSchema = z.object({
  id: z.string(),
  propertyId: z.string(),
  periodType: z.enum(["monthly", "quarterly", "annual", "t12"]),
  periodStart: z.string(),
  periodEnd: z.string(),
  grossRevenue: z.number().optional(),
  effectiveGrossIncome: z.number().optional(),
  totalExpenses: z.number().optional(),
  noi: z.number().optional(),
  lineItems: z.record(z.number()).optional(),
});
export type Financial = z.infer<typeof FinancialSchema>;

// --- Document ---
export const DocumentSchema = z.object({
  id: z.string(),
  propertyId: z.string().optional(),
  leaseId: z.string().optional(),
  documentType: z.enum([
    "lease",
    "amendment",
    "rent_roll",
    "t12",
    "appraisal",
    "environmental",
    "survey",
    "title",
    "insurance",
    "other",
  ]),
  fileName: z.string(),
  fileSize: z.number().optional(),
  mimeType: z.string().optional(),
  storagePath: z.string(),
  extractionStatus: z
    .enum(["pending", "processing", "completed", "failed", "review"])
    .default("pending"),
  extractedData: z.record(z.unknown()).optional(),
  confidenceScores: z.record(z.number()).optional(),
  pageCount: z.number().optional(),
});
export type Document = z.infer<typeof DocumentSchema>;

// --- Critical Date ---
export const CriticalDateSchema = z.object({
  id: z.string(),
  leaseId: z.string().optional(),
  propertyId: z.string().optional(),
  dateType: z.enum([
    "lease_expiration",
    "renewal_option",
    "termination_option",
    "rent_escalation",
    "cam_reconciliation",
    "insurance_renewal",
    "tax_appeal_deadline",
    "inspection",
    "custom",
  ]),
  date: z.string(),
  description: z.string().optional(),
  status: z
    .enum(["upcoming", "acknowledged", "completed", "missed"])
    .default("upcoming"),
  notifyDaysBefore: z.number().default(30),
});
export type CriticalDate = z.infer<typeof CriticalDateSchema>;
