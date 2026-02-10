import type { Context, MiddlewareHandler } from "hono";
import { verifyJwt, type JwtPayload } from "../jwt.js";
import { validateApiKey, type ValidatedApiKey } from "../api-key.js";
import { AuthenticationError } from "@beacon-os/common";

export interface AuthUser {
  id: string;
  tenantId: string;
  role: string;
  email?: string;
  authMethod: "jwt" | "api_key";
  permissions?: string[];
}

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
    tenantId: string;
  }
}

export function authMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const authHeader = c.req.header("Authorization");

    if (!authHeader) {
      throw new AuthenticationError("Missing Authorization header");
    }

    let user: AuthUser;

    if (authHeader.startsWith("Bearer ")) {
      const token = authHeader.slice(7);

      // Try JWT first
      try {
        const payload = await verifyJwt(token);
        user = {
          id: payload.sub,
          tenantId: payload.tenantId,
          role: payload.role,
          email: payload.email,
          authMethod: "jwt",
        };
      } catch {
        // Try API key
        const apiKey = await validateApiKey(token);
        if (!apiKey) {
          throw new AuthenticationError("Invalid token or API key");
        }
        user = {
          id: apiKey.userId,
          tenantId: apiKey.tenantId,
          role: "api_key",
          authMethod: "api_key",
          permissions: apiKey.permissions,
        };
      }
    } else {
      throw new AuthenticationError(
        "Invalid Authorization format. Use: Bearer <token>",
      );
    }

    c.set("user", user);
    c.set("tenantId", user.tenantId);

    await next();
  };
}
