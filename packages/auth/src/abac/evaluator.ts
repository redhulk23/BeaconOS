import type {
  AbacPolicy,
  AbacContext,
  AbacDecision,
  AttributeMatcher,
  PolicyCondition,
} from "./types.js";

export class AbacEvaluator {
  evaluate(policies: AbacPolicy[], context: AbacContext): AbacDecision {
    const activePolicies = policies
      .filter((p) => p.status === "active")
      .sort((a, b) => b.priority - a.priority);

    if (activePolicies.length === 0) {
      return {
        result: "not_applicable",
        matchedPolicies: [],
        reason: "No active policies found",
      };
    }

    const matchedPolicies: string[] = [];
    let hasDeny = false;
    let hasAllow = false;

    for (const policy of activePolicies) {
      if (this.matchesPolicy(policy, context)) {
        matchedPolicies.push(policy.id);
        if (policy.effect === "deny") {
          hasDeny = true;
          // Deny-overrides: short circuit
          return {
            result: "deny",
            matchedPolicies,
            reason: `Denied by policy: ${policy.name}`,
          };
        } else {
          hasAllow = true;
        }
      }
    }

    if (hasAllow) {
      return {
        result: "allow",
        matchedPolicies,
        reason: "Allowed by matching policies",
      };
    }

    return {
      result: "not_applicable",
      matchedPolicies: [],
      reason: "No matching policies",
    };
  }

  private matchesPolicy(policy: AbacPolicy, context: AbacContext): boolean {
    const subjectMatch = this.matchesAttributes(
      policy.subjectAttributes,
      context.subject,
    );
    const resourceMatch = this.matchesAttributes(
      policy.resourceAttributes,
      context.resource,
    );
    const actionMatch = this.matchesAttributes(
      policy.actionAttributes,
      context.action,
    );
    const conditionsMatch = this.evaluateConditions(policy.conditions, context);

    return subjectMatch && resourceMatch && actionMatch && conditionsMatch;
  }

  private matchesAttributes(
    matchers: AttributeMatcher[],
    attributes: Record<string, unknown>,
  ): boolean {
    if (matchers.length === 0) return true;

    return matchers.every((matcher) => {
      const value = attributes[matcher.field];
      switch (matcher.operator) {
        case "eq":
          return value === matcher.value;
        case "in":
          return Array.isArray(matcher.value) && matcher.value.includes(value);
        case "not_in":
          return Array.isArray(matcher.value) && !matcher.value.includes(value);
        case "gt":
          return (
            typeof value === "number" &&
            typeof matcher.value === "number" &&
            value > matcher.value
          );
        case "lt":
          return (
            typeof value === "number" &&
            typeof matcher.value === "number" &&
            value < matcher.value
          );
        case "contains":
          return (
            typeof value === "string" &&
            typeof matcher.value === "string" &&
            value.includes(matcher.value)
          );
        default:
          return false;
      }
    });
  }

  private evaluateConditions(
    conditions: PolicyCondition[],
    context: AbacContext,
  ): boolean {
    if (conditions.length === 0) return true;

    return conditions.every((condition) => {
      switch (condition.type) {
        case "time_range": {
          const now = new Date();
          const start = condition.parameters.startHour as number | undefined;
          const end = condition.parameters.endHour as number | undefined;
          if (start !== undefined && end !== undefined) {
            const hour = now.getUTCHours();
            return hour >= start && hour <= end;
          }
          return true;
        }
        case "ip_range": {
          const clientIp = context.environment.clientIp as string | undefined;
          const allowedRanges = condition.parameters.ranges as
            | string[]
            | undefined;
          if (clientIp && allowedRanges) {
            return allowedRanges.some((range) =>
              clientIp.startsWith(range.replace("*", "")),
            );
          }
          return true;
        }
        case "environment": {
          const envKey = condition.parameters.key as string;
          const envValue = condition.parameters.value as unknown;
          return context.environment[envKey] === envValue;
        }
        case "custom":
          // Custom conditions are evaluated externally
          return true;
        default:
          return true;
      }
    });
  }
}
