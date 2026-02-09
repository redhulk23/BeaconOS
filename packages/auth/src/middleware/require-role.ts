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

export function requirePermission(...permissions: Permission[]): MiddlewareHandler {
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
        throw new AuthorizationError(`Missing permissions: ${missing.join(", ")}`);
      }
    } else {
      // Check role-based permissions
      const role = user.role as Role;
      const missing = permissions.filter((p) => !hasPermission(role, p));
      if (missing.length > 0) {
        throw new AuthorizationError(`Missing permissions: ${missing.join(", ")}`);
      }
    }

    await next();
  };
}
