import type { MiddlewareHandler } from "hono";
import { AuthorizationError } from "@beacon-os/common";
import { hasPermission, type Role, type Permission } from "../roles.js";

export function requireRole(...roles: Role[]): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get("user");

    if (!user) {
      throw new AuthorizationError("No authenticated user");
    }

    if (user.authMethod === "api_key") {
      // API key users bypass role checks — permissions checked separately
      await next();
      return;
    }

    if (!roles.includes(user.role as Role)) {
      throw new AuthorizationError(
        `Role ${user.role} is not authorized. Required: ${roles.join(", ")}`,
      );
    }

    await next();
  };
}

export function requirePermission(
  ...permissions: Permission[]
): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get("user");

    if (!user) {
      throw new AuthorizationError("No authenticated user");
    }

    if (user.authMethod === "api_key") {
      // Check API key permissions
      const keyPerms = user.permissions ?? [];
      const missing = permissions.filter((p) => !keyPerms.includes(p));
      if (missing.length > 0) {
        throw new AuthorizationError(
          `Missing permissions: ${missing.join(", ")}`,
        );
      }
    } else {
      // Check role-based permissions
      const role = user.role as Role;
      const missing = permissions.filter((p) => !hasPermission(role, p));
      if (missing.length > 0) {
        throw new AuthorizationError(
          `Missing permissions: ${missing.join(", ")}`,
        );
      }
    }

    await next();
  };
}

export function requireAbac(
  resourceType: string,
  action: string,
): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get("user");

    if (!user) {
      throw new AuthorizationError("No authenticated user");
    }

    // Import dynamically to avoid circular deps at module level
    const { AbacEvaluator } = await import("../abac/evaluator.js");
    const { PolicyStore } = await import("../abac/policy-store.js");

    const store = new PolicyStore();
    const evaluator = new AbacEvaluator();
    const tenantId = c.get("tenantId") as string;
    const policies = await store.getPoliciesForTenant(tenantId);

    if (policies.length === 0) {
      // Fall back to RBAC if no ABAC policies exist
      await next();
      return;
    }

    const context = {
      subject: {
        userId: user.id,
        role: user.role,
        tenantId,
      },
      resource: {
        type: resourceType,
      },
      action: {
        type: action,
      },
      environment: {
        clientIp: c.req.header("x-forwarded-for") ?? "unknown",
        timestamp: new Date().toISOString(),
      },
    };

    const decision = evaluator.evaluate(policies, context);

    if (decision.result === "deny") {
      throw new AuthorizationError(
        `Access denied by ABAC policy: ${decision.reason}`,
      );
    }

    await next();
  };
}
