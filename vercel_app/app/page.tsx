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

function optionLabel(value: string): string {
  return value.replace(" - ", " · ");
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
  const [fuelRateInput, setFuelRateInput] = useState((activeFuel.default_fuel_rate * 100).toFixed(2));
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
  const fuelRate = Number(fuelRateInput) / 100;
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
  const dataOk = allOk && exchangeMeta.status === "OK";
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
      <header className="topbar">
        <h1>
          FedEx 运费核价助手 <span className="version-badge">v3.3</span>
        </h1>
        <div className="header-actions">
          <details className="data-reference">
            <summary>数据参考</summary>
            <div className="popover data-reference-popover">
              <div className={dataOk ? "reference-status ok" : "reference-status review"}>
                <span className="status-dot" aria-hidden="true" />
                {dataOk ? "数据正常" : "部分数据需要复核"}
              </div>
              <div className="reference-list">
                <AuditRow label="网页版本" value={`v3.3 · ${config.web_version}`} />
                <AuditRow label="IP / IE 协议价" value={config.ip_rate_effective_date} />
                <AuditRow label="旺季附加费" value={config.seasonal_surcharge_effective_date} />
                <AuditRow label="燃油附加费周期" value={activeFuel.fuel_effective_label} />
                <AuditRow
                  label="燃油费构成"
                  value={`${percent(activeFuel.fedex_fuel_rate)} + 冗余 ${(activeFuel.fuel_buffer_rate * 100).toFixed(0)}% = ${percent(activeFuel.default_fuel_rate)}`}
                />
                <AuditRow label="汇率日期 / 汇率" value={exchangeLabel} />
              </div>
              <p className="reference-note">0.5–20.5kg 向上取整至 0.5kg 查固定费率；21kg 起按实际重量乘每公斤费率。</p>
            </div>
          </details>
          <details>
            <summary>更新说明</summary>
            <div className="popover update-history">
              <p><strong>v3.3 · 2026-08-20</strong><span>更新页面 UI 与数据参考展示。</span></p>
              <p><strong>v3.2 · 2026-06-22</strong><span>补齐项目结构、数据清单和健康检查。</span></p>
              <p><strong>v3.1 · 2026-06-15</strong><span>接入 GitHub / Vercel 自动部署与燃油发布链路。</span></p>
              <p><strong>v3.0 · 2026-06-07</strong><span>上线 IP / IE 同屏核价与云端统计。</span></p>
              <p><strong>v2.0 · 2026-05-24</strong><span>优化核价页面并加入燃油自动检查。</span></p>
              <p><strong>v1.1 · 2026-05-20</strong><span>加入旺季附加费和可配置燃油费率。</span></p>
              <p><strong>v1.0 · 2026-05-17</strong><span>首个网页试算版本上线。</span></p>
            </div>
          </details>
        </div>
      </header>

      <section className="quote-workbench">
        <aside className="quote-input-panel" aria-label="核价输入">
          <section className="input-section destination-section">
            <h2>目的地</h2>
            <label className="field-block">
              <span className="field-label">下拉选择</span>
              <select
                value={selectedCountry}
                onChange={(event) => {
                  setSelectedCountry(event.target.value);
                  markQuoteChanged();
                }}
              >
                {options.map((option) => (
                  <option key={option} value={option}>
                    {optionLabel(option)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-block manual-destination">
              <span className="field-label">手动输入目的地（可选）</span>
              <input
                value={manualCountry}
                onChange={(event) => {
                  setManualCountry(event.target.value);
                  markQuoteChanged();
                }}
                placeholder="请输入国家或地区名称"
              />
            </label>
            <div className={allOk ? "match-status ok" : "match-status review"}>
              <div className="match-primary">
                <span className="status-dot" aria-hidden="true" />
                {allOk ? (
                  <>
                    已匹配：<strong>{primaryResult.matchedCountry}</strong> · Zone {primaryResult.ipZone}
                  </>
                ) : (
                  <>需要复核：国家或地区尚未准确匹配</>
                )}
              </div>
              <div className="match-secondary">
                {allOk ? `适用${primaryResult.demandRegion}旺季规则` : "请从下拉列表选择，或输入已收录的国家或地区名称"}
              </div>
            </div>
          </section>

          <section className="input-section weight-section">
            <h2>实际重量</h2>
            <label className="weight-input-wrap">
              <input
                aria-label="实际重量 kg"
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
              <span>kg</span>
            </label>
            <div className="weight-presets" aria-label="快捷重量">
              {[0.5, 1, 5, 10].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  className={Number(weightInput) === preset ? "active" : ""}
                  aria-pressed={Number(weightInput) === preset}
                  onClick={() => {
                    setWeightInput(preset.toFixed(2));
                    markQuoteChanged();
                  }}
                >
                  {preset}
                </button>
              ))}
            </div>
          </section>

          <section className="input-section parameter-section">
            <h2>计价参数</h2>
            <div className="parameter-list">
              <label className="parameter-field">
                <span>汇率 USD/CNY</span>
                <span className="compact-input">
                  <input
                    aria-label="汇率 USD/CNY"
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
                </span>
              </label>
              <label className="parameter-field">
                <span>燃油附加费率</span>
                <span className="compact-input with-suffix">
                  <input
                    aria-label="燃油附加费率百分比"
                    type="number"
                    min={0}
                    step={0.25}
                    value={fuelRateInput}
                    onBlur={() => {
                      const parsed = Number(fuelRateInput);
                      setFuelRateInput(Number.isFinite(parsed) ? parsed.toFixed(2) : "0.00");
                      markQuoteChanged();
                    }}
                    onChange={(event) => {
                      setFuelRateInput(event.target.value);
                      markQuoteChanged();
                    }}
                  />
                  <span>%</span>
                </span>
              </label>
              <label className="parameter-field">
                <span>额外冗余</span>
                <span className="compact-input with-suffix">
                  <input
                    aria-label="额外冗余百分比"
                    type="number"
                    min={0}
                    step={1}
                    value={Number(((markup - 1) * 100).toFixed(2))}
                  onChange={(event) => {
                    setMarkup(1 + Number(event.target.value) / 100);
                      markQuoteChanged();
                    }}
                  />
                  <span>%</span>
                </span>
              </label>
            </div>

          </section>
        </aside>

        <section className="comparison-panel">
          <div className="comparison-heading">
            <h2>运费估算</h2>
            <div>
              {primaryResult.matchedCountry} · {Number.isFinite(weightKg) ? weightKg.toFixed(2) : "0.00"} kg · Zone {primaryResult.ipZone}
            </div>
          </div>

          <div className="comparison-grid">
            {results.map((result) => (
              <QuoteCard key={result.serviceType} result={result} />
            ))}
          </div>

          <div className="comparison-details">
            <FeeBreakdown results={results} fuelRate={fuelRate} markup={markup} />
            <section className="calculation-method">
              <h3>计算方式</h3>
              <p>最终 USD = (基础运费 CNY + 旺季附加费 CNY) × (1 + 燃油附加费率) × (1 + 额外冗余) ÷ 汇率</p>
              <p className="calculation-note">IP / IE 分区、查表重量及旺季规则由系统自动匹配。</p>
              <dl className="calculation-data">
                <div>
                  <dt>旺季附加费</dt>
                  <dd>{config.seasonal_surcharge_effective_date}</dd>
                </div>
                <div>
                  <dt>燃油周期</dt>
                  <dd>{activeFuel.fuel_effective_label}</dd>
                </div>
                <div>
                  <dt>燃油构成</dt>
                  <dd>{percent(activeFuel.fedex_fuel_rate)} + 3% = {percent(activeFuel.default_fuel_rate)}</dd>
                </div>
              </dl>
            </section>
          </div>
        </section>
      </section>

      <footer className="page-footer">
        <p className="disclaimer">
          本工具仅用于内部运费快速预估，计算结果不作为最终结算依据；超过 68kg、偏远地区、特殊处理、税费及其他特殊案例需单独复核，实际费用以 FedEx
          账单和公司正式报价流程为准。
        </p>
        <div className="usage-stats">
          {stats.status === "OK" ? (
            <>访问人数 {stats.visitors} · 打开次数 {stats.visits} · 试算次数 {stats.quotes}</>
          ) : (
            <>统计未启用</>
          )}
        </div>
      </footer>
    </main>
  );
}

function QuoteCard({ result }: { result: QuoteResult }) {
  return (
    <article className={`quote-summary ${result.serviceType.toLowerCase()}`}>
      <div className="service-identity">
        <span>{result.serviceType}</span>
        <strong>{result.serviceType === "IP" ? "国际优先" : "国际经济"}</strong>
      </div>
      <div className="quote-usd">{money(result.finalUsd)} USD</div>
      <div className="quote-cny">≈ CNY {money(result.finalCny)}</div>
    </article>
  );
}

function FeeBreakdown({ results, fuelRate, markup }: { results: QuoteResult[]; fuelRate: number; markup: number }) {
  const [ip, ie] = results;
  const ipRedundancy =
    ip.baseCny === null || ip.demandSurchargeCny === null || ip.fuelCny === null
      ? null
      : (ip.baseCny + ip.demandSurchargeCny + ip.fuelCny) * (markup - 1);
  const ieRedundancy =
    ie.baseCny === null || ie.demandSurchargeCny === null || ie.fuelCny === null
      ? null
      : (ie.baseCny + ie.demandSurchargeCny + ie.fuelCny) * (markup - 1);
  const redundancyPercent = Math.max(0, (markup - 1) * 100);
  const rows = [
    { label: "基础运费", ipValue: ip.baseCny, ieValue: ie.baseCny, ipNote: ip.baseFreightNote, ieNote: ie.baseFreightNote },
    { label: `燃油附加费 ${percent(fuelRate)}`, ipValue: ip.fuelCny, ieValue: ie.fuelCny },
    { label: "旺季附加费", ipValue: ip.demandSurchargeCny, ieValue: ie.demandSurchargeCny },
    { label: `额外冗余 ${redundancyPercent.toFixed(0)}%`, ipValue: ipRedundancy, ieValue: ieRedundancy },
    { label: "预计总计", ipValue: ip.finalCny, ieValue: ie.finalCny }
  ] as const;

  return (
    <section className="fee-breakdown">
      <div className="fee-table-head">
        <span>费用明细</span>
        <span className="ip-text">IP · CNY</span>
        <span className="ie-text">IE · CNY</span>
      </div>
      {rows.map((row, index) => (
        <div className={index === rows.length - 1 ? "fee-row total" : "fee-row"} key={row.label}>
          <span>{row.label}</span>
          <span className="ip-value">
            {money(row.ipValue)}
            {"ipNote" in row && <small>{row.ipNote}</small>}
          </span>
          <span className="ie-value">
            {money(row.ieValue)}
            {"ieNote" in row && <small>{row.ieNote}</small>}
          </span>
        </div>
      ))}
    </section>
  );
}

function AuditRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="audit-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}
