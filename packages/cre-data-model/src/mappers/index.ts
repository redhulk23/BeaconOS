import type {
  Property,
  Unit,
  Lease,
  CRETenant,
  Financial,
} from "../entities/index.js";

// --- Yardi Mappers (stubs matching typical Yardi Voyager API shapes) ---

export function propertyFromYardi(
  yardiProperty: Record<string, unknown>,
): Partial<Property> {
  return {
    name: yardiProperty.PropertyName as string,
    propertyType: mapYardiPropertyType(yardiProperty.PropertyType as string),
    address: yardiProperty.Address1 as string,
    city: yardiProperty.City as string,
    state: yardiProperty.State as string,
    zip: yardiProperty.ZipCode as string,
    totalSqft: yardiProperty.TotalSqFt as number,
    totalUnits: yardiProperty.TotalUnits as number,
    externalIds: { yardi: yardiProperty.PropertyCode as string },
  };
}

export function leaseFromYardi(
  yardiLease: Record<string, unknown>,
): Partial<Lease> {
  return {
    leaseType: mapYardiLeaseType(yardiLease.LeaseType as string),
    status: (yardiLease.Status as string)?.toLowerCase() as Lease["status"],
    startDate: yardiLease.LeaseFromDate as string,
    endDate: yardiLease.LeaseToDate as string,
    monthlyRent: yardiLease.MonthlyRent as number,
    annualRent: yardiLease.AnnualRent as number,
    securityDeposit: yardiLease.SecurityDeposit as number,
    externalIds: { yardi: yardiLease.LeaseId as string },
  };
}

// --- MRI Mappers (stubs matching typical MRI Software API shapes) ---

export function propertyFromMRI(
  mriProperty: Record<string, unknown>,
): Partial<Property> {
  return {
    name: mriProperty.property_name as string,
    propertyType: mapMRIPropertyType(mriProperty.property_type as string),
    address: mriProperty.street_address as string,
    city: mriProperty.city as string,
    state: mriProperty.state as string,
    zip: mriProperty.zip_code as string,
    totalSqft: mriProperty.total_sqft as number,
    externalIds: { mri: mriProperty.entity_id as string },
  };
}

export function leaseFromMRI(
  mriLease: Record<string, unknown>,
): Partial<Lease> {
  return {
    leaseType: mapMRILeaseType(mriLease.lease_type as string),
    status: (mriLease.lease_status as string)?.toLowerCase() as Lease["status"],
    startDate: mriLease.commencement_date as string,
    endDate: mriLease.expiration_date as string,
    monthlyRent: mriLease.base_rent as number,
    camCharges: mriLease.cam_charges as number,
    externalIds: { mri: mriLease.lease_id as string },
  };
}

// --- CoStar Mappers (stubs matching typical CoStar API shapes) ---

export function propertyFromCoStar(
  costarProperty: Record<string, unknown>,
): Partial<Property> {
  return {
    name: costarProperty.BuildingName as string,
    propertyType: mapCoStarPropertyType(costarProperty.PropertyType as string),
    address: costarProperty.StreetAddress as string,
    city: costarProperty.City as string,
    state: costarProperty.State as string,
    zip: costarProperty.Zip as string,
    yearBuilt: costarProperty.YearBuilt as number,
    totalSqft: costarProperty.RBA as number,
    floors: costarProperty.NumberOfStories as number,
    occupancyRate: costarProperty.PercentLeased as number,
    market: costarProperty.Market as string,
    submarket: costarProperty.SubMarket as string,
    externalIds: { costar: String(costarProperty.BuildingId) },
  };
}

// --- Helpers ---

function mapYardiPropertyType(type: string): Property["propertyType"] {
  const map: Record<string, Property["propertyType"]> = {
    OFF: "office",
    RET: "retail",
    IND: "industrial",
    MF: "multifamily",
    MIX: "mixed_use",
    HTL: "hospitality",
    LND: "land",
  };
  return map[type] ?? "office";
}

function mapYardiLeaseType(type: string): Lease["leaseType"] {
  const map: Record<string, Lease["leaseType"]> = {
    GRS: "gross",
    NET: "net",
    NNN: "nnn",
    MOD: "modified_gross",
    PCT: "percentage",
  };
  return map[type] ?? "gross";
}

function mapMRIPropertyType(type: string): Property["propertyType"] {
  const map: Record<string, Property["propertyType"]> = {
    office: "office",
    retail: "retail",
    industrial: "industrial",
    residential: "multifamily",
    mixed: "mixed_use",
  };
  return map[type?.toLowerCase()] ?? "office";
}

function mapMRILeaseType(type: string): Lease["leaseType"] {
  const map: Record<string, Lease["leaseType"]> = {
    gross: "gross",
    net: "net",
    nnn: "nnn",
    modified: "modified_gross",
  };
  return map[type?.toLowerCase()] ?? "gross";
}

function mapCoStarPropertyType(type: string): Property["propertyType"] {
  const map: Record<string, Property["propertyType"]> = {
    Office: "office",
    Retail: "retail",
    Industrial: "industrial",
    Multifamily: "multifamily",
    Flex: "industrial",
    Hospitality: "hospitality",
  };
  return map[type] ?? "office";
}
