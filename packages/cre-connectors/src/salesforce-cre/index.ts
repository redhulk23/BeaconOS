import { z } from "zod";
import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-connectors:salesforce-cre");

// --- Schemas ---

export const SfContactSchema = z.object({
  contactId: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  email: z.string(),
  phone: z.string().optional(),
  company: z.string(),
  title: z.string().optional(),
  type: z.enum(["tenant", "broker", "investor", "vendor", "other"]),
  lastContactDate: z.string().optional(),
});

export const SfDealSchema = z.object({
  dealId: z.string(),
  name: z.string(),
  propertyName: z.string(),
  dealType: z.enum(["acquisition", "disposition", "lease", "financing"]),
  stage: z.enum(["prospecting", "qualification", "proposal", "negotiation", "closed_won", "closed_lost"]),
  amount: z.number(),
  probability: z.number(),
  closeDate: z.string(),
  contactId: z.string(),
  notes: z.string().optional(),
});

export const SfActivitySchema = z.object({
  activityId: z.string(),
  type: z.enum(["call", "email", "meeting", "task", "note"]),
  subject: z.string(),
  description: z.string().optional(),
  contactId: z.string().optional(),
  dealId: z.string().optional(),
  date: z.string(),
  status: z.enum(["completed", "pending", "cancelled"]),
});

export const SfPipelineSummarySchema = z.object({
  totalDeals: z.number(),
  totalValue: z.number(),
  weightedValue: z.number(),
  stageBreakdown: z.record(z.object({ count: z.number(), value: z.number() })),
  avgDaysInPipeline: z.number(),
});

export type SfContact = z.infer<typeof SfContactSchema>;
export type SfDeal = z.infer<typeof SfDealSchema>;
export type SfActivity = z.infer<typeof SfActivitySchema>;
export type SfPipelineSummary = z.infer<typeof SfPipelineSummarySchema>;

// --- Mock Data ---

const MOCK_CONTACTS: SfContact[] = [
  { contactId: "SF001", firstName: "Sarah", lastName: "Chen", email: "sarah.chen@acmecorp.com", phone: "512-555-0101", company: "Acme Corp", title: "VP of Real Estate", type: "tenant", lastContactDate: "2024-06-20" },
  { contactId: "SF002", firstName: "Mike", lastName: "Johnson", email: "mjohnson@cbre.com", phone: "512-555-0202", company: "CBRE", title: "Senior Broker", type: "broker", lastContactDate: "2024-06-18" },
  { contactId: "SF003", firstName: "Lisa", lastName: "Park", email: "lpark@investco.com", company: "InvestCo Capital", title: "Managing Director", type: "investor", lastContactDate: "2024-06-10" },
];

const MOCK_DEALS: SfDeal[] = [
  { dealId: "SFD001", name: "Beacon Tower — Acme Renewal", propertyName: "Beacon Tower", dealType: "lease", stage: "negotiation", amount: 1_500_000, probability: 0.75, closeDate: "2024-09-30", contactId: "SF001" },
  { dealId: "SFD002", name: "Harbor View — InvestCo Acquisition", propertyName: "Harbor View Apartments", dealType: "acquisition", stage: "qualification", amount: 45_000_000, probability: 0.3, closeDate: "2024-12-31", contactId: "SF003", notes: "Preliminary interest stage" },
];

// --- MCP Tool Functions ---

export async function sfGetContacts(input: { type?: string; company?: string; search?: string }): Promise<SfContact[]> {
  log.info(input, "Getting contacts from Salesforce CRE");
  return MOCK_CONTACTS.filter((c) => {
    if (input.type && c.type !== input.type) return false;
    if (input.company && !c.company.toLowerCase().includes(input.company.toLowerCase())) return false;
    if (input.search) {
      const term = input.search.toLowerCase();
      return c.firstName.toLowerCase().includes(term) || c.lastName.toLowerCase().includes(term) || c.email.toLowerCase().includes(term);
    }
    return true;
  });
}

export async function sfGetDeals(input: { stage?: string; dealType?: string; contactId?: string }): Promise<SfDeal[]> {
  log.info(input, "Getting deals from Salesforce CRE");
  return MOCK_DEALS.filter((d) => {
    if (input.stage && d.stage !== input.stage) return false;
    if (input.dealType && d.dealType !== input.dealType) return false;
    if (input.contactId && d.contactId !== input.contactId) return false;
    return true;
  });
}

export async function sfGetPipeline(input: { dealType?: string }): Promise<SfPipelineSummary> {
  log.info(input, "Getting pipeline summary from Salesforce CRE");
  const deals = input.dealType ? MOCK_DEALS.filter((d) => d.dealType === input.dealType) : MOCK_DEALS;
  const stageBreakdown: Record<string, { count: number; value: number }> = {};
  for (const deal of deals) {
    if (!stageBreakdown[deal.stage]) stageBreakdown[deal.stage] = { count: 0, value: 0 };
    stageBreakdown[deal.stage]!.count++;
    stageBreakdown[deal.stage]!.value += deal.amount;
  }
  return {
    totalDeals: deals.length,
    totalValue: deals.reduce((sum, d) => sum + d.amount, 0),
    weightedValue: deals.reduce((sum, d) => sum + d.amount * d.probability, 0),
    stageBreakdown,
    avgDaysInPipeline: 60,
  };
}

export async function sfLogActivity(input: { type: "call" | "email" | "meeting" | "task" | "note"; subject: string; description?: string; contactId?: string; dealId?: string }): Promise<{ activityId: string; status: string }> {
  log.info(input, "Logging activity in Salesforce CRE");
  return { activityId: `SFA${Date.now()}`, status: "completed" };
}

// --- Tool Definitions ---

export const salesforceCRETools = [
  {
    name: "sf_get_contacts",
    description: "Search for contacts in Salesforce CRE CRM by type, company, or name",
    inputSchema: { type: "object", properties: { type: { type: "string" }, company: { type: "string" }, search: { type: "string" } } },
    execute: sfGetContacts,
  },
  {
    name: "sf_get_deals",
    description: "Get deals from Salesforce CRE pipeline by stage, type, or contact",
    inputSchema: { type: "object", properties: { stage: { type: "string" }, dealType: { type: "string" }, contactId: { type: "string" } } },
    execute: sfGetDeals,
  },
  {
    name: "sf_get_pipeline",
    description: "Get pipeline summary with stage breakdown from Salesforce CRE",
    inputSchema: { type: "object", properties: { dealType: { type: "string" } } },
    execute: sfGetPipeline,
  },
  {
    name: "sf_log_activity",
    description: "Log a call, email, meeting, or note activity in Salesforce CRE",
    inputSchema: {
      type: "object",
      properties: { type: { type: "string" }, subject: { type: "string" }, description: { type: "string" }, contactId: { type: "string" }, dealId: { type: "string" } },
      required: ["type", "subject"],
    },
    execute: sfLogActivity,
  },
] as const;
