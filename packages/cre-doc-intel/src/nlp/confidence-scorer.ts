export interface FieldScore {
  field: string;
  confidence: number;
  source: "extracted" | "inferred" | "default";
}

export interface ConfidenceReport {
  overallConfidence: number;
  fieldScores: FieldScore[];
  highConfidenceCount: number;
  lowConfidenceCount: number;
  missingFieldCount: number;
  reviewRequired: boolean;
}

const LOW_CONFIDENCE_THRESHOLD = 0.7;
const REVIEW_THRESHOLD = 0.8;

export function scoreExtraction(
  extractedFields: Record<string, { value: unknown; confidence: number }>,
  requiredFields: string[],
): ConfidenceReport {
  const fieldScores: FieldScore[] = [];
  let totalConfidence = 0;
  let highConfidence = 0;
  let lowConfidence = 0;
  let missing = 0;

  for (const field of requiredFields) {
    const extracted = extractedFields[field];
    if (!extracted || extracted.value === null || extracted.value === undefined) {
      fieldScores.push({ field, confidence: 0, source: "default" });
      missing++;
      continue;
    }

    const score: FieldScore = {
      field,
      confidence: extracted.confidence,
      source: "extracted",
    };
    fieldScores.push(score);
    totalConfidence += extracted.confidence;

    if (extracted.confidence >= REVIEW_THRESHOLD) {
      highConfidence++;
    } else if (extracted.confidence < LOW_CONFIDENCE_THRESHOLD) {
      lowConfidence++;
    }
  }

  const scoredCount = requiredFields.length - missing;
  const overallConfidence =
    scoredCount > 0 ? totalConfidence / scoredCount : 0;

  return {
    overallConfidence,
    fieldScores,
    highConfidenceCount: highConfidence,
    lowConfidenceCount: lowConfidence,
    missingFieldCount: missing,
    reviewRequired: overallConfidence < REVIEW_THRESHOLD || lowConfidence > 0,
  };
}

export function getFieldsForReview(report: ConfidenceReport): string[] {
  return report.fieldScores
    .filter((f) => f.confidence < LOW_CONFIDENCE_THRESHOLD)
    .map((f) => f.field);
}
