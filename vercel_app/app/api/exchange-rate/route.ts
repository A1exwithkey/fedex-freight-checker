import { NextResponse } from "next/server";

export const revalidate = 43200;

const ECB_DAILY_XML_URL = "https://www.ecb.europa.eu/stats/eurofxref/eurofxref-daily.xml";

function extractCubeRate(xml: string, currency: "USD" | "CNY"): number {
  const match = xml.match(new RegExp(`currency=['"]${currency}['"]\\s+rate=['"]([0-9.]+)['"]`));
  if (!match?.[1]) {
    throw new Error(`ECB ${currency} rate not found`);
  }
  return Number(match[1]);
}

function extractSourceDate(xml: string): string {
  const match = xml.match(/<Cube\s+time=['"]([0-9-]+)['"]/);
  if (!match?.[1]) {
    throw new Error("ECB source date not found");
  }
  return match[1];
}

function beijingTimeLabel(date: Date): string {
  return new Intl.DateTimeFormat("zh-CN", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false
  }).format(date);
}

export async function GET() {
  try {
    const response = await fetch(ECB_DAILY_XML_URL, {
      next: { revalidate: 43200 },
      headers: {
        accept: "application/xml,text/xml"
      }
    });

    if (!response.ok) {
      throw new Error(`ECB fetch failed: HTTP ${response.status}`);
    }

    const xml = await response.text();
    const usdPerEur = extractCubeRate(xml, "USD");
    const cnyPerEur = extractCubeRate(xml, "CNY");
    const cnyPerUsd = cnyPerEur / usdPerEur;
    const now = new Date();

    return NextResponse.json({
      status: "OK",
      source: "European Central Bank euro foreign exchange reference rates",
      source_url: ECB_DAILY_XML_URL,
      source_date: extractSourceDate(xml),
      checked_at_utc: now.toISOString(),
      checked_at_beijing: beijingTimeLabel(now),
      usd_per_eur: usdPerEur,
      cny_per_eur: cnyPerEur,
      exchange_rate_cny_per_usd: cnyPerUsd
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown exchange rate error";
    return NextResponse.json(
      {
        status: "Need Review",
        source: "European Central Bank euro foreign exchange reference rates",
        source_url: ECB_DAILY_XML_URL,
        error: message
      },
      { status: 502 }
    );
  }
}
