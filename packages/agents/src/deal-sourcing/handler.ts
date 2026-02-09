import type { AgentContext } from "@beacon-os/sdk";
import { screenEntity, scanForFairHousing, type ScreeningRequest } from "@beacon-os/cre-compliance";
import { DEAL_SOURCING_SYSTEM_PROMPT, SEARCH_MARKET_PROMPT, SCREEN_DEAL_PROMPT, CONSOLIDATE_PROMPT } from "./prompts.js";

export async function dealSourcingHandler(ctx: AgentContext, input: Record<string, unknown>): Promise<unknown> {
  const task = (input.task as string) ?? "search_market";

  switch (task) {
    case "search_market":
      return handleSearchMarket(ctx, input);
    case "screen_deal":
      return handleScreenDeal(ctx, input);
    case "consolidate":
      return handleConsolidate(ctx, input);
    default:
      return handleSearchMarket(ctx, input);
  }
}

async function handleSearchMarket(ctx: AgentContext, input: Record<string, unknown>) {
  const market = (input.market as string) ?? "Austin";
  const propertyType = (input.propertyType as string) ?? "office";
  const criteria = (input.criteria as Record<string, unknown>) ?? {};

  ctx.log.info({ market, propertyType }, "Searching market for deals");

  const properties = await ctx.tools.invoke("costar_search_properties", {
    city: market,
    propertyType,
    minSqFt: (criteria.minSqFt as number) ?? 50000,
  });

  const comps = await ctx.tools.invoke("costar_get_comps", {
    city: market,
    propertyType,
  });

  const marketData = await ctx.tools.invoke("costar_market_data", {
    market,
    propertyType,
  });

  const response = await ctx.model.complete([
    { role: "system", content: DEAL_SOURCING_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${SEARCH_MARKET_PROMPT}\n\nMarket: ${market}\nProperty Type: ${propertyType}\nCriteria: ${JSON.stringify(criteria, null, 2)}\n\nProperties Found:\n${JSON.stringify(properties, null, 2)}\n\nComparables:\n${JSON.stringify(comps, null, 2)}\n\nMarket Data:\n${JSON.stringify(marketData, null, 2)}`,
    },
  ]);

  const results = {
    market,
    propertyType,
    analysis: response.content,
    properties,
    comps,
    marketData,
    status: "searched",
  };

  await ctx.memory.set(`market_results_${market.toLowerCase()}`, results);
  ctx.log.info({ market, resultCount: (properties as unknown[])?.length ?? 0 }, "Market search complete");

  return results;
}

async function handleScreenDeal(ctx: AgentContext, input: Record<string, unknown>) {
  const propertyId = input.propertyId as string;
  ctx.log.info({ propertyId }, "Screening deal");

  const counterparties = (input.counterparties as string[]) ?? [];
  const screeningResults = await Promise.all(
    counterparties.map((name) => {
      const request: ScreeningRequest = {
        entityName: name,
        entityType: "organization",
      };
      return screenEntity(request);
    }),
  );

  const hasComplianceConcerns = screeningResults.some((r) => r.status !== "clear");

  const response = await ctx.model.complete([
    { role: "system", content: DEAL_SOURCING_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${SCREEN_DEAL_PROMPT}\n\nProperty: ${JSON.stringify(input.property ?? {}, null, 2)}\n\nAML/KYC Screening Results:\n${JSON.stringify(screeningResults, null, 2)}\n\nCompliance Concerns: ${hasComplianceConcerns ? "YES - Review Required" : "None"}`,
    },
  ]);

  const marketingContent = input.marketingContent as string | undefined;
  let fairHousingResult = null;
  if (marketingContent) {
    fairHousingResult = scanForFairHousing(marketingContent);
  }

  return {
    propertyId,
    analysis: response.content,
    screeningResults,
    fairHousingResult,
    hasComplianceConcerns,
    status: "screened",
  };
}

async function handleConsolidate(ctx: AgentContext, input: Record<string, unknown>) {
  ctx.log.info("Consolidating deal search results");

  const markets = (input.markets as string[]) ?? ["austin", "dallas"];
  const allResults: unknown[] = [];

  for (const market of markets) {
    const marketResults = input[`${market}Results`] ?? await ctx.memory.get(`market_results_${market}`);
    if (marketResults) allResults.push(marketResults);
  }

  const response = await ctx.model.complete([
    { role: "system", content: DEAL_SOURCING_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${CONSOLIDATE_PROMPT}\n\nResults from ${markets.length} markets:\n${JSON.stringify(allResults, null, 2)}`,
    },
  ]);

  return {
    rankedPipeline: response.content,
    marketsSearched: markets,
    totalOpportunities: allResults.length,
    status: "consolidated",
  };
}
