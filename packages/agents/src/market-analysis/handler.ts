import type { AgentContext } from "@beacon-os/sdk";
import {
  MARKET_ANALYSIS_SYSTEM_PROMPT,
  SEARCH_COMPS_PROMPT,
  SCORE_COMPS_PROMPT,
  ANALYZE_SUBMARKET_PROMPT,
  GENERATE_REPORT_PROMPT,
} from "./prompts.js";

export async function marketAnalysisHandler(
  ctx: AgentContext,
  input: Record<string, unknown>,
): Promise<unknown> {
  const task = (input.task as string) ?? "search_comps";

  switch (task) {
    case "search_comps":
      return handleSearchComps(ctx, input);
    case "score_comps":
      return handleScoreComps(ctx, input);
    case "analyze_submarket":
      return handleAnalyzeSubmarket(ctx, input);
    case "generate_report":
      return handleGenerateReport(ctx, input);
    default:
      return handleSearchComps(ctx, input);
  }
}

async function handleSearchComps(
  ctx: AgentContext,
  input: Record<string, unknown>,
) {
  ctx.log.info("Searching for comparable transactions");

  const propertyAddress = (input.propertyAddress as string) ?? "";
  const city = (input.city as string) ?? "Austin";
  const state = (input.state as string) ?? "TX";
  const propertyType = (input.propertyType as string) ?? "office";
  const sqft = (input.sqft as number) ?? 10000;
  const submarket = input.submarket as string | undefined;

  const response = await ctx.model.complete([
    { role: "system", content: MARKET_ANALYSIS_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${SEARCH_COMPS_PROMPT}

Subject Property:
- Address: ${propertyAddress}
- City/State: ${city}, ${state}
- Submarket: ${submarket ?? "N/A"}
- Property Type: ${propertyType}
- Size: ${sqft.toLocaleString()} SF

Search for comps within the same submarket and adjacent submarkets. Include both lease comps and sale comps where relevant.`,
    },
  ]);

  const comps = response.content;
  await ctx.memory.set("raw_comps", comps);
  ctx.log.info("Comp search complete");

  return { comps, status: "searched" };
}

async function handleScoreComps(
  ctx: AgentContext,
  input: Record<string, unknown>,
) {
  ctx.log.info("Scoring comparable transactions");

  const comps = input.comps ?? (await ctx.memory.get("raw_comps"));
  const subjectSqft = (input.sqft as number) ?? 10000;
  const subjectPropertyType = (input.propertyType as string) ?? "office";
  const subjectSubmarket = (input.submarket as string) ?? "";

  const response = await ctx.model.complete([
    { role: "system", content: MARKET_ANALYSIS_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${SCORE_COMPS_PROMPT}

Subject Property:
- Property Type: ${subjectPropertyType}
- Size: ${subjectSqft.toLocaleString()} SF
- Submarket: ${subjectSubmarket}

Comparable data:
${JSON.stringify(comps, null, 2)}`,
    },
  ]);

  const scoredComps = response.content;
  await ctx.memory.set("scored_comps", scoredComps);
  ctx.log.info("Comp scoring complete");

  return { scoredComps, status: "scored" };
}

async function handleAnalyzeSubmarket(
  ctx: AgentContext,
  input: Record<string, unknown>,
) {
  ctx.log.info("Analyzing submarket fundamentals");

  const city = (input.city as string) ?? "Austin";
  const state = (input.state as string) ?? "TX";
  const submarket = (input.submarket as string) ?? "CBD";
  const propertyType = (input.propertyType as string) ?? "office";

  const response = await ctx.model.complete([
    { role: "system", content: MARKET_ANALYSIS_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${ANALYZE_SUBMARKET_PROMPT}

Location:
- City: ${city}
- State: ${state}
- Submarket: ${submarket}
- Property Type: ${propertyType}

Provide a thorough analysis of current market conditions and near-term outlook.`,
    },
  ]);

  const analysis = response.content;
  await ctx.memory.set("submarket_analysis", analysis);
  ctx.log.info({ submarket }, "Submarket analysis complete");

  return { analysis, status: "analyzed" };
}

async function handleGenerateReport(
  ctx: AgentContext,
  input: Record<string, unknown>,
) {
  ctx.log.info("Generating market analysis report");

  const scoredComps =
    input.scoredComps ?? (await ctx.memory.get("scored_comps"));
  const submarketAnalysis =
    input.submarketAnalysis ?? (await ctx.memory.get("submarket_analysis"));
  const propertyAddress = (input.propertyAddress as string) ?? "";
  const city = (input.city as string) ?? "Austin";
  const state = (input.state as string) ?? "TX";
  const propertyType = (input.propertyType as string) ?? "office";

  const response = await ctx.model.complete([
    { role: "system", content: MARKET_ANALYSIS_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${GENERATE_REPORT_PROMPT}

Subject Property:
- Address: ${propertyAddress}
- City/State: ${city}, ${state}
- Property Type: ${propertyType}

Scored Comparables:
${JSON.stringify(scoredComps, null, 2)}

Submarket Analysis:
${JSON.stringify(submarketAnalysis, null, 2)}

Generate a complete market analysis report with all required sections.`,
    },
  ]);

  ctx.log.info("Market analysis report generated");

  return {
    report: response.content,
    status: "completed",
  };
}
