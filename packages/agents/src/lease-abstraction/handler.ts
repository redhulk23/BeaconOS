import type { AgentContext } from "@beacon-os/sdk";
import { classifyLease, calculateAsc842, type ClassificationInput } from "@beacon-os/cre-compliance";
import { LEASE_ABSTRACTION_SYSTEM_PROMPT, CLASSIFY_LEASE_PROMPT, WRITE_TO_SYSTEM_PROMPT } from "./prompts.js";

export async function leaseAbstractionHandler(ctx: AgentContext, input: Record<string, unknown>): Promise<unknown> {
  const task = (input.task as string) ?? "extract";

  switch (task) {
    case "extract":
      return handleExtract(ctx, input);
    case "classify_lease":
      return handleClassify(ctx, input);
    case "write_to_system":
      return handleWrite(ctx, input);
    default:
      return handleExtract(ctx, input);
  }
}

async function handleExtract(ctx: AgentContext, input: Record<string, unknown>) {
  ctx.log.info("Starting lease extraction");

  const documentText = input.documentText as string | undefined;
  if (!documentText) {
    throw new Error("No document text provided for extraction");
  }

  const response = await ctx.model.complete([
    { role: "system", content: LEASE_ABSTRACTION_SYSTEM_PROMPT },
    { role: "user", content: `Extract all lease data points from the following document:\n\n${documentText}` },
  ]);

  const extraction = response.content;

  await ctx.memory.set("current_extraction", extraction);
  ctx.log.info("Lease extraction complete");

  return { extraction, status: "extracted" };
}

async function handleClassify(ctx: AgentContext, input: Record<string, unknown>) {
  ctx.log.info("Starting ASC 842 classification");

  const extraction = input.extraction ?? await ctx.memory.get("current_extraction");
  if (!extraction) {
    throw new Error("No extraction data available for classification");
  }

  const response = await ctx.model.complete([
    { role: "system", content: LEASE_ABSTRACTION_SYSTEM_PROMPT },
    { role: "user", content: `${CLASSIFY_LEASE_PROMPT}\n\nLease data:\n${JSON.stringify(extraction, null, 2)}` },
  ]);

  const classificationInput: ClassificationInput = {
    transfersOwnership: (input.transfersOwnership as boolean) ?? false,
    hasBargainPurchaseOption: (input.hasBargainPurchaseOption as boolean) ?? false,
    leaseTermMonths: (input.leaseTermMonths as number) ?? 60,
    economicLifeMonths: (input.economicLifeMonths as number) ?? 480,
    pvOfPayments: (input.pvOfPayments as number) ?? 0,
    fairValue: (input.fairValue as number) ?? 0,
    isSpecializedAsset: (input.isSpecializedAsset as boolean) ?? false,
  };

  const ruleBasedResult = classifyLease(classificationInput);

  let asc842Calc = null;
  if (ruleBasedResult.classification === "financing") {
    asc842Calc = calculateAsc842({
      classification: "financing",
      monthlyPayment: (input.monthlyRent as number) ?? 0,
      leaseTermMonths: classificationInput.leaseTermMonths,
      discountRate: (input.discountRate as number) ?? 0.05,
    });
  }

  const result = {
    llmAnalysis: response.content,
    ruleBasedClassification: ruleBasedResult,
    asc842Calculation: asc842Calc,
    status: "classified",
  };

  await ctx.memory.set("classification_result", result);
  ctx.log.info({ classification: ruleBasedResult.classification }, "ASC 842 classification complete");

  return result;
}

async function handleWrite(ctx: AgentContext, input: Record<string, unknown>) {
  ctx.log.info("Writing to property management system");

  const extraction = input.extraction ?? await ctx.memory.get("current_extraction");
  const targetSystem = (input.targetSystem as string) ?? "yardi";

  const response = await ctx.model.complete([
    { role: "system", content: LEASE_ABSTRACTION_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${WRITE_TO_SYSTEM_PROMPT}\n\nTarget system: ${targetSystem}\nExtracted data:\n${JSON.stringify(extraction, null, 2)}`,
    },
  ]);

  ctx.log.info({ targetSystem }, "Lease written to PMS");

  return {
    writeResult: response.content,
    targetSystem,
    status: "written",
  };
}
