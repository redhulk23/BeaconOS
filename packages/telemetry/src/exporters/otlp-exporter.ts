import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";

export interface OtlpExporterConfig {
  endpoint?: string;
  headers?: Record<string, string>;
}

export function createOtlpExporter(config: OtlpExporterConfig = {}): BatchSpanProcessor {
  const exporter = new OTLPTraceExporter({
    url: config.endpoint ?? process.env.OTEL_EXPORTER_OTLP_ENDPOINT ?? "http://localhost:4318/v1/traces",
    headers: config.headers,
  });
  return new BatchSpanProcessor(exporter);
}
