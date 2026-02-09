import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-compliance:asc842-classifier");

/**
 * ASC 842 Lease Classification
 *
 * A lease is classified as a financing (finance) lease if ANY of these criteria are met:
 * 1. Transfer of ownership at end of lease term
 * 2. Purchase option the lessee is reasonably certain to exercise
 * 3. Lease term is for a major part (≥75%) of the remaining economic life
 * 4. Present value of lease payments ≥ substantially all (≥90%) of the fair value
 * 5. Underlying asset is specialized with no alternative use to the lessor
 *
 * Otherwise, it is classified as an operating lease.
 */

export interface ClassificationInput {
  /** Whether ownership transfers to lessee at end of term */
  transfersOwnership: boolean;
  /** Whether lessee has a bargain purchase option they're reasonably certain to exercise */
  hasBargainPurchaseOption: boolean;
  /** Lease term in months */
  leaseTermMonths: number;
  /** Remaining economic life of the asset in months */
  economicLifeMonths: number;
  /** Present value of all lease payments */
  pvOfPayments: number;
  /** Fair value of the underlying asset */
  fairValue: number;
  /** Whether the asset is specialized with no alternative use to lessor */
  isSpecializedAsset: boolean;
}

export interface ClassificationResult {
  classification: "operating" | "financing";
  reasons: string[];
  criteria: {
    ownershipTransfer: boolean;
    bargainPurchaseOption: boolean;
    majorPartOfLife: boolean;
    substantiallyAllFairValue: boolean;
    specializedAsset: boolean;
  };
}

const MAJOR_PART_THRESHOLD = 0.75;
const SUBSTANTIALLY_ALL_THRESHOLD = 0.90;

export function classifyLease(input: ClassificationInput): ClassificationResult {
  const reasons: string[] = [];
  const criteria = {
    ownershipTransfer: input.transfersOwnership,
    bargainPurchaseOption: input.hasBargainPurchaseOption,
    majorPartOfLife: false,
    substantiallyAllFairValue: false,
    specializedAsset: input.isSpecializedAsset,
  };

  if (input.transfersOwnership) {
    reasons.push("Ownership transfers to lessee at end of lease term");
  }

  if (input.hasBargainPurchaseOption) {
    reasons.push("Lessee has a bargain purchase option reasonably certain to be exercised");
  }

  if (input.economicLifeMonths > 0) {
    const lifeRatio = input.leaseTermMonths / input.economicLifeMonths;
    criteria.majorPartOfLife = lifeRatio >= MAJOR_PART_THRESHOLD;
    if (criteria.majorPartOfLife) {
      reasons.push(
        `Lease term (${input.leaseTermMonths}mo) is ≥${MAJOR_PART_THRESHOLD * 100}% of economic life (${input.economicLifeMonths}mo) — ratio: ${(lifeRatio * 100).toFixed(1)}%`,
      );
    }
  }

  if (input.fairValue > 0) {
    const fvRatio = input.pvOfPayments / input.fairValue;
    criteria.substantiallyAllFairValue = fvRatio >= SUBSTANTIALLY_ALL_THRESHOLD;
    if (criteria.substantiallyAllFairValue) {
      reasons.push(
        `PV of payments ($${input.pvOfPayments.toLocaleString()}) is ≥${SUBSTANTIALLY_ALL_THRESHOLD * 100}% of fair value ($${input.fairValue.toLocaleString()}) — ratio: ${(fvRatio * 100).toFixed(1)}%`,
      );
    }
  }

  if (input.isSpecializedAsset) {
    reasons.push("Asset is specialized with no alternative use to the lessor");
  }

  const isFinancing = Object.values(criteria).some((v) => v === true);
  const classification = isFinancing ? "financing" : "operating";

  if (!isFinancing) {
    reasons.push("No financing lease criteria met — classified as operating lease");
  }

  log.info({ classification, criteriaCount: reasons.length }, "Lease classified under ASC 842");

  return { classification, reasons, criteria };
}
