import type { BeaconTracer, SpanOptions } from "./tracer.js";

export function withTracing<TArgs extends unknown[], TReturn>(
  tracer: BeaconTracer,
  name: string,
  fn: (...args: TArgs) => Promise<TReturn>,
  options?: SpanOptions,
): (...args: TArgs) => Promise<TReturn> {
  return async (...args: TArgs): Promise<TReturn> => {
    return tracer.withSpan(name, options ?? {}, async () => {
      return fn(...args);
    });
  };
}
