export function createMockYardiService() {
  return {
    readRentRoll: async (propertyCode: string) => ({
      property: { propertyCode, propertyName: "Test Property", address: { street1: "123 Test St", city: "Austin", state: "TX", zip: "78701" }, propertyType: "office", totalUnits: 10 },
      units: [
        { unitCode: "101", propertyCode, unitType: "office", sqFt: 2500, marketRent: 5000, status: "occupied" as const },
        { unitCode: "102", propertyCode, unitType: "office", sqFt: 3000, marketRent: 6000, status: "vacant" as const },
      ],
      occupancy: { total: 2, occupied: 1, rate: 0.5 },
    }),
    readLease: async (leaseId: string) => [{
      leaseId, propertyCode: "TEST001", unitCode: "101", tenantCode: "T001", tenantName: "Test Tenant",
      leaseType: "new" as const, leaseStartDate: "2024-01-01", leaseEndDate: "2028-12-31",
      monthlyRent: 5000, status: "current" as const, charges: [],
    }],
  };
}

export function createMockCoStarService() {
  return {
    searchProperties: async () => [{
      propertyId: "CSTR001", propertyName: "Test Office Building", address: "456 Market St",
      city: "Austin", state: "TX", propertyType: "office" as const, totalSqft: 50000,
      yearBuilt: 2015, occupancyRate: 0.92, askingRent: 48.00,
    }],
    getComps: async () => [{
      compId: "CMP001", address: "789 Congress Ave", salePrice: 22_000_000,
      pricePsf: 440, capRate: 0.06, saleDate: "2024-03-15",
    }],
  };
}

export function createMockArgusService() {
  return {
    getDcfModel: async (propertyId: string) => ({
      propertyId, modelName: "Test DCF", holdPeriodYears: 10,
      discountRate: 0.08, terminalCapRate: 0.065, reversion: 25_000_000,
      npv: 22_000_000, irr: 0.09, cashFlows: [],
    }),
    getValuation: async (propertyId: string) => ({
      propertyId, valuationDate: "2024-06-01", approachType: "dcf" as const,
      value: 22_000_000, capRate: 0.058, discountRate: 0.08,
    }),
  };
}
