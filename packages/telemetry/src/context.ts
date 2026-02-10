import { context as otelContext, trace, propagation, type Span as OtelSpan } from "@opentelemetry/api";

export interface TraceContext {
  traceId: string;
  spanId: string;
  traceFlags: number;
}

export function extractTraceContext(span: OtelSpan): TraceContext {
  const ctx = span.spanContext();
  return {
    traceId: ctx.traceId,
    spanId: ctx.spanId,
    traceFlags: ctx.traceFlags,
  };
}

export function injectTraceHeaders(headers: Record<string, string>): void {
  propagation.inject(otelContext.active(), headers);
}

export function extractTraceFromHeaders(headers: Record<string, string>): void {
  propagation.extract(otelContext.active(), headers);
}

export function runInSpanContext<T>(span: OtelSpan, fn: () => T): T {
  return otelContext.with(trace.setSpan(otelContext.active(), span), fn);
}
