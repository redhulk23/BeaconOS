import type { AgentContext } from "@beacon-os/sdk";
import {
  DUE_DILIGENCE_SYSTEM_PROMPT,
  CLASSIFY_DOCUMENTS_PROMPT,
  EXTRACT_DATA_PROMPT,
  COMPARE_ESTOPPELS_PROMPT,
  FLAG_RISKS_PROMPT,
  UPDATE_CHECKLIST_PROMPT,
} from "./prompts.js";

export async function dueDiligenceHandler(
  ctx: AgentContext,
  input: Record<string, unknown>,
): Promise<unknown> {
  const task = (input.task as string) ?? "classify_documents";

  switch (task) {
    case "classify_documents":
      return handleClassifyDocuments(ctx, input);
    case "extract_data":
      return handleExtractData(ctx, input);
    case "compare_estoppels":
      return handleCompareEstoppels(ctx, input);
    case "flag_risks":
      return handleFlagRisks(ctx, input);
    case "update_checklist":
      return handleUpdateChecklist(ctx, input);
    default:
      return handleClassifyDocuments(ctx, input);
  }
}

async function handleClassifyDocuments(
  ctx: AgentContext,
  input: Record<string, unknown>,
) {
  ctx.log.info("Classifying due diligence documents");

  const documentText = input.documentText as string | undefined;
  const documentName = (input.documentName as string) ?? "Unknown document";

  if (!documentText) {
    throw new Error("No document text provided for classification");
  }

  const response = await ctx.model.complete([
    { role: "system", content: DUE_DILIGENCE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${CLASSIFY_DOCUMENTS_PROMPT}

Document name: ${documentName}
Document content (first 5000 chars):
${documentText.slice(0, 5000)}`,
    },
  ]);

  const classification = response.content;
  await ctx.memory.set("document_classification", classification);
  ctx.log.info({ documentName }, "Document classification complete");

  return { classification, documentName, status: "classified" };
}

async function handleExtractData(
  ctx: AgentContext,
  input: Record<string, unknown>,
) {
  ctx.log.info("Extracting data from due diligence document");

  const documentText = input.documentText as string | undefined;
  const documentType = (input.documentType as string) ?? "unknown";
  const classification =
    input.classification ?? (await ctx.memory.get("document_classification"));

  if (!documentText) {
    throw new Error("No document text provided for extraction");
  }

  const response = await ctx.model.complete([
    { role: "system", content: DUE_DILIGENCE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${EXTRACT_DATA_PROMPT}

Document type: ${documentType}
Classification: ${JSON.stringify(classification)}

Document content:
${documentText}`,
    },
  ]);

  const extractedData = response.content;
  await ctx.memory.set("extracted_data", extractedData);
  ctx.log.info({ documentType }, "Data extraction complete");

  return { extractedData, documentType, status: "extracted" };
}

async function handleCompareEstoppels(
  ctx: AgentContext,
  input: Record<string, unknown>,
) {
  ctx.log.info("Comparing estoppel certificates against lease abstracts");

  const estoppelData = input.estoppelData as
    | Record<string, unknown>
    | undefined;
  const leaseData = input.leaseData as Record<string, unknown> | undefined;

  if (!estoppelData) {
    throw new Error("No estoppel data provided for comparison");
  }
  if (!leaseData) {
    throw new Error("No lease data provided for comparison");
  }

  const response = await ctx.model.complete([
    { role: "system", content: DUE_DILIGENCE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${COMPARE_ESTOPPELS_PROMPT}

Estoppel Certificate Data:
${JSON.stringify(estoppelData, null, 2)}

Lease Abstract Data:
${JSON.stringify(leaseData, null, 2)}`,
    },
  ]);

  const comparison = response.content;
  await ctx.memory.set("estoppel_comparison", comparison);
  ctx.log.info("Estoppel comparison complete");

  return { comparison, status: "compared" };
}

async function handleFlagRisks(
  ctx: AgentContext,
  input: Record<string, unknown>,
) {
  ctx.log.info("Flagging due diligence risks");

  const extractedData =
    input.extractedData ?? (await ctx.memory.get("extracted_data"));
  const estoppelComparison =
    input.estoppelComparison ?? (await ctx.memory.get("estoppel_comparison"));
  const dealId = input.dealId as string | undefined;

  const response = await ctx.model.complete([
    { role: "system", content: DUE_DILIGENCE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${FLAG_RISKS_PROMPT}

Deal ID: ${dealId ?? "N/A"}

Due Diligence Findings:
${JSON.stringify(extractedData, null, 2)}

Estoppel Comparison (if available):
${estoppelComparison ? JSON.stringify(estoppelComparison, null, 2) : "Not yet completed"}

Analyze all findings and flag material risks.`,
    },
  ]);

  const risks = response.content;
  await ctx.memory.set("risk_flags", risks);
  ctx.log.info("Risk flagging complete");

  return { risks, status: "flagged" };
}

async function handleUpdateChecklist(
  ctx: AgentContext,
  input: Record<string, unknown>,
) {
  ctx.log.info("Updating due diligence checklist");

  const dealId = (input.dealId as string) ?? "";
  const currentChecklist = input.checklist as
    | Record<string, unknown>
    | undefined;
  const riskFlags = input.riskFlags ?? (await ctx.memory.get("risk_flags"));
  const extractedData =
    input.extractedData ?? (await ctx.memory.get("extracted_data"));

  const response = await ctx.model.complete([
    { role: "system", content: DUE_DILIGENCE_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${UPDATE_CHECKLIST_PROMPT}

Deal ID: ${dealId}

Current Checklist:
${currentChecklist ? JSON.stringify(currentChecklist, null, 2) : "No existing checklist provided"}

Risk Flags:
${JSON.stringify(riskFlags, null, 2)}

Extracted Data:
${JSON.stringify(extractedData, null, 2)}

Update the checklist based on findings and flag any items that need immediate attention.`,
    },
  ]);

  ctx.log.info({ dealId }, "Checklist update complete");

  return {
    updatedChecklist: response.content,
    dealId,
    status: "updated",
  };
}
