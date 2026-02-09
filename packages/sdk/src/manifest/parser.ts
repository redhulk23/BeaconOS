import { parse as parseYaml } from "yaml";
import { AgentManifestFileSchema, type AgentManifestFile } from "./schema.js";
import { ValidationError } from "@beacon-os/common";

export function parseManifest(yamlContent: string): AgentManifestFile {
  let raw: unknown;
  try {
    raw = parseYaml(yamlContent);
  } catch (err) {
    throw new ValidationError("Invalid YAML syntax", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const result = AgentManifestFileSchema.safeParse(raw);
  if (!result.success) {
    throw new ValidationError("Invalid agent manifest", {
      issues: result.error.issues,
    });
  }

  return result.data;
}

export function parseManifestFromObject(obj: unknown): AgentManifestFile {
  const result = AgentManifestFileSchema.safeParse(obj);
  if (!result.success) {
    throw new ValidationError("Invalid agent manifest", {
      issues: result.error.issues,
    });
  }
  return result.data;
}
