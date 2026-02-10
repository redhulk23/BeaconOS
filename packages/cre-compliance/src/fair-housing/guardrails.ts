import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-compliance:fair-housing");

/**
 * Fair Housing Act guardrails for CRE AI agents.
 *
 * Protected classes under federal law:
 * - Race, Color, National Origin, Religion, Sex, Familial Status, Disability
 *
 * Additional state/local protections may include:
 * - Sexual orientation, Gender identity, Source of income, Age, Marital status
 */

export interface GuardrailResult {
  passed: boolean;
  violations: FairHousingViolation[];
  warnings: FairHousingWarning[];
  scannedAt: string;
}

export interface FairHousingViolation {
  type:
    | "discriminatory_language"
    | "steering"
    | "disparate_treatment"
    | "advertising";
  severity: "high" | "critical";
  description: string;
  matchedText: string;
  protectedClass: string;
}

export interface FairHousingWarning {
  type: "potentially_problematic" | "needs_review";
  description: string;
  matchedText: string;
}

// Patterns that indicate potential Fair Housing violations
const DISCRIMINATORY_PATTERNS: Array<{
  pattern: RegExp;
  protectedClass: string;
  type: FairHousingViolation["type"];
  description: string;
}> = [
  // Race / National Origin
  {
    pattern: /\b(no\s+(?:blacks?|whites?|asians?|hispanics?|latinos?))\b/i,
    protectedClass: "race/national_origin",
    type: "discriminatory_language",
    description: "Explicit racial exclusion",
  },
  {
    pattern: /\b(whites?\s+only|colored\s+(?:not|need\s+not))\b/i,
    protectedClass: "race",
    type: "discriminatory_language",
    description: "Racial segregation language",
  },
  // Religion
  {
    pattern: /\b(no\s+(?:muslims?|jews?|christians?|hindus?))\b/i,
    protectedClass: "religion",
    type: "discriminatory_language",
    description: "Religious exclusion",
  },
  {
    pattern: /\b(christian\s+(?:only|community|neighborhood))\b/i,
    protectedClass: "religion",
    type: "steering",
    description: "Religious preference/steering",
  },
  // Familial Status
  {
    pattern: /\b(no\s+(?:children|kids|families\s+with\s+children))\b/i,
    protectedClass: "familial_status",
    type: "discriminatory_language",
    description: "Familial status exclusion (unless senior housing exemption)",
  },
  {
    pattern: /\b(adults?\s+only|no\s+(?:babies|infants|toddlers))\b/i,
    protectedClass: "familial_status",
    type: "discriminatory_language",
    description: "Age-based familial exclusion",
  },
  // Disability
  {
    pattern: /\b(no\s+(?:disabled|handicapped|wheelchair))\b/i,
    protectedClass: "disability",
    type: "discriminatory_language",
    description: "Disability exclusion",
  },
  {
    pattern: /\b((?:must\s+be|require)\s+(?:able-bodied|physically\s+fit))\b/i,
    protectedClass: "disability",
    type: "discriminatory_language",
    description: "Physical ability requirement",
  },
  // Sex / Gender
  {
    pattern: /\b((?:females?|males?|women|men)\s+only)\b/i,
    protectedClass: "sex",
    type: "discriminatory_language",
    description: "Sex-based exclusion",
  },
  // Steering indicators
  {
    pattern:
      /\b((?:perfect|ideal|great)\s+for\s+(?:singles?|couples?|young\s+professionals?))\b/i,
    protectedClass: "familial_status",
    type: "steering",
    description: "Potential steering by familial status",
  },
];

// Warning patterns — not violations but worth flagging
const WARNING_PATTERNS: Array<{
  pattern: RegExp;
  description: string;
}> = [
  {
    pattern:
      /\b(exclusive|prestigious|upscale)\s+(?:community|neighborhood|area)\b/i,
    description: "Language that may imply socioeconomic screening",
  },
  {
    pattern: /\b(near\s+(?:church|mosque|synagogue|temple))\b/i,
    description:
      "Religious institution proximity — could be perceived as steering",
  },
  {
    pattern: /\b(quiet\s+(?:community|neighborhood|building))\b/i,
    description: "May imply preference against families with children",
  },
  {
    pattern: /\b(walking\s+distance|close\s+to\s+(?:schools?|parks?))\b/i,
    description:
      "Proximity descriptions are generally acceptable but monitor for steering patterns",
  },
];

/**
 * Scan text output for Fair Housing Act compliance.
 */
export function scanForFairHousing(text: string): GuardrailResult {
  const violations: FairHousingViolation[] = [];
  const warnings: FairHousingWarning[] = [];

  for (const rule of DISCRIMINATORY_PATTERNS) {
    const match = text.match(rule.pattern);
    if (match) {
      violations.push({
        type: rule.type,
        severity: rule.type === "discriminatory_language" ? "critical" : "high",
        description: rule.description,
        matchedText: match[0],
        protectedClass: rule.protectedClass,
      });
    }
  }

  for (const rule of WARNING_PATTERNS) {
    const match = text.match(rule.pattern);
    if (match) {
      warnings.push({
        type: "potentially_problematic",
        description: rule.description,
        matchedText: match[0],
      });
    }
  }

  const passed = violations.length === 0;

  if (!passed) {
    log.warn(
      { violationCount: violations.length },
      "Fair Housing violations detected",
    );
  }

  return {
    passed,
    violations,
    warnings,
    scannedAt: new Date().toISOString(),
  };
}

/**
 * Sanitize text by removing or replacing discriminatory language.
 * Returns the cleaned text and a list of changes made.
 */
export function sanitizeOutput(text: string): {
  sanitized: string;
  changes: string[];
} {
  let sanitized = text;
  const changes: string[] = [];

  for (const rule of DISCRIMINATORY_PATTERNS) {
    const match = sanitized.match(rule.pattern);
    if (match) {
      sanitized = sanitized.replace(
        rule.pattern,
        "[REMOVED - Fair Housing violation]",
      );
      changes.push(`Removed "${match[0]}": ${rule.description}`);
    }
  }

  if (changes.length > 0) {
    log.info(
      { changeCount: changes.length },
      "Output sanitized for Fair Housing compliance",
    );
  }

  return { sanitized, changes };
}
