import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  varchar,
  numeric,
  date,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { tenants } from "./core.js";

// --- CRE Properties ---
export const creProperties = pgTable(
  "cre_properties",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    propertyType: varchar("property_type", { length: 50 }).notNull(),
    address: text("address").notNull(),
    city: varchar("city", { length: 100 }).notNull(),
    state: varchar("state", { length: 2 }).notNull(),
    zip: varchar("zip", { length: 10 }).notNull(),
    county: varchar("county", { length: 100 }),
    market: varchar("market", { length: 100 }),
    submarket: varchar("submarket", { length: 100 }),
    yearBuilt: integer("year_built"),
    totalSqft: integer("total_sqft"),
    totalUnits: integer("total_units"),
    floors: integer("floors"),
    parkingSpaces: integer("parking_spaces"),
    occupancyRate: numeric("occupancy_rate", { precision: 5, scale: 2 }),
    currentValue: numeric("current_value", { precision: 15, scale: 2 }),
    externalIds: jsonb("external_ids")
      .default({})
      .$type<Record<string, string>>(),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("cre_properties_tenant_id_idx").on(t.tenantId),
    index("cre_properties_type_idx").on(t.propertyType),
    index("cre_properties_market_idx").on(t.market),
  ],
);

// --- CRE Units ---
export const creUnits = pgTable(
  "cre_units",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    propertyId: text("property_id")
      .notNull()
      .references(() => creProperties.id),
    unitNumber: varchar("unit_number", { length: 50 }).notNull(),
    unitType: varchar("unit_type", { length: 50 }),
    sqft: integer("sqft"),
    floor: integer("floor"),
    status: varchar("status", { length: 30 }).notNull().default("vacant"),
    monthlyRent: numeric("monthly_rent", { precision: 12, scale: 2 }),
    marketRent: numeric("market_rent", { precision: 12, scale: 2 }),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("cre_units_property_id_idx").on(t.propertyId),
    index("cre_units_tenant_id_idx").on(t.tenantId),
  ],
);

// --- CRE Leases ---
export const creLeases = pgTable(
  "cre_leases",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    propertyId: text("property_id")
      .notNull()
      .references(() => creProperties.id),
    unitId: text("unit_id").references(() => creUnits.id),
    creTenantId: text("cre_tenant_id").references(() => creTenants.id),
    leaseType: varchar("lease_type", { length: 50 }).notNull(),
    status: varchar("status", { length: 30 }).notNull().default("active"),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    monthlyRent: numeric("monthly_rent", { precision: 12, scale: 2 }).notNull(),
    annualRent: numeric("annual_rent", { precision: 15, scale: 2 }),
    rentPerSqft: numeric("rent_per_sqft", { precision: 10, scale: 2 }),
    securityDeposit: numeric("security_deposit", { precision: 12, scale: 2 }),
    escalationType: varchar("escalation_type", { length: 30 }),
    escalationRate: numeric("escalation_rate", { precision: 5, scale: 2 }),
    camCharges: numeric("cam_charges", { precision: 12, scale: 2 }),
    insuranceCharges: numeric("insurance_charges", { precision: 12, scale: 2 }),
    taxCharges: numeric("tax_charges", { precision: 12, scale: 2 }),
    asc842Classification: varchar("asc842_classification", { length: 30 }),
    abstractedData: jsonb("abstracted_data").$type<Record<string, unknown>>(),
    externalIds: jsonb("external_ids")
      .default({})
      .$type<Record<string, string>>(),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("cre_leases_tenant_id_idx").on(t.tenantId),
    index("cre_leases_property_id_idx").on(t.propertyId),
    index("cre_leases_status_idx").on(t.status),
    index("cre_leases_end_date_idx").on(t.endDate),
  ],
);

// --- CRE Tenants (Commercial tenants, not platform tenants) ---
export const creTenants = pgTable(
  "cre_tenants",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    entityType: varchar("entity_type", { length: 50 }),
    industry: varchar("industry", { length: 100 }),
    creditRating: varchar("credit_rating", { length: 10 }),
    contactName: text("contact_name"),
    contactEmail: varchar("contact_email", { length: 255 }),
    contactPhone: varchar("contact_phone", { length: 20 }),
    address: text("address"),
    externalIds: jsonb("external_ids")
      .default({})
      .$type<Record<string, string>>(),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [index("cre_tenants_tenant_id_idx").on(t.tenantId)],
);

// --- CRE Critical Dates ---
export const creCriticalDates = pgTable(
  "cre_critical_dates",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    leaseId: text("lease_id").references(() => creLeases.id),
    propertyId: text("property_id").references(() => creProperties.id),
    dateType: varchar("date_type", { length: 50 }).notNull(),
    date: date("date").notNull(),
    description: text("description"),
    status: varchar("status", { length: 20 }).notNull().default("upcoming"),
    notifyDaysBefore: integer("notify_days_before").default(30),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("cre_critical_dates_tenant_id_idx").on(t.tenantId),
    index("cre_critical_dates_date_idx").on(t.date),
    index("cre_critical_dates_lease_id_idx").on(t.leaseId),
  ],
);

// --- CRE Documents ---
export const creDocuments = pgTable(
  "cre_documents",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    propertyId: text("property_id").references(() => creProperties.id),
    leaseId: text("lease_id").references(() => creLeases.id),
    documentType: varchar("document_type", { length: 50 }).notNull(),
    fileName: text("file_name").notNull(),
    fileSize: integer("file_size"),
    mimeType: varchar("mime_type", { length: 100 }),
    storagePath: text("storage_path").notNull(),
    extractionStatus: varchar("extraction_status", { length: 30 }).default(
      "pending",
    ),
    extractedData: jsonb("extracted_data").$type<Record<string, unknown>>(),
    confidenceScores:
      jsonb("confidence_scores").$type<Record<string, number>>(),
    ocrRequired: boolean("ocr_required").default(false),
    pageCount: integer("page_count"),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("cre_documents_tenant_id_idx").on(t.tenantId),
    index("cre_documents_property_id_idx").on(t.propertyId),
    index("cre_documents_type_idx").on(t.documentType),
  ],
);

// --- CRE Operating Statements ---
export const creOperatingStatements = pgTable(
  "cre_operating_statements",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    propertyId: text("property_id")
      .notNull()
      .references(() => creProperties.id),
    documentId: text("document_id").references(() => creDocuments.id),
    periodType: varchar("period_type", { length: 20 }).notNull(),
    periodStart: date("period_start").notNull(),
    periodEnd: date("period_end").notNull(),
    grossRevenue: numeric("gross_revenue", { precision: 15, scale: 2 }),
    effectiveGrossIncome: numeric("effective_gross_income", {
      precision: 15,
      scale: 2,
    }),
    totalExpenses: numeric("total_expenses", { precision: 15, scale: 2 }),
    noi: numeric("noi", { precision: 15, scale: 2 }),
    lineItems: jsonb("line_items").$type<Record<string, unknown>>(),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    index("cre_operating_statements_tenant_id_idx").on(t.tenantId),
    index("cre_operating_statements_property_id_idx").on(t.propertyId),
  ],
);
