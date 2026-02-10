export const SAMPLE_OFFICE_LEASE = {
  documentType: "office_lease",
  landlord: { name: "Beacon Properties LLC", address: "100 Main St, Austin, TX 78701" },
  tenant: { name: "TechCo Inc", address: "500 5th Ave, New York, NY 10001" },
  premises: { address: "100 Main St, Suite 400", city: "Austin", state: "TX", zip: "78701", sqft: 12000, floor: 4 },
  term: { commencementDate: "2024-07-01", expirationDate: "2031-06-30", months: 84 },
  rent: { baseRent: 52.00, frequency: "annual_psf", escalation: "3% annual", freeRentMonths: 3 },
  expenses: { type: "nnn", cam: 12.50, insurance: 2.50, taxes: 8.00 },
  securityDeposit: { amount: 52000, type: "cash" },
  ti: { allowance: 65.00, landlordWork: "Base building", tenantWork: "Above standard" },
  options: { renewal: { terms: 2, years: 5, notice: 9 }, expansion: { sqft: 5000, notice: 6 } },
};

export const SAMPLE_RETAIL_LEASE = {
  documentType: "retail_lease",
  landlord: { name: "Harbor Mall LLC", address: "200 Harbor Blvd, San Diego, CA 92101" },
  tenant: { name: "Coffee Bean Express", address: "1 Coffee Lane, Portland, OR 97201" },
  premises: { address: "200 Harbor Blvd, Unit R-12", city: "San Diego", state: "CA", zip: "92101", sqft: 2500, floor: 1 },
  term: { commencementDate: "2024-10-01", expirationDate: "2034-09-30", months: 120 },
  rent: { baseRent: 45.00, frequency: "annual_psf", escalation: "CPI, 2% floor, 4% cap", percentageRent: { breakpoint: 800000, rate: 0.06 } },
  expenses: { type: "nnn", cam: 15.00, insurance: 3.00, taxes: 10.00, merchantsAssociation: 1200 },
  securityDeposit: { amount: 9375, type: "cash" },
};

export const SAMPLE_INDUSTRIAL_LEASE = {
  documentType: "industrial_lease",
  landlord: { name: "Industrial Partners LP", address: "800 Industrial Blvd, Dallas, TX 75201" },
  tenant: { name: "LogiCorp Warehousing", address: "300 Logistics Way, Memphis, TN 38118" },
  premises: { address: "800 Industrial Blvd, Building C", city: "Dallas", state: "TX", zip: "75201", sqft: 75000, clearHeight: 32 },
  term: { commencementDate: "2024-08-01", expirationDate: "2031-07-31", months: 84 },
  rent: { baseRent: 8.50, frequency: "annual_psf", escalation: "2.5% annual" },
  expenses: { type: "nnn", cam: 2.50, insurance: 0.75, taxes: 2.00 },
  securityDeposit: { amount: 53125, type: "letter_of_credit" },
};
