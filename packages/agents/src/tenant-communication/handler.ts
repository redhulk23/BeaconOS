import type { AgentContext } from "@beacon-os/sdk";
import {
  TENANT_COMMUNICATION_SYSTEM_PROMPT,
  CLASSIFY_INQUIRY_PROMPT,
  DELINQUENCY_PROMPT,
  RENEWAL_OUTREACH_PROMPT,
} from "./prompts.js";

export async function tenantCommunicationHandler(
  ctx: AgentContext,
  input: Record<string, unknown>,
): Promise<unknown> {
  const task = (input.task as string) ?? "classify";

  switch (task) {
    case "classify":
      return handleClassify(ctx, input);
    case "respond":
      return handleRespond(ctx, input);
    case "delinquency":
      return handleDelinquency(ctx, input);
    case "renewal":
      return handleRenewal(ctx, input);
    default:
      return handleClassify(ctx, input);
  }
}

async function handleClassify(ctx: AgentContext, input: Record<string, unknown>) {
  ctx.log.info("Classifying tenant inquiry");

  const inquiry = input.inquiry as string | undefined;
  if (!inquiry) {
    throw new Error("No inquiry text provided for classification");
  }

  const response = await ctx.model.complete([
    { role: "system", content: TENANT_COMMUNICATION_SYSTEM_PROMPT },
    { role: "user", content: `${CLASSIFY_INQUIRY_PROMPT}\n\nTenant inquiry:\n${inquiry}` },
  ]);

  const classification = response.content;
  await ctx.memory.set("current_classification", classification);
  ctx.log.info("Inquiry classification complete");

  return { classification, status: "classified" };
}

async function handleRespond(ctx: AgentContext, input: Record<string, unknown>) {
  ctx.log.info("Generating tenant response");

  const inquiry = input.inquiry as string | undefined;
  const classification = input.classification ?? (await ctx.memory.get("current_classification"));
  const tenantName = (input.tenantName as string) ?? "Tenant";
  const propertyName = (input.propertyName as string) ?? "the property";

  const response = await ctx.model.complete([
    { role: "system", content: TENANT_COMMUNICATION_SYSTEM_PROMPT },
    {
      role: "user",
      content: `Generate a professional response to this tenant inquiry.

Tenant: ${tenantName}
Property: ${propertyName}
Classification: ${JSON.stringify(classification)}
Original inquiry: ${inquiry ?? "See classification"}

Requirements:
- Address the tenant by name
- Be specific and helpful
- Include next steps
- Provide contact information for follow-up`,
    },
  ]);

  await ctx.memory.set("draft_response", response.content);
  ctx.log.info("Response generation complete");

  return { response: response.content, status: "drafted" };
}

async function handleDelinquency(ctx: AgentContext, input: Record<string, unknown>) {
  ctx.log.info("Generating delinquency communication");

  const tenantName = (input.tenantName as string) ?? "Tenant";
  const propertyName = (input.propertyName as string) ?? "the property";
  const daysOverdue = (input.daysOverdue as number) ?? 1;
  const amountDue = (input.amountDue as number) ?? 0;
  const leaseId = input.leaseId as string | undefined;

  let stage: number;
  if (daysOverdue <= 5) stage = 1;
  else if (daysOverdue <= 15) stage = 2;
  else if (daysOverdue <= 30) stage = 3;
  else stage = 4;

  const response = await ctx.model.complete([
    { role: "system", content: TENANT_COMMUNICATION_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${DELINQUENCY_PROMPT}

Generate a Stage ${stage} delinquency communication.

Details:
- Tenant: ${tenantName}
- Property: ${propertyName}
- Lease ID: ${leaseId ?? "N/A"}
- Days overdue: ${daysOverdue}
- Amount due: $${amountDue.toLocaleString()}
- Stage: ${stage}`,
    },
  ]);

  ctx.log.info({ stage, daysOverdue }, "Delinquency communication generated");

  return {
    communication: response.content,
    stage,
    daysOverdue,
    amountDue,
    status: "generated",
  };
}

async function handleRenewal(ctx: AgentContext, input: Record<string, unknown>) {
  ctx.log.info("Generating renewal outreach");

  const tenantName = (input.tenantName as string) ?? "Tenant";
  const propertyName = (input.propertyName as string) ?? "the property";
  const leaseExpiration = (input.leaseExpiration as string) ?? "upcoming";
  const currentRent = input.currentRent as number | undefined;
  const proposedRent = input.proposedRent as number | undefined;
  const renewalTermYears = (input.renewalTermYears as number) ?? 5;

  const response = await ctx.model.complete([
    { role: "system", content: TENANT_COMMUNICATION_SYSTEM_PROMPT },
    {
      role: "user",
      content: `${RENEWAL_OUTREACH_PROMPT}

Details:
- Tenant: ${tenantName}
- Property: ${propertyName}
- Current lease expiration: ${leaseExpiration}
- Current rent: ${currentRent ? `$${currentRent.toLocaleString()}/SF` : "[TO BE DETERMINED]"}
- Proposed renewal rent: ${proposedRent ? `$${proposedRent.toLocaleString()}/SF` : "[TO BE DETERMINED]"}
- Proposed renewal term: ${renewalTermYears} years`,
    },
  ]);

  ctx.log.info({ tenantName, leaseExpiration }, "Renewal outreach generated");

  return {
    communication: response.content,
    leaseExpiration,
    renewalTermYears,
    status: "generated",
  };
}
