export interface PiiMatch {
  type: string;
  value: string;
  start: number;
  end: number;
}

const PII_PATTERNS: { type: string; pattern: RegExp }[] = [
  { type: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  { type: "ssn", pattern: /\b\d{9}\b/g },
  {
    type: "email",
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
  },
  {
    type: "phone",
    pattern: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
  {
    type: "bank_account",
    pattern: /\b\d{8,17}\b/g,
  },
  {
    type: "credit_card",
    pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
  },
  {
    type: "routing_number",
    pattern: /\b0[0-9]{8}\b/g,
  },
];

export function detectPii(text: string): PiiMatch[] {
  const matches: PiiMatch[] = [];

  for (const { type, pattern } of PII_PATTERNS) {
    const regex = new RegExp(pattern.source, pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = regex.exec(text)) !== null) {
      matches.push({
        type,
        value: match[0],
        start: match.index,
        end: match.index + match[0].length,
      });
    }
  }

  return matches;
}

export function redactPii(text: string): string {
  const matches = detectPii(text);
  if (matches.length === 0) return text;

  // Sort by start position descending so we replace from end to start
  const sorted = [...matches].sort((a, b) => b.start - a.start);

  let result = text;
  for (const match of sorted) {
    const replacement = `[REDACTED:${match.type}]`;
    result =
      result.slice(0, match.start) + replacement + result.slice(match.end);
  }

  return result;
}

export function redactObjectPii(
  obj: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "string") {
      result[key] = redactPii(value);
    } else if (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value)
    ) {
      result[key] = redactObjectPii(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }
  return result;
}
