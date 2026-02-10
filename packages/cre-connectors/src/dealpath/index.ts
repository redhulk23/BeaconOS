import { z } from "zod";
import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-connectors:dealpath");

// --- Schemas ---

export const DealPathDealSchema = z.object({
  dealId: z.string(),
  name: z.string(),
  propertyType: z.enum(["office", "retail", "industrial", "multifamily", "mixed_use"]),
  address: z.string(),
  city: z.string(),
  state: z.string(),
  stage: z.enum(["screening", "underwriting", "loi", "due_diligence", "closing", "closed", "dead"]),
  askingPrice: z.number(),
  targetPrice: z.number().optional(),
  sqft: z.number(),
  units: z.number().optional(),
  capRate: z.number().optional(),
  irr: z.number().optional(),
  assignedTo: z.string(),
  source: z.string(),
  createdDate: z.string(),
  lastUpdated: z.string(),
});

export const DealPathUnderwritingSchema = z.object({
  dealId: z.string(),
  purchasePrice: z.number(),
  closingCosts: z.number(),
  renovationBudget: z.number(),
  stabilizedNoi: z.number(),
  goingInCapRate: z.number(),
  exitCapRate: z.number(),
  holdPeriod: z.number(),
  leveragePercent: z.number(),
  interestRate: z.number(),
  unleveredIrr: z.number(),
  leveredIrr: z.number(),
  equityMultiple: z.number(),
  cashOnCash: z.number(),
});

export const DealPathChecklistSchema = z.object({
  dealId: z.string(),
  items: z.array(z.object({
    itemId: z.string(),
    category: z.string(),
    description: z.string(),
    status: z.enum(["not_started", "in_progress", "completed", "waived", "flagged"]),
    assignedTo: z.string().optional(),
    dueDate: z.string().optional(),
    notes: z.string().optional(),
  })),
  completionPercent: z.number(),
});

export type DealPathDeal = z.infer<typeof DealPathDealSchema>;
export type DealPathUnderwriting = z.infer<typeof DealPathUnderwritingSchema>;
export type DealPathChecklist = z.infer<typeof DealPathChecklistSchema>;

// --- Mock Data ---

const MOCK_DEALS: DealPathDeal[] = [
  {
    dealId: "DP001", name: "Beacon Tower Acquisition", propertyType: "office", address: "100 Main St", city: "Austin", state: "TX",
    stage: "due_diligence", askingPrice: 28_000_000, targetPrice: 25_500_000, sqft: 125000, capRate: 0.058, irr: 0.092,
    assignedTo: "John Smith", source: "CBRE", createdDate: "2024-03-01", lastUpdated: "2024-06-20",
  },
  {
    dealId: "DP002", name: "Sunset Industrial Park", propertyType: "industrial", address: "800 Industrial Blvd", city: "Dallas", state: "TX",
    stage: "screening", askingPrice: 15_000_000, sqft: 200000, capRate: 0.072,
    assignedTo: "Jane Doe", source: "Marcus & Millichap", createdDate: "2024-06-15", lastUpdated: "2024-06-18",
  },
];

const MOCK_UNDERWRITING: DealPathUnderwriting = {
  dealId: "DP001", purchasePrice: 25_500_000, closingCosts: 510_000, renovationBudget: 2_000_000,
  stabilizedNoi: 1_785_000, goingInCapRate: 0.07, exitCapRate: 0.065, holdPeriod: 7,
  leveragePercent: 0.65, interestRate: 0.055, unleveredIrr: 0.092, leveredIrr: 0.142,
  equityMultiple: 2.1, cashOnCash: 0.085,
};

const MOCK_CHECKLIST: DealPathChecklist = {
  dealId: "DP001",
  completionPercent: 45,
  items: [
    { itemId: "CL001", category: "Legal", description: "Title search and review", status: "completed", assignedTo: "Legal Team", dueDate: "2024-06-15" },
    { itemId: "CL002", category: "Legal", description: "Survey review", status: "in_progress", assignedTo: "Legal Team", dueDate: "2024-06-30" },
    { itemId: "CL003", category: "Financial", description: "T-12 operating statement review", status: "completed", assignedTo: "Analyst", dueDate: "2024-06-10" },
    { itemId: "CL004", category: "Financial", description: "Rent roll audit", status: "in_progress", assignedTo: "Analyst", dueDate: "2024-07-01" },
    { itemId: "CL005", category: "Physical", description: "Phase I environmental", status: "not_started", assignedTo: "Environmental Consultant", dueDate: "2024-07-15" },
    { itemId: "CL006", category: "Physical", description: "Property condition assessment", status: "not_started", dueDate: "2024-07-15" },
    { itemId: "CL007", category: "Tenant", description: "Estoppel certificates", status: "in_progress", assignedTo: "Property Manager", dueDate: "2024-07-01" },
    { itemId: "CL008", category: "Tenant", description: "SNDA agreements", status: "not_started", dueDate: "2024-07-15" },
  ],
};

// --- MCP Tool Functions ---

export async function dealpathGetDeals(input: { stage?: string; propertyType?: string }): Promise<DealPathDeal[]> {
  log.info(input, "Getting deals from DealPath");
  return MOCK_DEALS.filter((d) => {
    if (input.stage && d.stage !== input.stage) return false;
    if (input.propertyType && d.propertyType !== input.propertyType) return false;
    return true;
  });
}

export async function dealpathGetUnderwriting(input: { dealId: string }): Promise<DealPathUnderwriting> {
  log.info({ dealId: input.dealId }, "Getting underwriting from DealPath");
  return MOCK_UNDERWRITING;
}

export async function dealpathGetChecklist(input: { dealId: string }): Promise<DealPathChecklist> {
  log.info({ dealId: input.dealId }, "Getting DD checklist from DealPath");
  return MOCK_CHECKLIST;
}

export async function dealpathUpdateDealStage(input: { dealId: string; stage: string; notes?: string }): Promise<{ dealId: string; stage: string; status: string }> {
  log.info(input, "Updating deal stage in DealPath");
  return { dealId: input.dealId, stage: input.stage, status: "updated" };
}

// --- Tool Definitions ---

export const dealpathTools = [
  {
    name: "dealpath_get_deals",
    description: "Get investment deals from DealPath pipeline by stage or property type",
    inputSchema: { type: "object", properties: { stage: { type: "string" }, propertyType: { type: "string" } } },
    execute: dealpathGetDeals,
  },
  {
    name: "dealpath_get_underwriting",
    description: "Get underwriting assumptions and returns for a deal from DealPath",
    inputSchema: { type: "object", properties: { dealId: { type: "string" } }, required: ["dealId"] },
    execute: dealpathGetUnderwriting,
  },
  {
    name: "dealpath_get_checklist",
    description: "Get the due diligence checklist and status for a deal from DealPath",
    inputSchema: { type: "object", properties: { dealId: { type: "string" } }, required: ["dealId"] },
    execute: dealpathGetChecklist,
  },
  {
    name: "dealpath_update_deal_stage",
    description: "Update the stage of a deal in DealPath pipeline",
    inputSchema: { type: "object", properties: { dealId: { type: "string" }, stage: { type: "string" }, notes: { type: "string" } }, required: ["dealId", "stage"] },
    execute: dealpathUpdateDealStage,
  },
] as const;
