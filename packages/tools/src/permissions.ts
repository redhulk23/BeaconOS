import type { RegisteredTool } from "./registry.js";

export function checkToolPermission(
  tool: RegisteredTool,
  agentPermissions: string[],
): boolean {
  // No permissions required = open access
  if (tool.permissions.length === 0) return true;

  // Check all required permissions are granted
  return tool.permissions.every((perm) => agentPermissions.includes(perm));
}
