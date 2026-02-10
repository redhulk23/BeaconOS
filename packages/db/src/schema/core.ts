import {
  pgTable,
  text,
  timestamp,
  jsonb,
  integer,
  boolean,
  varchar,
  index,
  numeric,
} from "drizzle-orm/pg-core";

// --- Tenants ---
export const tenants = pgTable("tenants", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: varchar("slug", { length: 63 }).notNull().unique(),
  settings: jsonb("settings").default({}).$type<Record<string, unknown>>(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// --- Users ---
export const users = pgTable(
  "users",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    email: varchar("email", { length: 255 }).notNull(),
    name: text("name").notNull(),
    passwordHash: text("password_hash"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("users_tenant_id_idx").on(t.tenantId),
    index("users_email_idx").on(t.email),
  ],
);

// --- User Roles ---
export const userRoles = pgTable(
  "user_roles",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    role: varchar("role", { length: 50 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("user_roles_user_id_idx").on(t.userId)],
);

// --- API Keys ---
export const apiKeys = pgTable(
  "api_keys",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    userId: text("user_id")
      .notNull()
      .references(() => users.id),
    name: text("name").notNull(),
    keyHash: text("key_hash").notNull(),
    keyPrefix: varchar("key_prefix", { length: 12 }).notNull(),
    permissions: jsonb("permissions").default([]).$type<string[]>(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    revokedAt: timestamp("revoked_at", { withTimezone: true }),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("api_keys_tenant_id_idx").on(t.tenantId),
    index("api_keys_key_prefix_idx").on(t.keyPrefix),
  ],
);

// --- Agent Definitions ---
export const agentDefinitions = pgTable(
  "agent_definitions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    version: varchar("version", { length: 20 }).notNull().default("0.1.0"),
    description: text("description"),
    manifest: jsonb("manifest").notNull().$type<Record<string, unknown>>(),
    status: varchar("status", { length: 20 }).notNull().default("registered"),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("agent_definitions_tenant_id_idx").on(t.tenantId),
    index("agent_definitions_name_idx").on(t.tenantId, t.name),
  ],
);

// --- Agent Runs ---
export const agentRuns = pgTable(
  "agent_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    agentId: text("agent_id")
      .notNull()
      .references(() => agentDefinitions.id),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    input: jsonb("input").$type<Record<string, unknown>>(),
    output: jsonb("output").$type<Record<string, unknown>>(),
    error: text("error"),
    totalTokens: integer("total_tokens").default(0),
    totalSteps: integer("total_steps").default(0),
    durationMs: integer("duration_ms"),
    triggeredBy: text("triggered_by"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("agent_runs_tenant_id_idx").on(t.tenantId),
    index("agent_runs_agent_id_idx").on(t.agentId),
    index("agent_runs_status_idx").on(t.status),
  ],
);

// --- Agent Run Steps ---
export const agentRunSteps = pgTable(
  "agent_run_steps",
  {
    id: text("id").primaryKey(),
    runId: text("run_id")
      .notNull()
      .references(() => agentRuns.id),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    stepNumber: integer("step_number").notNull(),
    type: varchar("type", { length: 30 }).notNull(),
    input: jsonb("input").$type<Record<string, unknown>>(),
    output: jsonb("output").$type<Record<string, unknown>>(),
    error: text("error"),
    tokensUsed: integer("tokens_used").default(0),
    durationMs: integer("duration_ms"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("agent_run_steps_run_id_idx").on(t.runId),
    index("agent_run_steps_tenant_id_idx").on(t.tenantId),
  ],
);

// --- Workflow Definitions ---
export const workflowDefinitions = pgTable(
  "workflow_definitions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    version: varchar("version", { length: 20 }).notNull().default("0.1.0"),
    description: text("description"),
    definition: jsonb("definition").notNull().$type<Record<string, unknown>>(),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [index("workflow_definitions_tenant_id_idx").on(t.tenantId)],
);

// --- Workflow Runs ---
export const workflowRuns = pgTable(
  "workflow_runs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    workflowId: text("workflow_id")
      .notNull()
      .references(() => workflowDefinitions.id),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    state: jsonb("state").default({}).$type<Record<string, unknown>>(),
    currentStep: varchar("current_step", { length: 100 }),
    input: jsonb("input").$type<Record<string, unknown>>(),
    output: jsonb("output").$type<Record<string, unknown>>(),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    completedAt: timestamp("completed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("workflow_runs_tenant_id_idx").on(t.tenantId),
    index("workflow_runs_workflow_id_idx").on(t.workflowId),
  ],
);

// --- Tool Registrations ---
export const toolRegistrations = pgTable(
  "tool_registrations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    version: varchar("version", { length: 20 }).notNull().default("0.1.0"),
    description: text("description"),
    inputSchema: jsonb("input_schema").notNull().$type<Record<string, unknown>>(),
    outputSchema: jsonb("output_schema").$type<Record<string, unknown>>(),
    permissions: jsonb("permissions").default([]).$type<string[]>(),
    timeoutMs: integer("timeout_ms").default(30000),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("tool_registrations_tenant_id_idx").on(t.tenantId),
    index("tool_registrations_name_idx").on(t.tenantId, t.name),
  ],
);

// --- Audit Logs ---
export const auditLogs = pgTable(
  "audit_logs",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    action: varchar("action", { length: 100 }).notNull(),
    actorId: text("actor_id").notNull(),
    actorType: varchar("actor_type", { length: 20 }).notNull(),
    resourceType: varchar("resource_type", { length: 50 }).notNull(),
    resourceId: text("resource_id").notNull(),
    metadata: jsonb("metadata").default({}).$type<Record<string, unknown>>(),
    previousHash: text("previous_hash"),
    hash: text("hash").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("audit_logs_tenant_id_idx").on(t.tenantId),
    index("audit_logs_action_idx").on(t.action),
    index("audit_logs_resource_idx").on(t.resourceType, t.resourceId),
    index("audit_logs_created_at_idx").on(t.createdAt),
  ],
);

// --- Memory Entries ---
export const memoryEntries = pgTable(
  "memory_entries",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    agentId: text("agent_id")
      .notNull()
      .references(() => agentDefinitions.id),
    key: text("key").notNull(),
    value: jsonb("value").notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("memory_entries_agent_id_idx").on(t.agentId),
    index("memory_entries_key_idx").on(t.agentId, t.key),
  ],
);

// --- Approval Requests ---
export const approvalRequests = pgTable(
  "approval_requests",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    runId: text("run_id").references(() => agentRuns.id),
    workflowRunId: text("workflow_run_id").references(() => workflowRuns.id),
    type: varchar("type", { length: 50 }).notNull(),
    title: text("title").notNull(),
    description: text("description"),
    context: jsonb("context").default({}).$type<Record<string, unknown>>(),
    status: varchar("status", { length: 20 }).notNull().default("pending"),
    decidedBy: text("decided_by").references(() => users.id),
    decidedAt: timestamp("decided_at", { withTimezone: true }),
    decision: varchar("decision", { length: 20 }),
    decisionNote: text("decision_note"),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("approval_requests_tenant_id_idx").on(t.tenantId),
    index("approval_requests_status_idx").on(t.status),
    index("approval_requests_run_id_idx").on(t.runId),
  ],
);

// --- Tenant Settings ---
export const tenantSettings = pgTable(
  "tenant_settings",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    key: varchar("key", { length: 100 }).notNull(),
    value: jsonb("value").notNull().$type<Record<string, unknown>>(),
    category: varchar("category", { length: 50 }),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("tenant_settings_tenant_id_idx").on(t.tenantId),
    index("tenant_settings_tenant_key_idx").on(t.tenantId, t.key),
  ],
);

// --- ABAC Policies ---
export const abacPolicies = pgTable(
  "abac_policies",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    name: text("name").notNull(),
    description: text("description"),
    effect: varchar("effect", { length: 10 }).notNull().$type<"allow" | "deny">(),
    subjectAttributes: jsonb("subject_attributes").default({}).$type<Record<string, unknown>>(),
    resourceAttributes: jsonb("resource_attributes").default({}).$type<Record<string, unknown>>(),
    actionAttributes: jsonb("action_attributes").default({}).$type<Record<string, unknown>>(),
    conditions: jsonb("conditions").default([]).$type<Record<string, unknown>[]>(),
    priority: integer("priority").notNull().default(0),
    status: varchar("status", { length: 20 }).notNull().default("active").$type<"active" | "inactive">(),
    createdBy: text("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("abac_policies_tenant_id_idx").on(t.tenantId),
    index("abac_policies_status_idx").on(t.status),
  ],
);

// --- Telemetry Spans ---
export const telemetrySpans = pgTable(
  "telemetry_spans",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id),
    traceId: varchar("trace_id", { length: 32 }).notNull(),
    spanId: varchar("span_id", { length: 16 }).notNull(),
    parentSpanId: varchar("parent_span_id", { length: 16 }),
    operationName: varchar("operation_name", { length: 200 }).notNull(),
    serviceName: varchar("service_name", { length: 100 }).notNull(),
    kind: varchar("kind", { length: 20 }).notNull().default("internal"),
    status: varchar("status", { length: 20 }).notNull().default("ok"),
    startTime: timestamp("start_time", { withTimezone: true }).notNull(),
    endTime: timestamp("end_time", { withTimezone: true }),
    durationMs: numeric("duration_ms", { precision: 12, scale: 2 }),
    attributes: jsonb("attributes").default({}).$type<Record<string, unknown>>(),
    events: jsonb("events").default([]).$type<Record<string, unknown>[]>(),
    agentId: text("agent_id"),
    runId: text("run_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    index("telemetry_spans_tenant_id_idx").on(t.tenantId),
    index("telemetry_spans_trace_id_idx").on(t.traceId),
    index("telemetry_spans_agent_id_idx").on(t.agentId),
    index("telemetry_spans_run_id_idx").on(t.runId),
    index("telemetry_spans_start_time_idx").on(t.startTime),
    index("telemetry_spans_operation_name_idx").on(t.operationName),
  ],
);
