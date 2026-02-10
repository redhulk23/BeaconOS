import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-compliance:aml-kyc");

export interface ScreeningRequest {
  entityName: string;
  entityType: "individual" | "organization";
  country?: string;
  dateOfBirth?: string;
  aliases?: string[];
  identifiers?: { type: string; value: string }[];
}

export interface ScreeningResult {
  entityName: string;
  status: "clear" | "potential_match" | "match";
  score: number;
  matches: ScreeningMatch[];
  screenedAt: string;
  lists: string[];
}

export interface ScreeningMatch {
  listName: string;
  matchedName: string;
  matchScore: number;
  matchType: "exact" | "fuzzy" | "alias";
  entityDetails: {
    type: string;
    programs?: string[];
    remarks?: string;
    country?: string;
  };
}

// --- OFAC SDN Mock Data ---

const MOCK_SDN_ENTRIES = [
  {
    name: "JOHN DOE SANCTIONED",
    type: "individual",
    programs: ["SDGT"],
    country: "IR",
    aliases: ["J. DOE"],
    remarks: "Test sanctioned individual",
  },
  {
    name: "EVIL CORP LTD",
    type: "organization",
    programs: ["CYBER2"],
    country: "RU",
    aliases: ["EVIL CORPORATION"],
    remarks: "Test sanctioned entity",
  },
  {
    name: "SHADOW HOLDINGS LLC",
    type: "organization",
    programs: ["SDGT", "IRGC"],
    country: "SY",
    aliases: [],
    remarks: "Test sanctioned organization",
  },
];

/**
 * Screen an entity against OFAC SDN list (mock implementation).
 * In production, this would call the OFAC API or a screening service like Dow Jones, Refinitiv, etc.
 */
export async function screenEntity(
  request: ScreeningRequest,
): Promise<ScreeningResult> {
  log.info(
    { entity: request.entityName, type: request.entityType },
    "Screening entity against OFAC SDN",
  );

  const matches: ScreeningMatch[] = [];
  const normalizedName = request.entityName.toUpperCase().trim();
  const allNames = [
    normalizedName,
    ...(request.aliases ?? []).map((a) => a.toUpperCase().trim()),
  ];

  for (const entry of MOCK_SDN_ENTRIES) {
    const entryName = entry.name.toUpperCase();
    const entryAliases = entry.aliases.map((a) => a.toUpperCase());
    const allEntryNames = [entryName, ...entryAliases];

    for (const searchName of allNames) {
      for (const checkName of allEntryNames) {
        const score = calculateSimilarity(searchName, checkName);
        if (score >= 0.7) {
          matches.push({
            listName: "OFAC SDN",
            matchedName: entry.name,
            matchScore: score,
            matchType:
              score === 1.0 ? "exact" : score >= 0.9 ? "alias" : "fuzzy",
            entityDetails: {
              type: entry.type,
              programs: entry.programs,
              remarks: entry.remarks,
              country: entry.country,
            },
          });
          break;
        }
      }
    }
  }

  const maxScore =
    matches.length > 0 ? Math.max(...matches.map((m) => m.matchScore)) : 0;
  const status: ScreeningResult["status"] =
    maxScore >= 0.95 ? "match" : maxScore >= 0.7 ? "potential_match" : "clear";

  const result: ScreeningResult = {
    entityName: request.entityName,
    status,
    score: maxScore,
    matches,
    screenedAt: new Date().toISOString(),
    lists: ["OFAC SDN"],
  };

  log.info(
    { entity: request.entityName, status, matchCount: matches.length },
    "Screening complete",
  );
  return result;
}

/**
 * Batch screen multiple entities.
 */
export async function batchScreen(
  requests: ScreeningRequest[],
): Promise<ScreeningResult[]> {
  return Promise.all(requests.map(screenEntity));
}

/**
 * Simple string similarity (Dice coefficient on bigrams).
 */
function calculateSimilarity(a: string, b: string): number {
  if (a === b) return 1.0;
  if (a.length < 2 || b.length < 2) return 0;

  const bigramsA = new Set<string>();
  for (let i = 0; i < a.length - 1; i++) bigramsA.add(a.substring(i, i + 2));

  let intersections = 0;
  for (let i = 0; i < b.length - 1; i++) {
    if (bigramsA.has(b.substring(i, i + 2))) intersections++;
  }

  return (2 * intersections) / (a.length - 1 + b.length - 1);
}
