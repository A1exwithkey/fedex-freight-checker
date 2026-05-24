const EIA_URL =
  "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=W&n=PET&s=EER_EPJK_PF4_RGC_DPG";
const FEDEX_TABLE_URL =
  "https://www.fedex.com/content/dam/fedex/international/rates/fedex-fuel-table-may-2026-apac.pdf";
const FEDEX_TABLE_EFFECTIVE = "Effective May 18, 2026";
const DEFAULT_BUFFER_RATE = 0.05;
const FUEL_CACHE_URL = "https://fedex-fuel-surcharge-checker.internal/fuel-current-cache";
const FUEL_CACHE_TTL_SECONDS = 60 * 60 * 24 * 7;
const DEFAULT_GITHUB_OWNER = "A1exwithkey";
const DEFAULT_GITHUB_REPO = "fedex-freight-checker";
const DEFAULT_GITHUB_BRANCH = "main";
const RATE_CONFIG_PATH = "data_processed/rate_config.json";

const MONTHS = {
  Jan: 1,
  Feb: 2,
  Mar: 3,
  Apr: 4,
  May: 5,
  Jun: 6,
  Jul: 7,
  Aug: 8,
  Sep: 9,
  Oct: 10,
  Nov: 11,
  Dec: 12,
};

function jsonResponse(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      ...extraHeaders,
    },
  });
}

function cacheableJsonResponse(data) {
  return jsonResponse(data, 200, {
    "cache-control": `public, max-age=${FUEL_CACHE_TTL_SECONDS}`,
  });
}

function fedexFuelTable() {
  const rows = [
    { min_usd: 1.69, max_usd: 1.89, surcharge_percent: 32.0 },
    { min_usd: 1.89, max_usd: 2.09, surcharge_percent: 32.25 },
  ];
  let price = 2.09;
  let surcharge = 32.5;
  while (price < 4.97) {
    rows.push({
      min_usd: Number(price.toFixed(2)),
      max_usd: Number((price + 0.03).toFixed(2)),
      surcharge_percent: Number(surcharge.toFixed(2)),
    });
    price = Number((price + 0.03).toFixed(2));
    surcharge = Number((surcharge + 0.25).toFixed(2));
  }
  return rows;
}

function parseEiaWeeklyPrices(html) {
  const prices = [];
  const rowPattern =
    /<td class='B6'>&nbsp;&nbsp;(\d{4})-([A-Za-z]{3})<\/td>([\s\S]*?)<\/tr>/g;
  const pairPattern =
    /<td class='B5'>(\d{2})\/(\d{2})&nbsp;<\/td>\s*<td class='B3'>(\d+(?:\.\d+)?)&nbsp;/g;
  for (const rowMatch of html.matchAll(rowPattern)) {
    const year = Number(rowMatch[1]);
    const month = MONTHS[rowMatch[2]];
    if (!month) continue;
    for (const pairMatch of rowMatch[3].matchAll(pairPattern)) {
      const mm = Number(pairMatch[1]);
      const dd = Number(pairMatch[2]);
      if (mm !== month) continue;
      prices.push({
        week_end_date: `${year}-${String(mm).padStart(2, "0")}-${String(dd).padStart(2, "0")}`,
        usgc_price_usd_per_gallon: Number(pairMatch[3]),
      });
    }
  }
  prices.sort((a, b) => a.week_end_date.localeCompare(b.week_end_date));
  return prices;
}

function lookupSurcharge(price, table) {
  return (
    table.find((row) => row.min_usd <= price && price < row.max_usd) || null
  );
}

function addDays(date, days) {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function todayInBeijing() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function base64EncodeUtf8(text) {
  let binary = "";
  const bytes = new TextEncoder().encode(text);
  for (let index = 0; index < bytes.length; index += 1) {
    binary += String.fromCharCode(bytes[index]);
  }
  return btoa(binary);
}

function base64DecodeUtf8(text) {
  const binary = atob(String(text || "").replace(/\s/g, ""));
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function fedexApplyWeek(eiaWeekEndDate) {
  const endDate = new Date(`${eiaWeekEndDate}T00:00:00Z`);
  const day = endDate.getUTCDay();
  let daysUntilMonday = (8 - day) % 7;
  if (daysUntilMonday === 0) daysUntilMonday = 7;
  const start = addDays(endDate, daysUntilMonday + 7);
  const end = addDays(start, 6);
  return {
    start_date: isoDate(start),
    end_date: isoDate(end),
    label: `${isoDate(start)} 至 ${isoDate(end)}`,
  };
}

async function fetchEiaHtml() {
  const response = await fetch(EIA_URL, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/125.0 Safari/537.36",
      "accept-language": "en-US,en;q=0.9",
    },
    cf: { cacheTtl: 0, cacheEverything: false },
  });
  const html = await response.text();
  if (!response.ok) {
    throw new Error(`EIA fetch failed with HTTP ${response.status}`);
  }
  return { html, status: response.status, content_type: response.headers.get("content-type") || "" };
}

function buildPayload(eia, bufferRate) {
  const prices = parseEiaWeeklyPrices(eia.html);
  const latest = prices.length ? prices[prices.length - 1] : null;
  const table = fedexFuelTable();
  const matched = latest
    ? lookupSurcharge(latest.usgc_price_usd_per_gallon, table)
    : null;
  const status = latest && matched ? "OK" : "NEED_REVIEW";
  return {
    checked_at_utc: new Date().toISOString(),
    method: "eia-weekly-usgc-plus-fedex-fuel-table",
    status,
    sources: {
      eia_weekly_usgc_jet_fuel: EIA_URL,
      fedex_fuel_table: FEDEX_TABLE_URL,
      fedex_fuel_table_effective: FEDEX_TABLE_EFFECTIVE,
    },
    eia_fetch: {
      status: eia.status,
      content_type: eia.content_type,
    },
    latest_eia_price: latest,
    fedex_apply_week: latest ? fedexApplyWeek(latest.week_end_date) : null,
    matched_fedex_table_row: matched,
    fedex_fuel_rate_percent: matched ? matched.surcharge_percent : null,
    fuel_buffer_percent: bufferRate * 100,
    tool_fuel_rate_percent: matched
      ? matched.surcharge_percent + bufferRate * 100
      : null,
    recent_eia_prices: prices.slice(-6),
    note:
      status === "OK"
        ? "FedEx applies a two-week lag. The latest EIA week price is matched to the FedEx trigger table."
        : "Could not match latest EIA price to the FedEx fuel table.",
  };
}

function buildTelegramMessage(payload) {
  const lines = [
    "FedEx 燃油费自动检查",
    "",
    `状态：${payload.status}`,
  ];
  if (payload.latest_eia_price) {
    lines.push(
      `EIA 周价格：$${payload.latest_eia_price.usgc_price_usd_per_gallon.toFixed(3)}`
    );
    lines.push(`EIA 周结束日：${payload.latest_eia_price.week_end_date}`);
  } else {
    lines.push("EIA 周价格：未识别");
  }
  if (payload.fedex_apply_week) {
    lines.push(`FedEx 适用周：${payload.fedex_apply_week.label}`);
  }
  if (payload.matched_fedex_table_row) {
    const row = payload.matched_fedex_table_row;
    lines.push(`FedEx 区间：$${row.min_usd.toFixed(2)} - $${row.max_usd.toFixed(2)}`);
  }
  if (payload.fedex_fuel_rate_percent !== null) {
    lines.push(`官网燃油费：${payload.fedex_fuel_rate_percent.toFixed(2)}%`);
    lines.push(`工具建议值：${payload.tool_fuel_rate_percent.toFixed(2)}%（官网 +5%冗余）`);
  }
  if (payload.github_update) {
    const update = payload.github_update;
    if (update.status === "UPDATED") {
      lines.push(`网页配置：已提交 GitHub，等待 Streamlit 自动部署`);
      lines.push(`Commit：${update.commit_sha || "已提交"}`);
    } else if (update.status === "UNCHANGED") {
      lines.push("网页配置：无需更新，GitHub 已是当前燃油费");
    } else if (update.status === "SKIPPED") {
      lines.push(`网页配置：未自动发布，原因：${update.reason}`);
    } else {
      lines.push(`网页配置：更新失败，原因：${update.reason || update.status}`);
    }
  }
  lines.push(`FedEx 表版本：${payload.sources.fedex_fuel_table_effective}`);
  lines.push("说明：结果仍建议人工确认后再更新正式报价。");
  return lines.join("\n");
}

async function sendTelegram(env, message) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return { skipped: true, reason: "Telegram secrets are not configured." };
  }
  return sendTelegramToChat(env, env.TELEGRAM_CHAT_ID, message);
}

async function sendTelegramToChat(env, chatId, message) {
  if (!env.TELEGRAM_BOT_TOKEN || !chatId) {
    return { skipped: true, reason: "Telegram token or chat id is not configured." };
  }
  const apiUrl = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text: message,
      disable_web_page_preview: true,
    }),
  });
  const body = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    body_sample: body.slice(0, 300),
  };
}

function authorized(request, env) {
  const url = new URL(request.url);
  if (!env.MANUAL_CHECK_TOKEN) {
    return url.searchParams.get("notify") !== "1";
  }
  return url.searchParams.get("key") === env.MANUAL_CHECK_TOKEN;
}

async function runCheck(env, options = {}) {
  const bufferRate = Number(env.FUEL_BUFFER_RATE || DEFAULT_BUFFER_RATE);
  let payload;
  try {
    payload = buildPayload(await fetchEiaHtml(), bufferRate);
  } catch (error) {
    payload = {
      checked_at_utc: new Date().toISOString(),
      method: "eia-weekly-usgc-plus-fedex-fuel-table",
      status: "NEED_REVIEW",
      sources: {
        eia_weekly_usgc_jet_fuel: EIA_URL,
        fedex_fuel_table: FEDEX_TABLE_URL,
        fedex_fuel_table_effective: FEDEX_TABLE_EFFECTIVE,
      },
      fetch_error: String(error?.message || error),
      note: "EIA fetch or parsing failed.",
    };
  }
  if (options.notify) {
    try {
      payload.telegram = await sendTelegram(env, buildTelegramMessage(payload));
    } catch (error) {
      payload.telegram = { ok: false, error: String(error?.message || error) };
    }
  }
  return payload;
}

async function githubRequest(env, path, options = {}) {
  const owner = env.GITHUB_OWNER || DEFAULT_GITHUB_OWNER;
  const repo = env.GITHUB_REPO || DEFAULT_GITHUB_REPO;
  const url = `https://api.github.com/repos/${owner}/${repo}${path}`;
  const response = await fetch(url, {
    ...options,
    headers: {
      "accept": "application/vnd.github+json",
      "authorization": `Bearer ${env.GITHUB_TOKEN}`,
      "content-type": "application/json",
      "user-agent": "fedex-fuel-surcharge-worker",
      "x-github-api-version": "2022-11-28",
      ...(options.headers || {}),
    },
  });
  const body = await response.json().catch(async () => ({ raw: await response.text() }));
  if (!response.ok) {
    throw new Error(`GitHub API ${response.status}: ${JSON.stringify(body).slice(0, 300)}`);
  }
  return body;
}

function buildRateConfigFromPayload(currentConfig, payload) {
  return {
    ...currentConfig,
    web_version: todayInBeijing(),
    fuel_effective_label: payload.fedex_apply_week.label,
    fedex_fuel_rate: Number((payload.fedex_fuel_rate_percent / 100).toFixed(6)),
    fuel_buffer_rate: Number((payload.fuel_buffer_percent / 100).toFixed(6)),
    default_fuel_rate: Number((payload.tool_fuel_rate_percent / 100).toFixed(6)),
    fuel_update_method: "Auto updated by Cloudflare Worker from EIA weekly USGC price and FedEx fuel table.",
    updated_at: todayInBeijing(),
  };
}

function fuelConfigChanged(currentConfig, nextConfig) {
  return (
    currentConfig.fuel_effective_label !== nextConfig.fuel_effective_label ||
    Number(currentConfig.fedex_fuel_rate) !== Number(nextConfig.fedex_fuel_rate) ||
    Number(currentConfig.default_fuel_rate) !== Number(nextConfig.default_fuel_rate)
  );
}

function validatePublishableFuelPayload(payload) {
  if (payload.status !== "OK") return "Fuel check status is not OK.";
  if (!payload.fedex_apply_week?.label) return "FedEx apply week is missing.";
  if (!Number.isFinite(payload.fedex_fuel_rate_percent)) return "FedEx fuel rate is missing.";
  if (!Number.isFinite(payload.tool_fuel_rate_percent)) return "Tool fuel rate is missing.";
  if (payload.fedex_fuel_rate_percent <= 0 || payload.fedex_fuel_rate_percent > 100) {
    return "FedEx fuel rate is outside expected range.";
  }
  if (payload.tool_fuel_rate_percent <= 0 || payload.tool_fuel_rate_percent > 100) {
    return "Tool fuel rate is outside expected range.";
  }
  return "";
}

async function publishFuelConfigIfChanged(env, payload) {
  const validationError = validatePublishableFuelPayload(payload);
  if (validationError) {
    return { status: "SKIPPED", reason: validationError };
  }
  if (!env.GITHUB_TOKEN) {
    return { status: "SKIPPED", reason: "GITHUB_TOKEN is not configured." };
  }

  const branch = env.GITHUB_BRANCH || DEFAULT_GITHUB_BRANCH;
  try {
    const currentFile = await githubRequest(
      env,
      `/contents/${RATE_CONFIG_PATH}?ref=${encodeURIComponent(branch)}`
    );
    const currentConfig = JSON.parse(base64DecodeUtf8(currentFile.content));
    const nextConfig = buildRateConfigFromPayload(currentConfig, payload);
    if (!fuelConfigChanged(currentConfig, nextConfig)) {
      return { status: "UNCHANGED", reason: "rate_config.json already has current fuel values." };
    }

    const nextText = `${JSON.stringify(nextConfig, null, 2)}\n`;
    const updatedFile = await githubRequest(env, `/contents/${RATE_CONFIG_PATH}`, {
      method: "PUT",
      body: JSON.stringify({
        message: `Update FedEx fuel surcharge ${nextConfig.fuel_effective_label}`,
        content: base64EncodeUtf8(nextText),
        sha: currentFile.sha,
        branch,
      }),
    });
    return {
      status: "UPDATED",
      path: RATE_CONFIG_PATH,
      branch,
      commit_sha: updatedFile.commit?.sha || "",
      html_url: updatedFile.commit?.html_url || "",
    };
  } catch (error) {
    return { status: "ERROR", reason: String(error?.message || error) };
  }
}

function publicFuelPayload(payload) {
  return {
    checked_at_utc: payload.checked_at_utc,
    cache_status: payload.cache_status || "",
    status: payload.status,
    method: payload.method,
    sources: payload.sources,
    latest_eia_price: payload.latest_eia_price || null,
    fedex_apply_week: payload.fedex_apply_week || null,
    matched_fedex_table_row: payload.matched_fedex_table_row || null,
    fedex_fuel_rate_percent: payload.fedex_fuel_rate_percent ?? null,
    fuel_buffer_percent: payload.fuel_buffer_percent ?? null,
    tool_fuel_rate_percent: payload.tool_fuel_rate_percent ?? null,
    note: payload.note || "",
  };
}

async function readCachedFuelPayload() {
  if (!globalThis.caches?.default) return null;
  const response = await caches.default.match(new Request(FUEL_CACHE_URL));
  if (!response) return null;
  const payload = await response.json();
  return { ...payload, cache_status: "HIT" };
}

async function writeCachedFuelPayload(payload) {
  if (!globalThis.caches?.default) return null;
  const publicPayload = {
    ...publicFuelPayload(payload),
    cache_status: "REFRESHED",
  };
  await caches.default.put(
    new Request(FUEL_CACHE_URL),
    cacheableJsonResponse(publicPayload)
  );
  return publicPayload;
}

async function currentFuelPayload(env) {
  const cached = await readCachedFuelPayload();
  if (cached) return cached;
  const payload = await runCheck(env);
  return (await writeCachedFuelPayload(payload)) || {
    ...publicFuelPayload(payload),
    cache_status: "MISS_RECOMPUTED",
  };
}

async function refreshFuelPayload(request, env) {
  if (!authorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const payload = await runCheck(env);
  return jsonResponse((await writeCachedFuelPayload(payload)) || publicFuelPayload(payload));
}

async function publishFuelPayload(request, env) {
  if (!authorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  const payload = await runCheck(env);
  payload.github_update = await publishFuelConfigIfChanged(env, payload);
  await writeCachedFuelPayload(payload);
  if (request && new URL(request.url).searchParams.get("notify") === "1") {
    payload.telegram = await sendTelegram(env, buildTelegramMessage(payload));
  }
  return jsonResponse(payload);
}

function normalizeTelegramCommand(text) {
  const command = String(text || "").trim().split(/\s+/)[0] || "";
  return command.replace(/@[\w_]+$/i, "").toLowerCase();
}

function helpMessage() {
  return [
    "FedEx 燃油费机器人",
    "",
    "/check - 立即检查燃油费",
    "/status - 查看当前燃油费状态",
    "/stats - 查看网站访问和试算统计",
    "/help - 查看命令说明",
    "",
    "说明：燃油费检查结果仍建议人工确认后再更新正式报价。",
  ].join("\n");
}

function statsMessage() {
  return [
    "网站统计",
    "",
    "访问和试算次数目前仍在 Streamlit 本地 CSV 中，重新部署会丢失。",
    "下一步需要接 Cloudflare D1 后，/stats 才能显示长期保存的数据。",
  ].join("\n");
}

async function handleTelegramUpdate(request, env) {
  if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_CHAT_ID) {
    return jsonResponse({ ok: false, error: "Telegram secrets are not configured." }, 500);
  }

  let update;
  try {
    update = await request.json();
  } catch {
    return jsonResponse({ ok: false, error: "Invalid Telegram payload." }, 400);
  }

  const message = update.message || update.edited_message || {};
  const chatId = String(message.chat?.id || "");
  const text = message.text || "";

  if (!chatId || chatId !== String(env.TELEGRAM_CHAT_ID)) {
    return jsonResponse({ ok: true, ignored: true, reason: "Unexpected chat id." });
  }

  const command = normalizeTelegramCommand(text);
  let reply;
  if (command === "/check" || command === "/status") {
    reply = buildTelegramMessage(await runCheck(env));
  } else if (command === "/stats") {
    reply = statsMessage();
  } else {
    reply = helpMessage();
  }

  const telegram = await sendTelegramToChat(env, chatId, reply);
  return jsonResponse({ ok: true, command, telegram });
}

async function setTelegramWebhook(request, env) {
  if (!authorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  if (!env.TELEGRAM_BOT_TOKEN) {
    return jsonResponse({ error: "TELEGRAM_BOT_TOKEN is not configured." }, 500);
  }

  const url = new URL(request.url);
  const webhookUrl = `${url.origin}/telegram`;
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      url: webhookUrl,
      allowed_updates: ["message", "edited_message"],
    }),
  });
  const body = await response.json().catch(async () => ({ raw: await response.text() }));
  return jsonResponse({
    ok: response.ok,
    webhook_url: webhookUrl,
    telegram: body,
  }, response.ok ? 200 : 502);
}

async function getTelegramWebhookInfo(request, env) {
  if (!authorized(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }
  if (!env.TELEGRAM_BOT_TOKEN) {
    return jsonResponse({ error: "TELEGRAM_BOT_TOKEN is not configured." }, 500);
  }
  const response = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
  const body = await response.json().catch(async () => ({ raw: await response.text() }));
  return jsonResponse({ ok: response.ok, telegram: body }, response.ok ? 200 : 502);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/check") {
      if (!authorized(request, env)) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }
      return jsonResponse(
        await runCheck(env, { notify: url.searchParams.get("notify") === "1" })
      );
    }
    if (url.pathname === "/fuel-current") {
      return jsonResponse(await currentFuelPayload(env));
    }
    if (url.pathname === "/refresh-fuel-current") {
      return refreshFuelPayload(request, env);
    }
    if (url.pathname === "/publish-fuel-config") {
      return publishFuelPayload(request, env);
    }
    if (url.pathname === "/telegram") {
      if (request.method !== "POST") {
        return jsonResponse({ ok: false, error: "Use POST for Telegram webhook." }, 405);
      }
      return handleTelegramUpdate(request, env);
    }
    if (url.pathname === "/set-telegram-webhook") {
      return setTelegramWebhook(request, env);
    }
    if (url.pathname === "/telegram-webhook-info") {
      return getTelegramWebhookInfo(request, env);
    }

    return jsonResponse({
      service: "fedex-fuel-surcharge-checker",
      method: "EIA weekly USGC price + FedEx official fuel table",
      manual_test: "/check?key=MANUAL_CHECK_TOKEN",
      manual_test_with_telegram: "/check?notify=1&key=MANUAL_CHECK_TOKEN",
      fuel_current: "/fuel-current",
      refresh_fuel_current: "/refresh-fuel-current?key=MANUAL_CHECK_TOKEN",
      publish_fuel_config: "/publish-fuel-config?notify=1&key=MANUAL_CHECK_TOKEN",
      set_telegram_webhook: "/set-telegram-webhook?key=MANUAL_CHECK_TOKEN",
      telegram_webhook_info: "/telegram-webhook-info?key=MANUAL_CHECK_TOKEN",
      schedule: "Monday 10:00 and 14:00 Asia/Shanghai",
    });
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(
      (async () => {
        const payload = await runCheck(env);
        payload.github_update = await publishFuelConfigIfChanged(env, payload);
        await writeCachedFuelPayload(payload);
        await sendTelegram(env, buildTelegramMessage(payload));
      })()
    );
  },
};
