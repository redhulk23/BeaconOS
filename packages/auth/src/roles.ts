export const Role = {
  ADMIN: "admin",
  AGENT_DEVELOPER: "agent_developer",
  OPERATOR: "operator",
  VIEWER: "viewer",
} as const;

export type Role = (typeof Role)[keyof typeof Role];

export const Permission = {
  AGENTS_CREATE: "agents:create",
  AGENTS_READ: "agents:read",
  AGENTS_UPDATE: "agents:update",
  AGENTS_DELETE: "agents:delete",
  AGENTS_RUN: "agents:run",
  TOOLS_REGISTER: "tools:register",
  TOOLS_READ: "tools:read",
  TOOLS_EXECUTE: "tools:execute",
  WORKFLOWS_CREATE: "workflows:create",
  WORKFLOWS_READ: "workflows:read",
  WORKFLOWS_RUN: "workflows:run",
  APPROVALS_DECIDE: "approvals:decide",
  APPROVALS_READ: "approvals:read",
  AUDIT_READ: "audit:read",
  USERS_MANAGE: "users:manage",
  API_KEYS_MANAGE: "api_keys:manage",
} as const;

export type Permission = (typeof Permission)[keyof typeof Permission];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  [Role.ADMIN]: Object.values(Permission),
  [Role.AGENT_DEVELOPER]: [
    Permission.AGENTS_CREATE,
    Permission.AGENTS_READ,
    Permission.AGENTS_UPDATE,
    Permission.AGENTS_RUN,
    Permission.TOOLS_REGISTER,
    Permission.TOOLS_READ,
    Permission.TOOLS_EXECUTE,
    Permission.WORKFLOWS_CREATE,
    Permission.WORKFLOWS_READ,
    Permission.WORKFLOWS_RUN,
    Permission.APPROVALS_READ,
  ],
  [Role.OPERATOR]: [
    Permission.AGENTS_READ,
    Permission.AGENTS_RUN,
    Permission.TOOLS_READ,
    Permission.TOOLS_EXECUTE,
    Permission.WORKFLOWS_READ,
    Permission.WORKFLOWS_RUN,
    Permission.APPROVALS_DECIDE,
    Permission.APPROVALS_READ,
    Permission.AUDIT_READ,
  ],
  [Role.VIEWER]: [
    Permission.AGENTS_READ,
    Permission.TOOLS_READ,
    Permission.WORKFLOWS_READ,
    Permission.APPROVALS_READ,
  ],
};

export function getPermissionsForRole(role: Role): Permission[] {
  return ROLE_PERMISSIONS[role] ?? [];
}

export function hasPermission(role: Role, permission: Permission): boolean {
  return getPermissionsForRole(role).includes(permission);
}
