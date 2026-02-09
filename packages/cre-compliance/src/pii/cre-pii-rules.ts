import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-compliance:cre-pii");

export interface PiiDetection {
  type: string;
  value: string;
  startIndex: number;
  endIndex: number;
  context: string;
}

export interface PiiScanResult {
  hasPii: boolean;
  detections: PiiDetection[];
  piiTypes: string[];
  scannedAt: string;
}

// CRE-specific PII patterns beyond standard PII
const CRE_PII_PATTERNS: Array<{
  name: string;
  pattern: RegExp;
  description: string;
}> = [
  // Standard PII
  { name: "ssn", pattern: /\b\d{3}-\d{2}-\d{4}\b/g, description: "Social Security Number" },
  { name: "email", pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, description: "Email address" },
  { name: "phone", pattern: /\b(?:\+1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g, description: "Phone number" },
  { name: "credit_card", pattern: /\b(?:4\d{3}|5[1-5]\d{2}|3[47]\d{2}|6(?:011|5\d{2}))[- ]?\d{4}[- ]?\d{4}[- ]?\d{3,4}\b/g, description: "Credit card number" },

  // CRE-specific financial PII
  { name: "bank_account", pattern: /\b\d{8,17}\b(?=\s*(?:account|acct|routing))/gi, description: "Bank account number" },
  { name: "routing_number", pattern: /\b(?:routing|aba|transit)[\s#:]*\d{9}\b/gi, description: "Bank routing number" },
  { name: "ein", pattern: /\b\d{2}-\d{7}\b/g, description: "Employer Identification Number (EIN)" },
  { name: "tax_id", pattern: /\b(?:tax\s*id|tin)[\s#:]*\d{2}-?\d{7}\b/gi, description: "Tax Identification Number" },

  // CRE-specific tenant PII
  { name: "drivers_license", pattern: /\b(?:DL|driver'?s?\s*lic(?:ense)?)[\s#:]*[A-Z0-9]{5,15}\b/gi, description: "Driver's license number" },
  { name: "passport", pattern: /\b(?:passport)[\s#:]*[A-Z0-9]{6,12}\b/gi, description: "Passport number" },
  { name: "dob", pattern: /\b(?:DOB|date\s*of\s*birth|born)[\s:]*\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b/gi, description: "Date of birth" },

  // Financial identifiers
  { name: "wire_instructions", pattern: /\b(?:wire|swift|iban)[\s:]*[A-Z]{4}[A-Z0-9]{2,}\b/gi, description: "Wire transfer / SWIFT / IBAN code" },
  { name: "net_worth", pattern: /\b(?:net\s*worth|annual\s*income|salary)[\s:$]*[\d,.]+/gi, description: "Personal financial information" },
];

/**
 * Scan text for CRE-specific PII patterns.
 */
export function detectCrePii(text: string): PiiScanResult {
  const detections: PiiDetection[] = [];
  const piiTypes = new Set<string>();

  for (const rule of CRE_PII_PATTERNS) {
    // Reset regex state for global patterns
    rule.pattern.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = rule.pattern.exec(text)) !== null) {
      const start = match.index;
      const end = start + match[0].length;

      // Get surrounding context (30 chars each side)
      const contextStart = Math.max(0, start - 30);
      const contextEnd = Math.min(text.length, end + 30);
      const context = text.substring(contextStart, contextEnd);

      detections.push({
        type: rule.name,
        value: match[0],
        startIndex: start,
        endIndex: end,
        context,
      });
      piiTypes.add(rule.name);
    }
  }

  const hasPii = detections.length > 0;

  if (hasPii) {
    log.warn({ piiCount: detections.length, types: [...piiTypes] }, "CRE PII detected");
  }

  return {
    hasPii,
    detections,
    piiTypes: [...piiTypes],
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Redact CRE-specific PII from text, replacing with type markers.
 */
export function redactCrePii(text: string): { redacted: string; redactionCount: number } {
  let redacted = text;
  let count = 0;

  for (const rule of CRE_PII_PATTERNS) {
    rule.pattern.lastIndex = 0;
    const before = redacted;
    redacted = redacted.replace(rule.pattern, `[REDACTED:${rule.name.toUpperCase()}]`);
    if (redacted !== before) {
      const matches = before.match(rule.pattern);
      count += matches?.length ?? 0;
    }
  }

  if (count > 0) {
    log.info({ redactionCount: count }, "CRE PII redacted");
  }

  return { redacted, redactionCount: count };
}
