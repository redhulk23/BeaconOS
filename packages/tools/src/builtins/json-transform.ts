import { z } from "zod";
import type { ToolRegistrationInput } from "../registry.js";

const JsonTransformInputSchema = z.object({
  data: z.unknown(),
  operation: z.enum(["pick", "omit", "flatten", "map_keys", "filter"]),
  keys: z.array(z.string()).optional(),
  predicate: z.string().optional(),
});

export function createJsonTransformTool(
  tenantId: string,
): ToolRegistrationInput {
  return {
    tenantId,
    name: "json-transform",
    version: "0.1.0",
    description: "Transform JSON data structures",
    inputSchema: JsonTransformInputSchema,
    permissions: [],
    timeoutMs: 5_000,
    execute: async (input) => {
      const parsed = JsonTransformInputSchema.parse(input);
      const data = parsed.data;

      switch (parsed.operation) {
        case "pick": {
          if (!parsed.keys || typeof data !== "object" || data === null)
            return data;
          const obj = data as Record<string, unknown>;
          const result: Record<string, unknown> = {};
          for (const key of parsed.keys) {
            if (key in obj) result[key] = obj[key];
          }
          return result;
        }

        case "omit": {
          if (!parsed.keys || typeof data !== "object" || data === null)
            return data;
          const obj = data as Record<string, unknown>;
          const result: Record<string, unknown> = { ...obj };
          for (const key of parsed.keys) {
            delete result[key];
          }
          return result;
        }

        case "flatten": {
          if (typeof data !== "object" || data === null) return data;
          return flattenObject(data as Record<string, unknown>);
        }

        case "map_keys": {
          if (!parsed.keys || typeof data !== "object" || data === null)
            return data;
          const obj = data as Record<string, unknown>;
          const entries = Object.entries(obj);
          const result: Record<string, unknown> = {};
          for (let i = 0; i < entries.length; i++) {
            const newKey = parsed.keys[i] ?? entries[i]![0];
            result[newKey] = entries[i]![1];
          }
          return result;
        }

        case "filter": {
          if (!Array.isArray(data)) return data;
          if (!parsed.keys || parsed.keys.length === 0) return data;
          // Filter objects in array that have truthy values for specified keys
          return data.filter((item) => {
            if (typeof item !== "object" || item === null) return true;
            return parsed.keys!.every(
              (key) => (item as Record<string, unknown>)[key] != null,
            );
          });
        }

        default:
          return data;
      }
    },
  };
}

function flattenObject(
  obj: Record<string, unknown>,
  prefix = "",
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      Object.assign(
        result,
        flattenObject(value as Record<string, unknown>, newKey),
      );
    } else {
      result[newKey] = value;
    }
  }
  return result;
}
