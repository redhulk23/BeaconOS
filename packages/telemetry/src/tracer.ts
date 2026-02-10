import {
  trace,
  context as otelContext,
  SpanStatusCode,
  type Span as OtelSpan,
  type Tracer,
} from "@opentelemetry/api";
import { NodeTracerProvider } from "@opentelemetry/sdk-trace-node";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { Resource } from "@opentelemetry/resources";
import { ATTR_SERVICE_NAME } from "@opentelemetry/semantic-conventions";
import { createLogger } from "@beacon-os/common";

const log = createLogger("telemetry");

export interface TracerConfig {
  serviceName: string;
  otlpEndpoint?: string;
  persistToDb?: boolean;
  sampleRate?: number;
}

export interface SpanOptions {
  kind?: "internal" | "server" | "client" | "producer" | "consumer";
  tenantId?: string;
  agentId?: string;
  runId?: string;
  attributes?: Record<string, string | number | boolean>;
  parentSpan?: OtelSpan;
}

export class BeaconTracer {
  private provider: NodeTracerProvider;
  private tracer: Tracer;
  private config: TracerConfig;

  constructor(config: TracerConfig) {
    this.config = config;
    this.provider = new NodeTracerProvider({
      resource: new Resource({
        [ATTR_SERVICE_NAME]: config.serviceName,
      }),
    });
    this.tracer = trace.getTracer(config.serviceName, "0.1.0");
    log.info({ serviceName: config.serviceName }, "BeaconTracer initialized");
  }

  addSpanProcessor(processor: BatchSpanProcessor): void {
    this.provider.addSpanProcessor(processor);
  }

  startSpan(name: string, options?: SpanOptions): OtelSpan {
    const span = this.tracer.startSpan(name);
    if (options?.tenantId)
      span.setAttribute("beacon.tenant_id", options.tenantId);
    if (options?.agentId) span.setAttribute("beacon.agent_id", options.agentId);
    if (options?.runId) span.setAttribute("beacon.run_id", options.runId);
    if (options?.attributes) {
      for (const [k, v] of Object.entries(options.attributes)) {
        span.setAttribute(k, v);
      }
    }
    return span;
  }

  getActiveSpan(): OtelSpan | undefined {
    return trace.getActiveSpan();
  }

  async withSpan<T>(
    name: string,
    options: SpanOptions,
    fn: (span: OtelSpan) => Promise<T>,
  ): Promise<T> {
    const span = this.startSpan(name, options);
    try {
      const result = await otelContext.with(
        trace.setSpan(otelContext.active(), span),
        () => fn(span),
      );
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(error) });
      span.recordException(error as Error);
      throw error;
    } finally {
      span.end();
    }
  }

  async shutdown(): Promise<void> {
    await this.provider.shutdown();
    log.info("BeaconTracer shut down");
  }
}
