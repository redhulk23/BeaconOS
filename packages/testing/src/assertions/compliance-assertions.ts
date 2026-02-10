const PII_PATTERNS = [
  /\b\d{3}-\d{2}-\d{4}\b/, // SSN
  /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/, // Credit card
  /\b[A-Z]{2}\d{6,8}\b/i, // Driver's license
];

const FAIR_HOUSING_TERMS = [
  "race",
  "color",
  "religion",
  "sex",
  "national origin",
  "disability",
  "familial status",
  "handicap",
];

export function toHavePiiRedacted(content: string): boolean {
  return !PII_PATTERNS.some((pattern) => pattern.test(content));
}

export function toPassFairHousing(content: string): boolean {
  const lower = content.toLowerCase();
  // Check that protected classes are not used in discriminatory context
  for (const term of FAIR_HOUSING_TERMS) {
    if (
      lower.includes(`exclude ${term}`) ||
      lower.includes(`deny based on ${term}`) ||
      lower.includes(`not ${term}`)
    ) {
      return false;
    }
  }
  return true;
}

export function toHaveAuditLog(
  logs: Array<{ action: string; resourceType: string }>,
): boolean {
  return logs.length > 0;
}

export function toHaveDisclaimer(content: string): boolean {
  const lower = content.toLowerCase();
  return (
    lower.includes("disclaimer") ||
    lower.includes("not legal advice") ||
    lower.includes("consult") ||
    lower.includes("for informational purposes")
  );
}
