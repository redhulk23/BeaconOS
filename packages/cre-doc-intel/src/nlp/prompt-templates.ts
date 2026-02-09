export const LEASE_EXTRACTION_PROMPT = `You are a commercial real estate lease abstraction expert. Extract the following data points from this lease document. For each field, provide the extracted value and a confidence score from 0.0 to 1.0.

Extract these fields:
- Landlord name and entity type
- Tenant name and entity type
- Property address (street, city, state, zip)
- Premises description (suite/unit, floor, square footage)
- Lease type (gross, net, NNN, modified gross, percentage, ground)
- Lease commencement date
- Lease expiration date
- Lease term (months)
- Base rent (monthly and annual)
- Rent per square foot
- Rent escalation type and schedule
- Security deposit amount
- CAM charges (amount or method)
- Insurance charges
- Real estate tax charges
- Operating expense stop or base year
- Renewal options (number, term, notice period, rent terms)
- Termination options (date, notice period, fee)
- Assignment and subletting rights
- Tenant improvement allowance
- Free rent period
- Parking allocation
- Permitted use
- Exclusive use clause
- Co-tenancy clause
- Guarantor information
- Late payment terms
- Default and cure period
- Holdover rent terms
- Right of first refusal/offer
- Signage rights
- Maintenance and repair obligations
- Insurance requirements (types and limits)
- Subordination/non-disturbance
- Estoppel certificate timeline
- Condemnation/eminent domain terms
- Force majeure provisions
- Governing law and jurisdiction

Return JSON with this structure:
{
  "fields": {
    "field_name": { "value": "extracted value", "confidence": 0.95, "page": 1, "source_text": "relevant quote" }
  },
  "summary": "Brief 2-3 sentence summary of key lease terms",
  "warnings": ["any concerning clauses or unusual terms"]
}`;

export const RENT_ROLL_EXTRACTION_PROMPT = `You are a commercial real estate analyst. Extract the rent roll data from this document.

For each unit/tenant, extract:
- Unit number/suite
- Tenant name
- Square footage
- Lease start date
- Lease expiration date
- Monthly base rent
- Annual base rent
- Rent per square foot
- Lease type
- Status (occupied/vacant)
- Any notes or special terms

Also extract property-level summaries:
- Total square footage
- Total occupied square footage
- Occupancy rate
- Total monthly rent
- Average rent per square foot
- Weighted average lease term remaining

Return JSON with this structure:
{
  "units": [{ "unitNumber": "", "tenantName": "", "sqft": 0, ... }],
  "summary": { "totalSqft": 0, "occupancyRate": 0, ... },
  "asOfDate": "date if stated",
  "confidence": 0.95
}`;

export const T12_EXTRACTION_PROMPT = `You are a commercial real estate financial analyst. Extract the trailing 12-month (T-12) operating statement data from this document.

Extract for each period (monthly if available, otherwise totals):

Revenue line items:
- Gross potential rent
- Loss to lease
- Vacancy loss
- Concessions
- Bad debt
- Other income (itemized)
- Effective gross income

Expense line items:
- Real estate taxes
- Insurance
- Utilities (itemized if available)
- Repairs and maintenance
- Management fees
- Payroll
- Administrative
- Marketing
- Contract services
- Capital reserves
- Other expenses (itemized)
- Total operating expenses

Calculated:
- Net operating income (NOI)
- NOI margin
- Operating expense ratio
- Per-unit and per-sqft metrics

Return JSON with this structure:
{
  "periods": [{ "month": "", "revenue": {}, "expenses": {}, "noi": 0 }],
  "annualTotals": { "revenue": {}, "expenses": {}, "noi": 0 },
  "metrics": { "noiMargin": 0, "opexRatio": 0, "noiPerSqft": 0 },
  "propertyInfo": { "name": "", "address": "" },
  "confidence": 0.95
}`;

export function getPromptForDocumentType(docType: string): string {
  switch (docType) {
    case "lease":
    case "amendment":
      return LEASE_EXTRACTION_PROMPT;
    case "rent_roll":
      return RENT_ROLL_EXTRACTION_PROMPT;
    case "t12":
      return T12_EXTRACTION_PROMPT;
    default:
      return LEASE_EXTRACTION_PROMPT;
  }
}
