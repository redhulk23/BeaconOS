import type { AgentContext } from "@beacon-os/sdk";
import { UNDERWRITING_SYSTEM_PROMPT, EXTRACT_FINANCIALS_PROMPT, GENERATE_PRO_FORMA_PROMPT, EVALUATE_UNDERWRITING_PROMPT } from "./prompts.js";

export async function underwritingHandler(ctx: AgentContext, input: Record<string, unknown>): Promise<unknown> {
  const task = (input.task as string) ?? "full_analysis";

  switch (task) {
    case "extract_financials":
      return handleExtractFinancials(ctx, input);
    case "generate_pro_forma":
      return handleProForma(ctx, input);
    case "evaluate":
      return handleEvaluate(ctx, input);
    case "full_analysis":
      return handleFullAnalysis(ctx, input);
    default:
      return handleFullAnalysis(ctx, input);
  }
}

async function handleExtractFinancials(ctx: AgentContext, input: Record<string, unknown>) {
  ctx.log.info("Extracting and analyzing financials");

  const propertyCode = input.propertyCode as string | undefined;

  let financialData: unknown = input.financialData;
  if (!financialData && propertyCode) {
    financialData = await ctx.tools.invoke("yardi_read_financials", {
      propertyCode,
      period: (input.period as string) ?? "2024",
    });
  }

  let rentRoll: unknown = input.rentRoll;
  if (!rentRoll && propertyCode) {
    rentRoll = await ctx.tools.invoke("yardi_read_rent_roll", { propertyCode });
  }

  let marketData: unknown = null;
  if (input.market) {
    marketData = await ctx.tools.invoke("costar_market_data", {
      market: input.market as string,
      propertyType: input.propertyType as string,
    });
  }

  const response = await ctx.model.complete([
    { role: "system", content: UNDERWRITING_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${EXTRACT_FINANCIALS_PROMPT}\n\nFinancials:\n${JSON.stringify(financialData, null, 2)}\n\nRent Roll:\n${JSON.stringify(rentRoll, null, 2)}\n\nMarket Data:\n${JSON.stringify(marketData, null, 2)}`,
    },
  ]);

  const analysis = {
    financialAnalysis: response.content,
    sources: { financialData, rentRoll, marketData },
    status: "analyzed",
  };

  await ctx.memory.set("financial_analysis", analysis);
  ctx.log.info("Financial extraction and analysis complete");

  return analysis;
}

async function handleProForma(ctx: AgentContext, input: Record<string, unknown>) {
  ctx.log.info("Generating pro forma projections");

  const financialAnalysis = input.financialAnalysis ?? await ctx.memory.get("financial_analysis");

  let comps: unknown = null;
  if (input.city) {
    comps = await ctx.tools.invoke("costar_get_comps", {
      city: input.city as string,
      propertyType: input.propertyType as string,
    });
  }

  const response = await ctx.model.complete([
    { role: "system", content: UNDERWRITING_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${GENERATE_PRO_FORMA_PROMPT}\n\nFinancial Analysis:\n${JSON.stringify(financialAnalysis, null, 2)}\n\nComparables:\n${JSON.stringify(comps, null, 2)}\n\nAssumptions:\n${JSON.stringify(input.assumptions ?? {}, null, 2)}`,
    },
  ]);

  const proForma = {
    proForma: response.content,
    comps,
    status: "projected",
  };

  await ctx.memory.set("pro_forma", proForma);
  ctx.log.info("Pro forma generation complete");

  return proForma;
}

async function handleEvaluate(ctx: AgentContext, input: Record<string, unknown>) {
  ctx.log.info("Evaluating underwriting quality");

  const analysis = input.analysis ?? await ctx.memory.get("financial_analysis");
  const proForma = input.proForma ?? await ctx.memory.get("pro_forma");

  const response = await ctx.model.complete([
    { role: "system", content: UNDERWRITING_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${EVALUATE_UNDERWRITING_PROMPT}\n\nAnalysis:\n${JSON.stringify(analysis, null, 2)}\n\nPro Forma:\n${JSON.stringify(proForma, null, 2)}`,
    },
  ]);

  return {
    evaluation: response.content,
    status: "evaluated",
  };
}

async function handleFullAnalysis(ctx: AgentContext, input: Record<string, unknown>) {
  ctx.log.info("Running full underwriting analysis");

  const financials = await handleExtractFinancials(ctx, input);
  const proForma = await handleProForma(ctx, { ...input, financialAnalysis: financials });
  const evaluation = await handleEvaluate(ctx, { analysis: financials, proForma });

  return {
    financials,
    proForma,
    evaluation,
    status: "complete",
  };
}
