import { SpanStatusCode } from "@opentelemetry/api";
import type { MiddlewareHandler } from "hono";
import type { BeaconTracer } from "../tracer.js";

export function tracingMiddleware(tracer: BeaconTracer): MiddlewareHandler {
  return async (c, next) => {
    const method = c.req.method;
    const path = c.req.path;
    const tenantId = c.get("tenantId") as string | undefined;

    await tracer.withSpan(
      `http.${method} ${path}`,
      {
        kind: "server",
        tenantId,
        attributes: {
          "http.method": method,
          "http.url": c.req.url,
          "http.route": path,
        },
      },
      async (span) => {
        await next();
        const status = c.res.status;
        span.setAttribute("http.status_code", status);
        if (status >= 400) {
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: `HTTP ${status}`,
          });
        }
      },
    );
  };
}
