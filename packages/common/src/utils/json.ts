import { Err, Ok, type Result } from "../types/result.js";

export function safeJsonParse<T = unknown>(input: string): Result<T> {
  try {
    return Ok(JSON.parse(input) as T);
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}

export function safeJsonStringify(
  value: unknown,
  pretty = false,
): Result<string> {
  try {
    return Ok(JSON.stringify(value, null, pretty ? 2 : undefined));
  } catch (e) {
    return Err(e instanceof Error ? e : new Error(String(e)));
  }
}
