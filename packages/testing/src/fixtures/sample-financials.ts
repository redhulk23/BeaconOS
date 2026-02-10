export const SAMPLE_T12 = {
  propertyName: "Beacon Tower",
  period: "T-12 ending June 2024",
  revenue: {
    grossPotentialRent: 1_875_000,
    vacancyLoss: -93_750,
    concessions: -15_000,
    otherIncome: 45_000,
    effectiveGrossIncome: 1_811_250,
  },
  expenses: {
    propertyTaxes: 215_000,
    insurance: 52_000,
    utilities: 118_000,
    repairsAndMaintenance: 78_000,
    managementFee: 72_450,
    janitorial: 45_000,
    security: 36_000,
    landscaping: 12_000,
    generalAndAdmin: 28_000,
    totalExpenses: 656_450,
  },
  netOperatingIncome: 1_154_800,
  capitalExpenditures: 125_000,
  cashFlowBeforeDebt: 1_029_800,
};

export const SAMPLE_RENT_ROLL = {
  propertyName: "Beacon Tower",
  asOfDate: "2024-06-30",
  summary: { totalUnits: 50, occupiedUnits: 46, vacantUnits: 4, occupancyRate: 0.92, totalSqft: 125000, occupiedSqft: 115000 },
  tenants: [
    { suite: "100", tenantName: "Acme Corp", sqft: 2500, monthlyRent: 10833, annualRentPsf: 52.00, leaseStart: "2024-01-01", leaseEnd: "2028-12-31", leaseType: "NNN" },
    { suite: "200", tenantName: "Legal Partners LLP", sqft: 5000, monthlyRent: 20000, annualRentPsf: 48.00, leaseStart: "2022-04-01", leaseEnd: "2027-03-31", leaseType: "NNN" },
    { suite: "300", tenantName: "FinServ Inc", sqft: 8000, monthlyRent: 36667, annualRentPsf: 55.00, leaseStart: "2023-07-01", leaseEnd: "2030-06-30", leaseType: "NNN" },
    { suite: "400", tenantName: "VACANT", sqft: 3000, monthlyRent: 0, annualRentPsf: 0, leaseStart: "", leaseEnd: "", leaseType: "" },
  ],
};
