import type { ReadableSpan, SpanExporter } from "@opentelemetry/sdk-trace-base";
import { BatchSpanProcessor } from "@opentelemetry/sdk-trace-base";
import { ExportResultCode, type ExportResult } from "@opentelemetry/core";
import { getDb, telemetrySpans } from "@beacon-os/db";
import { generateId, createLogger } from "@beacon-os/common";

const log = createLogger("telemetry:db-exporter");

export class DbSpanExporter implements SpanExporter {
  export(spans: ReadableSpan[], resultCallback: (result: ExportResult) => void): void {
    this.persistSpans(spans)
      .then(() => resultCallback({ code: ExportResultCode.SUCCESS }))
      .catch((err) => {
        log.error({ err }, "Failed to persist spans to database");
        resultCallback({ code: ExportResultCode.FAILED, error: err });
      });
  }

  async shutdown(): Promise<void> {
    // No cleanup needed
  }

  private async persistSpans(spans: ReadableSpan[]): Promise<void> {
    const db = getDb();
    const rows = spans.map((span) => {
      const ctx = span.spanContext();
      const attrs = span.attributes as Record<string, unknown>;
      const startMs = Number(span.startTime[0]) * 1000 + span.startTime[1] / 1_000_000;
      const endMs = Number(span.endTime[0]) * 1000 + span.endTime[1] / 1_000_000;
      return {
        id: generateId(),
        tenantId: (attrs["beacon.tenant_id"] as string) ?? "unknown",
        traceId: ctx.traceId,
        spanId: ctx.spanId,
        parentSpanId: span.parentSpanId || null,
        operationName: span.name,
        serviceName: (span.resource.attributes["service.name"] as string) ?? "unknown",
        kind: String(span.kind),
        status: span.status.code === 0 ? "ok" : "error",
        startTime: new Date(startMs),
        endTime: new Date(endMs),
        durationMs: String(endMs - startMs),
        attributes: attrs as Record<string, unknown>,
        events: span.events.map((e) => ({ name: e.name, time: e.time, attributes: e.attributes })) as Record<string, unknown>[],
        agentId: (attrs["beacon.agent_id"] as string) ?? null,
        runId: (attrs["beacon.run_id"] as string) ?? null,
      };
    });

    if (rows.length > 0) {
      await db.insert(telemetrySpans).values(rows);
      log.debug({ count: rows.length }, "Persisted spans to database");
    }
  }
}

export function createDbSpanProcessor(): BatchSpanProcessor {
  return new BatchSpanProcessor(new DbSpanExporter());
}
