import fedexData from "../data/fedex_ip_ie_data.json";
import rateConfig from "../data/rate_config.json";
import { DEFAULT_EXCHANGE_RATE, DEFAULT_MARKUP, calculateQuote } from "../lib/calculator";
import type { FedExData, RateConfig, ServiceType } from "../lib/types";

const data = fedexData as FedExData;
const config = rateConfig as RateConfig;

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function activeFuelRate(rateConfig: RateConfig): number {
  const today = todayIso();
  const scheduled = rateConfig.fuel_schedule
    ?.filter((item) => item.start_date <= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .at(-1);
  return scheduled?.default_fuel_rate ?? rateConfig.default_fuel_rate;
}

const cases: Array<{
  serviceType: ServiceType;
  countryInput: string;
  weightKg: number;
  expectedZone: string;
  expectedBaseCny: number;
}> = [
  { serviceType: "IP", countryInput: "USA", weightKg: 10, expectedZone: "2", expectedBaseCny: 812.56 },
  { serviceType: "IE", countryInput: "USA", weightKg: 10, expectedZone: "2", expectedBaseCny: 805.59 },
  { serviceType: "IE", countryInput: "United Kingdom", weightKg: 10, expectedZone: "K", expectedBaseCny: 502.03 },
  { serviceType: "IE", countryInput: "South Korea", weightKg: 25, expectedZone: "Z", expectedBaseCny: 571.5 }
];

const outputs = cases.map((testCase) => {
  const result = calculateQuote(data, {
    serviceType: testCase.serviceType,
    countryInput: testCase.countryInput,
    weightKg: testCase.weightKg,
    fuelRate: activeFuelRate(config),
    markup: DEFAULT_MARKUP,
    exchangeRate: DEFAULT_EXCHANGE_RATE
  });

  if (result.status !== "OK") {
    throw new Error(`${testCase.serviceType} ${testCase.countryInput}: expected OK, got ${result.status}`);
  }

  if (result.ipZone !== testCase.expectedZone) {
    throw new Error(`${testCase.serviceType} ${testCase.countryInput}: expected Zone ${testCase.expectedZone}, got ${result.ipZone}`);
  }

  if (result.baseCny === null || Math.abs(result.baseCny - testCase.expectedBaseCny) > 0.01) {
    throw new Error(`${testCase.serviceType} ${testCase.countryInput}: expected base ${testCase.expectedBaseCny}, got ${result.baseCny}`);
  }

  if (result.finalUsd === null || result.finalUsd <= 0) {
    throw new Error(`${testCase.serviceType} ${testCase.countryInput}: expected positive final USD, got ${result.finalUsd}`);
  }

  return {
    serviceType: testCase.serviceType,
    countryInput: testCase.countryInput,
    matchedCountry: result.matchedCountry,
    ipZone: result.ipZone,
    weightKg: testCase.weightKg,
    baseCny: result.baseCny,
    finalUsd: Number(result.finalUsd.toFixed(2))
  };
});

console.log(JSON.stringify(outputs, null, 2));
