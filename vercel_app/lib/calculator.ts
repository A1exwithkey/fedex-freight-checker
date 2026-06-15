import type {
  AliasRow,
  FedExData,
  FixedRateRow,
  PerKgRateRow,
  QuoteInput,
  QuoteResult,
  ServiceType
} from "./types";

export const DEFAULT_MARKUP = 1.1;
export const DEFAULT_EXCHANGE_RATE = 6.8;
export const DEFAULT_COUNTRY_LABEL = "United States - Other Areas (美国其他地区)";
export const DEFAULT_SERVICE_TYPE: ServiceType = "IP";

export function normalizeAlias(value: string): string {
  return value.trim().toLowerCase();
}

export function dropdownOptions(data: FedExData): string[] {
  return data.country_alias
    .filter((row) => row.match_note === "Dropdown display label")
    .map((row) => row.alias);
}

export function lookupCountry(countryInput: string, aliases: AliasRow[]): AliasRow | null {
  const key = normalizeAlias(countryInput);
  if (!key) {
    return null;
  }
  return aliases.find((row) => row.alias_normalized === key) ?? null;
}

function numeric(value: number | string | null | undefined): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function calculateBase(
  weightKg: number,
  zone: string,
  fixedRates: FixedRateRow[],
  perKgRates: PerKgRateRow[]
): Pick<QuoteResult, "baseCny" | "rateType" | "lookupWeight" | "perKgRateCny" | "baseFreightNote"> {
  if (!zone || zone === "Need Review") {
    return {
      baseCny: null,
      rateType: "Need Review",
      lookupWeight: null,
      perKgRateCny: null,
      baseFreightNote: "Zone 未匹配"
    };
  }

  if (weightKg <= 20.5) {
    const lookupWeight = Math.ceil(weightKg * 2) / 2;
    const matched = fixedRates.find(
      (row) => Number(row.weight_kg) === lookupWeight && String(row.zone) === zone
    );
    if (!matched) {
      return {
        baseCny: null,
        rateType: "Need Review",
        lookupWeight,
        perKgRateCny: null,
        baseFreightNote: `查表重量 ${lookupWeight.toFixed(2)}kg 未匹配`
      };
    }
    return {
      baseCny: Number(matched.base_rate_cny),
      rateType: "Fixed 0.5-20.5kg",
      lookupWeight,
      perKgRateCny: null,
      baseFreightNote: `查表重量 ${lookupWeight.toFixed(2)}kg`
    };
  }

  const matched = perKgRates.find(
    (row) =>
      Number(row.min_kg) <= weightKg &&
      Number(row.max_kg) >= weightKg &&
      String(row.zone) === zone
  );
  if (!matched) {
    return {
      baseCny: null,
      rateType: "Need Review",
      lookupWeight: weightKg,
      perKgRateCny: null,
      baseFreightNote: `实际重量 ${weightKg.toFixed(2)}kg 未匹配`
    };
  }
  const perKgRate = Number(matched.rate_cny_per_kg);
  return {
    baseCny: weightKg * perKgRate,
    rateType: "Per kg 21kg+",
    lookupWeight: weightKg,
    perKgRateCny: perKgRate,
    baseFreightNote: `${perKgRate.toFixed(2)} CNY/kg × ${weightKg.toFixed(2)}kg`
  };
}

export function calculateQuote(data: FedExData, input: QuoteInput): QuoteResult {
  const serviceRates = data.rates[input.serviceType];
  const serviceLabel = serviceRates?.label ?? input.serviceType;
  const country = lookupCountry(input.countryInput, data.country_alias);
  if (!country) {
    return {
      status: "Need Review",
      serviceType: input.serviceType,
      serviceLabel,
      matchedCountry: "Need Review",
      ipZone: "Need Review",
      demandRegion: "Need Review",
      demandRate: null,
      demandMinimum: null,
      lookupWeight: null,
      rateType: "Need Review",
      perKgRateCny: null,
      baseFreightNote: "国家/地区未匹配",
      baseCny: null,
      demandSurchargeCny: null,
      fuelCny: null,
      finalCny: null,
      finalUsd: null
    };
  }

  const demandRate = numeric(country.demand_rate_cny_per_kg);
  const demandMinimum = numeric(country.demand_minimum_cny);
  const ipZone = String(country.ip_zone);
  const matchedCountry = String(country.canonical_country_region);
  const demandRegion =
    country.demand_review_status === "OK" ? String(country.demand_region_cn) : "Need Review";
  const base = calculateBase(
    input.weightKg,
    ipZone,
    serviceRates.fixed_0_20_5kg,
    serviceRates.perkg_21kg_plus
  );

  if (
    country.demand_review_status !== "OK" ||
    demandRate === null ||
    demandMinimum === null ||
    base.baseCny === null
  ) {
    return {
      status: "Need Review",
      serviceType: input.serviceType,
      serviceLabel,
      matchedCountry,
      ipZone,
      demandRegion,
      demandRate,
      demandMinimum,
      lookupWeight: base.lookupWeight,
      rateType: base.rateType,
      perKgRateCny: base.perKgRateCny,
      baseFreightNote: base.baseFreightNote,
      baseCny: base.baseCny,
      demandSurchargeCny: null,
      fuelCny: null,
      finalCny: null,
      finalUsd: null
    };
  }

  const demandSurchargeCny = demandRate > 0 ? Math.max(input.weightKg * demandRate, demandMinimum) : 0;
  const freightBeforeFuel = base.baseCny + demandSurchargeCny;
  const fuelCny = freightBeforeFuel * input.fuelRate;
  const finalCny = (freightBeforeFuel + fuelCny) * input.markup;
  const finalUsd = finalCny / input.exchangeRate;

  return {
    status: "OK",
    serviceType: input.serviceType,
    serviceLabel,
    matchedCountry,
    ipZone,
    demandRegion,
    demandRate,
    demandMinimum,
    lookupWeight: base.lookupWeight,
    rateType: base.rateType,
    perKgRateCny: base.perKgRateCny,
    baseFreightNote: base.baseFreightNote,
    baseCny: base.baseCny,
    demandSurchargeCny,
    fuelCny,
    finalCny,
    finalUsd
  };
}
