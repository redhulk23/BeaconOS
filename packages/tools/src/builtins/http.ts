import { z } from "zod";
import type { ToolRegistrationInput } from "../registry.js";

const HttpInputSchema = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  timeoutMs: z.number().positive().default(10_000),
});

export function createHttpTool(tenantId: string): ToolRegistrationInput {
  return {
    tenantId,
    name: "http",
    version: "0.1.0",
    description: "Make HTTP requests to external APIs",
    inputSchema: HttpInputSchema,
    permissions: ["tools:http"],
    timeoutMs: 30_000,
    execute: async (input) => {
      const parsed = HttpInputSchema.parse(input);
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), parsed.timeoutMs);

      try {
        const response = await fetch(parsed.url, {
          method: parsed.method,
          headers: parsed.headers,
          body: parsed.body ? JSON.stringify(parsed.body) : undefined,
          signal: controller.signal,
        });

        const contentType = response.headers.get("content-type") ?? "";
        let body: unknown;
        if (contentType.includes("application/json")) {
          body = await response.json();
        } else {
          body = await response.text();
        }

        return {
          status: response.status,
          statusText: response.statusText,
          headers: Object.fromEntries(response.headers.entries()),
          body,
        };
      } finally {
        clearTimeout(timeout);
      }
    },
  };
}
