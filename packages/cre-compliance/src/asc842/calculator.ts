import { createLogger } from "@beacon-os/common";

const log = createLogger("cre-compliance:asc842-calculator");

export interface Asc842Input {
  classification: "operating" | "financing";
  /** Monthly lease payment */
  monthlyPayment: number;
  /** Lease term in months */
  leaseTermMonths: number;
  /** Annual discount rate (incremental borrowing rate) */
  discountRate: number;
  /** Initial direct costs (if any) */
  initialDirectCosts?: number;
  /** Lease incentives received from lessor */
  leaseIncentives?: number;
  /** Prepaid rent at commencement */
  prepaidRent?: number;
}

export interface Asc842Result {
  classification: "operating" | "financing";
  /** Right-of-use asset at commencement */
  rouAsset: number;
  /** Lease liability at commencement */
  leaseLiability: number;
  /** Total undiscounted payments */
  totalUndiscountedPayments: number;
  /** Total interest expense (financing) or total lease cost (operating) */
  totalCost: number;
  /** Monthly amortization schedule */
  schedule: Asc842ScheduleEntry[];
}

export interface Asc842ScheduleEntry {
  month: number;
  payment: number;
  interestExpense: number;
  principalReduction: number;
  liabilityBalance: number;
  rouAssetBalance: number;
  /** For operating: single straight-line expense; for financing: amortization + interest */
  totalExpense: number;
}

export function calculateAsc842(input: Asc842Input): Asc842Result {
  const monthlyRate = input.discountRate / 12;
  const n = input.leaseTermMonths;
  const pmt = input.monthlyPayment;

  // Calculate present value of lease payments (lease liability)
  const pvFactor = monthlyRate > 0
    ? (1 - Math.pow(1 + monthlyRate, -n)) / monthlyRate
    : n;
  const leaseLiability = pmt * pvFactor;

  // ROU asset = lease liability + initial direct costs + prepaid rent - lease incentives
  const idc = input.initialDirectCosts ?? 0;
  const incentives = input.leaseIncentives ?? 0;
  const prepaid = input.prepaidRent ?? 0;
  const rouAsset = leaseLiability + idc + prepaid - incentives;

  const totalUndiscounted = pmt * n;

  // Build amortization schedule
  const schedule: Asc842ScheduleEntry[] = [];
  let liabilityBal = leaseLiability;
  let rouBal = rouAsset;

  if (input.classification === "financing") {
    // Financing: interest on liability (effective interest method) + straight-line ROU amortization
    const monthlyAmortization = rouAsset / n;

    for (let m = 1; m <= n; m++) {
      const interest = liabilityBal * monthlyRate;
      const principal = pmt - interest;
      liabilityBal = Math.max(0, liabilityBal - principal);
      rouBal = Math.max(0, rouBal - monthlyAmortization);

      schedule.push({
        month: m,
        payment: pmt,
        interestExpense: round(interest),
        principalReduction: round(principal),
        liabilityBalance: round(liabilityBal),
        rouAssetBalance: round(rouBal),
        totalExpense: round(interest + monthlyAmortization),
      });
    }
  } else {
    // Operating: single straight-line lease expense
    const straightLineExpense = totalUndiscounted / n;

    for (let m = 1; m <= n; m++) {
      const interest = liabilityBal * monthlyRate;
      const principal = pmt - interest;
      liabilityBal = Math.max(0, liabilityBal - principal);
      // ROU asset = liability balance + accrued prepaid/deferred rent adjustment
      rouBal = liabilityBal + (straightLineExpense - pmt) * (n - m);
      if (rouBal < 0) rouBal = 0;

      schedule.push({
        month: m,
        payment: pmt,
        interestExpense: round(interest),
        principalReduction: round(principal),
        liabilityBalance: round(liabilityBal),
        rouAssetBalance: round(rouBal),
        totalExpense: round(straightLineExpense),
      });
    }
  }

  const totalCost = schedule.reduce((sum, entry) => sum + entry.totalExpense, 0);

  log.info(
    {
      classification: input.classification,
      rouAsset: round(rouAsset),
      leaseLiability: round(leaseLiability),
      months: n,
    },
    "ASC 842 calculation completed",
  );

  return {
    classification: input.classification,
    rouAsset: round(rouAsset),
    leaseLiability: round(leaseLiability),
    totalUndiscountedPayments: round(totalUndiscounted),
    totalCost: round(totalCost),
    schedule,
  };
}

function round(value: number, decimals = 2): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}
