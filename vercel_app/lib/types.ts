export type AliasRow = {
  alias: string;
  alias_normalized: string;
  canonical_country_region: string;
  ip_zone: string;
  match_note: string;
  demand_region_cn: string;
  demand_region_code: string;
  demand_rate_cny_per_kg: number | string | null;
  demand_minimum_cny: number | string | null;
  demand_review_status: string;
};

export type FixedRateRow = {
  weight_kg: number;
  zone: string | number;
  base_rate_cny: number;
  source_pdf_pages: string;
  service: string;
};

export type PerKgRateRow = {
  min_kg: number;
  max_kg: number;
  zone: string | number;
  rate_cny_per_kg: number;
  source_pdf_pages: string;
  service: string;
};

export type FedExData = {
  country_alias: AliasRow[];
  rates: Record<ServiceType, ServiceRateSet>;
  validation_checks?: ValidationCheckRow[];
};

export type ServiceType = "IP" | "IE";

export type ServiceRateSet = {
  label: string;
  fixed_0_20_5kg: FixedRateRow[];
  perkg_21kg_plus: PerKgRateRow[];
};

export type ValidationCheckRow = {
  test_case_id: string;
  service_type: ServiceType;
  country_input: string;
  zone: string;
  weight_kg: number;
  expected_pdf_value_cny: number;
  system_formula_value: number;
  pdf_page: string;
  pass_fail: string;
  notes: string;
};

export type RateConfig = {
  web_version: string;
  ip_rate_effective_date: string;
  seasonal_surcharge_effective_date: string;
  fuel_effective_label: string;
  fedex_fuel_rate: number;
  fuel_buffer_rate: number;
  default_fuel_rate: number;
  fuel_schedule?: FuelScheduleItem[];
  default_exchange_rate?: number;
  exchange_rate_source?: string;
  exchange_rate_updated_at?: string;
  fuel_source_url?: string;
  fuel_table_url?: string;
  fuel_update_method?: string;
  fuel_auto_update_url?: string;
  updated_at?: string;
};

export type FuelScheduleItem = {
  start_date: string;
  end_date: string;
  label: string;
  fedex_fuel_rate: number;
  fuel_buffer_rate: number;
  default_fuel_rate: number;
};

export type QuoteInput = {
  serviceType: ServiceType;
  countryInput: string;
  weightKg: number;
  fuelRate: number;
  markup: number;
  exchangeRate: number;
};

export type QuoteResult = {
  status: "OK" | "Need Review";
  serviceType: ServiceType;
  serviceLabel: string;
  matchedCountry: string;
  ipZone: string;
  demandRegion: string;
  demandRate: number | null;
  demandMinimum: number | null;
  lookupWeight: number | null;
  rateType: string;
  perKgRateCny: number | null;
  baseFreightNote: string;
  baseCny: number | null;
  demandSurchargeCny: number | null;
  fuelCny: number | null;
  finalCny: number | null;
  finalUsd: number | null;
};
