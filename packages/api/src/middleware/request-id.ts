import type { MiddlewareHandler } from "hono";
import { generateId } from "@beacon-os/common";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
  }
}

export function requestIdMiddleware(): MiddlewareHandler {
  return async (c, next) => {
    const requestId = c.req.header("X-Request-Id") ?? generateId();
    c.set("requestId", requestId);
    c.header("X-Request-Id", requestId);
    await next();
  };
}
