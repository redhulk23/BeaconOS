import { eq, and } from "drizzle-orm";
import { getDb, abacPolicies } from "@beacon-os/db";
import { generatePolicyId } from "@beacon-os/common";
import type { AbacPolicy } from "./types.js";

export class PolicyStore {
  async getPoliciesForTenant(tenantId: string): Promise<AbacPolicy[]> {
    const db = getDb();
    const rows = await db
      .select()
      .from(abacPolicies)
      .where(
        and(
          eq(abacPolicies.tenantId, tenantId),
          eq(abacPolicies.status, "active"),
        ),
      );

    return rows.map((row) => ({
      id: row.id,
      tenantId: row.tenantId,
      name: row.name,
      description: row.description ?? undefined,
      effect: row.effect as "allow" | "deny",
      subjectAttributes: (row.subjectAttributes ??
        []) as AbacPolicy["subjectAttributes"],
      resourceAttributes: (row.resourceAttributes ??
        []) as AbacPolicy["resourceAttributes"],
      actionAttributes: (row.actionAttributes ??
        []) as AbacPolicy["actionAttributes"],
      conditions: (row.conditions ?? []) as unknown as AbacPolicy["conditions"],
      priority: row.priority,
      status: row.status as "active" | "inactive",
    }));
  }

  async createPolicy(input: {
    tenantId: string;
    name: string;
    description?: string;
    effect: "allow" | "deny";
    subjectAttributes: AbacPolicy["subjectAttributes"];
    resourceAttributes: AbacPolicy["resourceAttributes"];
    actionAttributes: AbacPolicy["actionAttributes"];
    conditions?: AbacPolicy["conditions"];
    priority?: number;
    createdBy?: string;
  }): Promise<string> {
    const db = getDb();
    const id = generatePolicyId();

    await db.insert(abacPolicies).values({
      id,
      tenantId: input.tenantId,
      name: input.name,
      description: input.description,
      effect: input.effect,
      subjectAttributes: input.subjectAttributes as unknown as Record<
        string,
        unknown
      >,
      resourceAttributes: input.resourceAttributes as unknown as Record<
        string,
        unknown
      >,
      actionAttributes: input.actionAttributes as unknown as Record<
        string,
        unknown
      >,
      conditions: (input.conditions ?? []) as unknown as Record<
        string,
        unknown
      >[],
      priority: input.priority ?? 0,
      status: "active",
      createdBy: input.createdBy,
    });

    return id;
  }

  async updatePolicy(
    id: string,
    tenantId: string,
    updates: Partial<{
      name: string;
      description: string;
      effect: "allow" | "deny";
      subjectAttributes: AbacPolicy["subjectAttributes"];
      resourceAttributes: AbacPolicy["resourceAttributes"];
      actionAttributes: AbacPolicy["actionAttributes"];
      conditions: AbacPolicy["conditions"];
      priority: number;
      status: "active" | "inactive";
    }>,
  ): Promise<void> {
    const db = getDb();
    const setValues: Record<string, unknown> = { updatedAt: new Date() };

    if (updates.name !== undefined) setValues.name = updates.name;
    if (updates.description !== undefined)
      setValues.description = updates.description;
    if (updates.effect !== undefined) setValues.effect = updates.effect;
    if (updates.subjectAttributes !== undefined)
      setValues.subjectAttributes = updates.subjectAttributes;
    if (updates.resourceAttributes !== undefined)
      setValues.resourceAttributes = updates.resourceAttributes;
    if (updates.actionAttributes !== undefined)
      setValues.actionAttributes = updates.actionAttributes;
    if (updates.conditions !== undefined)
      setValues.conditions = updates.conditions;
    if (updates.priority !== undefined) setValues.priority = updates.priority;
    if (updates.status !== undefined) setValues.status = updates.status;

    await db
      .update(abacPolicies)
      .set(setValues)
      .where(and(eq(abacPolicies.id, id), eq(abacPolicies.tenantId, tenantId)));
  }

  async deletePolicy(id: string, tenantId: string): Promise<void> {
    const db = getDb();
    await db
      .update(abacPolicies)
      .set({ status: "inactive" as const, updatedAt: new Date() })
      .where(and(eq(abacPolicies.id, id), eq(abacPolicies.tenantId, tenantId)));
  }
}
