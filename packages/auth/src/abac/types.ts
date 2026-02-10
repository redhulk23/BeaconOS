export type ComparisonOperator = "eq" | "in" | "not_in" | "gt" | "lt" | "contains";

export interface AttributeMatcher {
  field: string;
  operator: ComparisonOperator;
  value: unknown;
}

export type PolicyConditionType = "time_range" | "ip_range" | "environment" | "custom";

export interface PolicyCondition {
  type: PolicyConditionType;
  parameters: Record<string, unknown>;
}

export interface AbacPolicy {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  effect: "allow" | "deny";
  subjectAttributes: AttributeMatcher[];
  resourceAttributes: AttributeMatcher[];
  actionAttributes: AttributeMatcher[];
  conditions: PolicyCondition[];
  priority: number;
  status: "active" | "inactive";
}

export interface AbacContext {
  subject: Record<string, unknown>;
  resource: Record<string, unknown>;
  action: Record<string, unknown>;
  environment: Record<string, unknown>;
}

export type AbacDecisionResult = "allow" | "deny" | "not_applicable";

export interface AbacDecision {
  result: AbacDecisionResult;
  matchedPolicies: string[];
  reason: string;
}
