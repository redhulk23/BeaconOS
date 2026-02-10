import type { Span as OtelSpan } from "@opentelemetry/api";
import { BeaconTracer, type SpanOptions } from "./tracer.js";

export function createAgentSpan(tracer: BeaconTracer, agentName: string, options?: SpanOptions): OtelSpan {
  return tracer.startSpan(`agent.${agentName}`, {
    kind: "internal",
    ...options,
    attributes: { "beacon.span_type": "agent", "beacon.agent_name": agentName, ...options?.attributes },
  });
}

export function createToolSpan(tracer: BeaconTracer, toolName: string, options?: SpanOptions): OtelSpan {
  return tracer.startSpan(`tool.${toolName}`, {
    kind: "client",
    ...options,
    attributes: { "beacon.span_type": "tool", "beacon.tool_name": toolName, ...options?.attributes },
  });
}

export function createModelSpan(tracer: BeaconTracer, provider: string, model: string, options?: SpanOptions): OtelSpan {
  return tracer.startSpan(`model.${provider}.${model}`, {
    kind: "client",
    ...options,
    attributes: { "beacon.span_type": "model", "beacon.model_provider": provider, "beacon.model_name": model, ...options?.attributes },
  });
}

export function createWorkflowSpan(tracer: BeaconTracer, workflowName: string, options?: SpanOptions): OtelSpan {
  return tracer.startSpan(`workflow.${workflowName}`, {
    kind: "internal",
    ...options,
    attributes: { "beacon.span_type": "workflow", "beacon.workflow_name": workflowName, ...options?.attributes },
  });
}
