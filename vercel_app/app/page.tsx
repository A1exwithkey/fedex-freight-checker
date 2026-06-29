"use client";

import { track } from "@vercel/analytics";
import { useEffect, useMemo, useRef, useState } from "react";
import fedexData from "../data/fedex_ip_ie_data.json";
import rateConfig from "../data/rate_config.json";
import {
  DEFAULT_COUNTRY_LABEL,
  DEFAULT_EXCHANGE_RATE,
  DEFAULT_MARKUP,
  calculateQuote,
  dropdownOptions
} from "../lib/calculator";
import type { FedExData, QuoteResult, RateConfig, ServiceType } from "../lib/types";

const data = fedexData as FedExData;
const config = rateConfig as RateConfig;

type ExchangeRateMeta = {
  source: string;
  sourceDate: string;
  checkedAt: string;
  status: "OK" | "Need Review";
};

type StatsSnapshot = {
  status: "OK" | "Not Configured" | "Need Review";
  visitors: number | null;
  visits: number | null;
  quotes: number | null;
};

function money(value: number | null): string {
  if (value === null || !Number.isFinite(value)) {
    return "Need Review";
  }
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function percent(value: number): string {
  return `${(value * 100).toFixed(2)}%`;
}

function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function activeFuelConfig(rateConfig: RateConfig) {
  const today = todayIso();
  const scheduled = rateConfig.fuel_schedule
    ?.filter((item) => item.start_date <= today)
    .sort((a, b) => a.start_date.localeCompare(b.start_date))
    .at(-1);

  return scheduled
    ? {
        fuel_effective_label: scheduled.label,
        fedex_fuel_rate: scheduled.fedex_fuel_rate,
        fuel_buffer_rate: scheduled.fuel_buffer_rate,
        default_fuel_rate: scheduled.default_fuel_rate
      }
    : {
        fuel_effective_label: rateConfig.fuel_effective_label,
        fedex_fuel_rate: rateConfig.fedex_fuel_rate,
        fuel_buffer_rate: rateConfig.fuel_buffer_rate,
        default_fuel_rate: rateConfig.default_fuel_rate
      };
}

export default function Home() {
  const options = useMemo(() => dropdownOptions(data), []);
  const activeFuel = useMemo(() => activeFuelConfig(config), []);
  const [selectedCountry, setSelectedCountry] = useState(DEFAULT_COUNTRY_LABEL);
  const [manualCountry, setManualCountry] = useState("");
  const [weightInput, setWeightInput] = useState("10.00");
  const [fuelRate, setFuelRate] = useState(activeFuel.default_fuel_rate);
  const [markup, setMarkup] = useState(DEFAULT_MARKUP);
  const [exchangeRate, setExchangeRate] = useState(config.default_exchange_rate ?? DEFAULT_EXCHANGE_RATE);
  const [exchangeTouched, setExchangeTouched] = useState(false);
  const [quoteRevision, setQuoteRevision] = useState(0);
  const quoteRevisionRef = useRef(0);
  const [stats, setStats] = useState<StatsSnapshot>({
    status: "Not Configured",
    visitors: null,
    visits: null,
    quotes: null
  });
  const [exchangeMeta, setExchangeMeta] = useState<ExchangeRateMeta>({
    source: config.exchange_rate_source ?? "Manual default",
    sourceDate: config.exchange_rate_updated_at ?? "Manual default",
    checkedAt: "",
    status: "Need Review"
  });

  useEffect(() => {
    let cancelled = false;

    async function loadExchangeRate() {
      try {
        const response = await fetch("/api/exchange-rate");
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        const payload = (await response.json()) as {
          status: "OK";
          exchange_rate_cny_per_usd: number;
          source_date: string;
          checked_at_beijing: string;
          source: string;
        };
        if (cancelled) {
          return;
        }
        if (!exchangeTouched) {
          setExchangeRate(Number(payload.exchange_rate_cny_per_usd.toFixed(2)));
        }
        setExchangeMeta({
          source: payload.source,
          sourceDate: payload.source_date,
          checkedAt: payload.checked_at_beijing,
          status: "OK"
        });
      } catch {
        if (!cancelled) {
          setExchangeMeta({
            source: config.exchange_rate_source ?? "Manual default",
            sourceDate: config.exchange_rate_updated_at ?? "Manual default",
            checkedAt: "",
            status: "Need Review"
          });
        }
      }
    }

    loadExchangeRate();
    return () => {
      cancelled = true;
    };
  }, [exchangeTouched]);

  async function sendStatsEvent(type: "visit" | "quote", status?: "OK" | "Need Review") {
    try {
      let visitorId = window.localStorage.getItem("fedex_checker_visitor_id");
      if (!visitorId) {
        visitorId = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`;
        window.localStorage.setItem("fedex_checker_visitor_id", visitorId);
      }

      const response = await fetch("/api/stats", {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({ type, visitorId, status })
      });

      if (response.ok) {
        setStats((await response.json()) as StatsSnapshot);
      }
    } catch {
      setStats((current) => (current.status === "OK" ? current : { ...current, status: "Need Review" }));
    }
  }

  useEffect(() => {
    sendStatsEvent("visit");
  }, []);

  const countryInput = manualCountry.trim() || selectedCountry;
  const weightKg = Number(weightInput);
  const results = (["IP", "IE"] as ServiceType[]).map((serviceType) =>
    calculateQuote(data, {
      serviceType,
      countryInput,
      weightKg,
      fuelRate,
      markup,
      exchangeRate
    })
  );
  const primaryResult = results[0];
  const allOk = results.every((result) => result.status === "OK");
  const exchangeLabel =
    exchangeMeta.status === "OK"
      ? `${exchangeMeta.sourceDate} · ${exchangeRate.toFixed(2)}`
      : `手动默认 · ${exchangeRate.toFixed(2)}`;

  function markQuoteChanged() {
    quoteRevisionRef.current += 1;
    setQuoteRevision(quoteRevisionRef.current);
  }

  useEffect(() => {
    if (quoteRevision === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      track("quote_calculated", {
        status: allOk ? "OK" : "Need Review"
      });
      sendStatsEvent("quote", allOk ? "OK" : "Need Review");
    }, 800);

    return () => window.clearTimeout(timeout);
  }, [quoteRevision, allOk]);

  return (
    <main className="page-shell">
      <header className="topbar quote-topbar">
        <div>
          <h1>FedEx 运费核价助手 3.2</h1>
        </div>
        <div className="header-actions">
          <details>
            <summary>更新通知</summary>
            <div className="popover">
              <p>
                <strong>V1.0 · 2026-05-17</strong>：上线 IP 网页试算版，支持目的地、重量、燃油、冗余和汇率输入。
              </p>
              <p>
                <strong>V1.1 · 2026-05-20</strong>：旺季附加费更新至 2026-05-11，燃油费配置化，优化输入区和统计口径。
              </p>
              <p>
                <strong>V2.0 · 2026-05-24</strong>：建立燃油费自动检查链路，使用 EIA 周价格和 FedEx 燃油表计算，并通过 Telegram 通知。
              </p>
              <p>
                <strong>V3.0 · 2026-06-07</strong>：迁移到 Vercel / Next.js，新增 IP / IE 同屏报价、ECB 汇率自动读取和深色重点报价卡。
              </p>
              <p>
                <strong>V3.1 · 2026-06-15</strong>：将 Vercel 网页纳入 GitHub 管理，更新燃油费至 2026-06-15 周，并整理自动更新链路文档。
              </p>
              <p>
                <strong>V3.2 · 2026-06-29</strong>：旺季附加费更新至 2026-06-29，IP / IE 分别使用对应旺季费率，并补充 MEISA 第 1 / 第 2 组识别。
              </p>
            </div>
          </details>
          <details>
            <summary>反馈留言</summary>
            <div className="popover">
              <textarea placeholder="例如：某个国家匹配不对、某票价格需要复核..." />
              <button type="button">发送留言</button>
            </div>
          </details>
        </div>
      </header>

      <section className="meta-row">
        <span>
          网址版本 <strong>{config.web_version}</strong>
        </span>
        <span>
          IP / IE 协议价 <strong>{config.ip_rate_effective_date}</strong>
        </span>
        <span>
          旺季附加费 <strong>{config.seasonal_surcharge_effective_date}</strong>
        </span>
        <span>
          燃油费 <strong>{activeFuel.fuel_effective_label}</strong>
        </span>
        <span>
          燃油费 <strong>{percent(activeFuel.fedex_fuel_rate)}</strong> + 冗余{" "}
          {(activeFuel.fuel_buffer_rate * 100).toFixed(0)}% = <strong>{percent(activeFuel.default_fuel_rate)}</strong>
        </span>
        <span>
          汇率日期 / 汇率 <strong>{exchangeLabel}</strong>
        </span>
      </section>

      <p className="disclaimer">
        本工具仅用于内部运费快速预估，计算结果不作为最终结算依据；超过 68kg、偏远地区、特殊处理、税费及其他特殊案例需单独复核，实际费用以 FedEx
        账单和公司正式报价流程为准。
      </p>

      <section className="quote-workbench">
        <aside className="input-card quote-input-card">
          <h2>快速试算</h2>
          <div className="input-stack">
            <label>
              <span>目的地</span>
              <select
                value={selectedCountry}
                onChange={(event) => {
                  setSelectedCountry(event.target.value);
                  markQuoteChanged();
                }}
              >
                {options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>目的地手输，可选</span>
              <input
                value={manualCountry}
                onChange={(event) => {
                  setManualCountry(event.target.value);
                  markQuoteChanged();
                }}
                placeholder=""
              />
            </label>
            <label className="weight-field">
              <span>实际重量 kg</span>
              <input
                inputMode="decimal"
                value={weightInput}
                onBlur={() => {
                  const parsed = Number(weightInput);
                  setWeightInput(Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00");
                  markQuoteChanged();
                }}
                onChange={(event) => {
                  setWeightInput(event.target.value);
                  markQuoteChanged();
                }}
              />
            </label>
            <div className="parameter-row vertical">
              <label>
                <span>燃油附加费率</span>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={fuelRate}
                  onChange={(event) => {
                    setFuelRate(Number(event.target.value));
                    markQuoteChanged();
                  }}
                />
              </label>
              <label>
                <span>冗余系数</span>
                <input
                  type="number"
                  min={1}
                  step={0.01}
                  value={markup}
                  onChange={(event) => {
                    setMarkup(Number(event.target.value));
                    markQuoteChanged();
                  }}
                />
              </label>
              <label>
                <span>汇率 CNY/USD</span>
                <input
                  type="number"
                  min={0.01}
                  step={0.01}
                  value={exchangeRate}
                  onChange={(event) => {
                    setExchangeTouched(true);
                    setExchangeRate(Number(event.target.value));
                    markQuoteChanged();
                  }}
                />
              </label>
            </div>
          </div>
        </aside>

        <section className="comparison-panel">
          <div className="comparison-grid">
            {results.map((result) => (
              <QuoteCard key={result.serviceType} result={result} />
            ))}
          </div>

          <div className="quote-context-card">
            <div className="context-head">
              <div>
                <div className="metric-label">匹配结果</div>
                <div className="context-title">{primaryResult.matchedCountry}</div>
              </div>
              <div className={allOk ? "status-pill ok" : "status-pill"}>{allOk ? "OK" : "Need Review"}</div>
            </div>
            <div className="shared-match-grid">
              <Metric label="IP / IE 分区" value={primaryResult.ipZone} compact />
              <Metric label="旺季大区" value={primaryResult.demandRegion} compact />
              <Metric
                label="查表重量"
                value={primaryResult.lookupWeight === null ? "Need Review" : `${primaryResult.lookupWeight.toFixed(2)} kg`}
                compact
              />
              <Metric label="汇率日期" value={exchangeMeta.status === "OK" ? exchangeMeta.sourceDate : "Manual"} compact />
            </div>
          </div>

          <div className="formula">
            最终 USD = (基础运费 CNY + 旺季附加费 CNY) × (1 + 燃油附加费率) × 冗余系数 ÷ 汇率
          </div>
        </section>
      </section>

      <footer className="usage-stats">
        {stats.status === "OK" ? (
          <>
            访问人数 {stats.visitors} · 打开次数 {stats.visits} · 试算次数 {stats.quotes}
          </>
        ) : (
          <>统计未启用</>
        )}
      </footer>
    </main>
  );
}

function QuoteCard({ result }: { result: QuoteResult }) {
  const rateDetail =
    result.perKgRateCny === null ? result.baseFreightNote : result.baseFreightNote;

  return (
    <article className={`quote-card comparison-card ${result.serviceType.toLowerCase()}-card`}>
      <div className="quote-card-head">
        <div>
          <div className="quote-service">{result.serviceType}</div>
          <div className="quote-service-label">{result.serviceLabel.replace(`FedEx ${result.serviceType} `, "")}</div>
        </div>
        <div className={result.status === "OK" ? "status-pill ok" : "status-pill"}>{result.status}</div>
      </div>
      <div className="quote-usd">{money(result.finalUsd)} USD</div>
      <div className="quote-cny">最终 CNY {money(result.finalCny)} · Zone {result.ipZone}</div>
      <div className="quote-metrics">
        <Metric label="基础运费 CNY" value={money(result.baseCny)} />
        <Metric label="燃油附加费 CNY" value={money(result.fuelCny)} />
        <Metric label="计费口径" value={result.rateType} note={rateDetail} />
        <Metric label="旺季附加费 CNY" value={money(result.demandSurchargeCny)} />
      </div>
    </article>
  );
}

function Metric({
  label,
  value,
  compact = false,
  note
}: {
  label: string;
  value: string;
  compact?: boolean;
  note?: string;
}) {
  return (
    <div className={compact ? "metric compact" : "metric"}>
      <div className="metric-label">{label}</div>
      <div className="metric-value">{value}</div>
      {note ? <div className="metric-note">{note}</div> : null}
    </div>
  );
}
