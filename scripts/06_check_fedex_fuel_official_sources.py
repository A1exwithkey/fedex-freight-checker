"""Calculate FedEx China fuel surcharge from official source components.

Inputs:
- EIA weekly U.S. Gulf Coast kerosene-type jet fuel spot price.
- FedEx APAC fuel surcharge table effective May 18, 2026.

The FedEx China page itself renders the current row with JavaScript, and FedEx
often blocks server-side browser rendering. This script avoids that page row:
it reads the EIA price and applies the FedEx published trigger table.
"""

from __future__ import annotations

import argparse
import json
import os
import re
import urllib.error
import urllib.request
from dataclasses import dataclass
from datetime import date, datetime, timedelta, timezone
from typing import Any


EIA_URL = "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=W&n=PET&s=EER_EPJK_PF4_RGC_DPG"
FEDEX_TABLE_URL = "https://www.fedex.com/content/dam/fedex/international/rates/fedex-fuel-table-may-2026-apac.pdf"
FEDEX_TABLE_EFFECTIVE = "Effective May 18, 2026"
DEFAULT_BUFFER_RATE = 0.05

MONTHS = {
    "Jan": 1,
    "Feb": 2,
    "Mar": 3,
    "Apr": 4,
    "May": 5,
    "Jun": 6,
    "Jul": 7,
    "Aug": 8,
    "Sep": 9,
    "Oct": 10,
    "Nov": 11,
    "Dec": 12,
}


@dataclass(frozen=True)
class FuelTableRow:
    min_usd: float
    max_usd: float
    surcharge_percent: float


def fedex_fuel_table() -> list[FuelTableRow]:
    rows = [
        FuelTableRow(1.69, 1.89, 32.00),
        FuelTableRow(1.89, 2.09, 32.25),
    ]
    price = 2.09
    surcharge = 32.50
    while price < 4.97:
        rows.append(FuelTableRow(round(price, 2), round(price + 0.03, 2), round(surcharge, 2)))
        price = round(price + 0.03, 2)
        surcharge = round(surcharge + 0.25, 2)
    return rows


def fetch_text(url: str, timeout: int = 30) -> str:
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/125.0 Safari/537.36",
            "Accept-Language": "en-US,en;q=0.9",
        },
    )
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read().decode("utf-8", errors="replace")


def parse_eia_weekly_prices(html: str) -> list[dict[str, Any]]:
    prices: list[dict[str, Any]] = []
    row_pattern = re.compile(
        r"<td class='B6'>&nbsp;&nbsp;(\d{4})-([A-Za-z]{3})</td>(.*?)</tr>",
        re.S,
    )
    pair_pattern = re.compile(
        r"<td class='B5'>(\d{2})/(\d{2})&nbsp;</td>\s*<td class='B3'>(\d+(?:\.\d+)?)&nbsp;",
        re.S,
    )
    for year_text, month_text, row_html in row_pattern.findall(html):
        year = int(year_text)
        month = MONTHS.get(month_text)
        if not month:
            continue
        for mm_text, dd_text, value_text in pair_pattern.findall(row_html):
            mm = int(mm_text)
            dd = int(dd_text)
            if mm != month:
                continue
            prices.append(
                {
                    "week_end_date": date(year, mm, dd).isoformat(),
                    "usgc_price_usd_per_gallon": float(value_text),
                }
            )
    prices.sort(key=lambda item: item["week_end_date"])
    return prices


def lookup_surcharge(price: float, table: list[FuelTableRow]) -> dict[str, Any] | None:
    for row in table:
        if row.min_usd <= price < row.max_usd:
            return {
                "min_usd": row.min_usd,
                "max_usd": row.max_usd,
                "surcharge_percent": row.surcharge_percent,
            }
    return None


def next_monday_after(day: date) -> date:
    days_until_monday = (7 - day.weekday()) % 7
    if days_until_monday == 0:
        days_until_monday = 7
    return day + timedelta(days=days_until_monday)


def fedex_apply_week(eia_week_end: str) -> dict[str, str]:
    end_date = date.fromisoformat(eia_week_end)
    start = next_monday_after(end_date) + timedelta(days=7)
    end = start + timedelta(days=6)
    return {
        "start_date": start.isoformat(),
        "end_date": end.isoformat(),
        "label": f"{start.isoformat()} 至 {end.isoformat()}",
    }


def build_payload(buffer_rate: float) -> dict[str, Any]:
    html = fetch_text(EIA_URL)
    prices = parse_eia_weekly_prices(html)
    latest = prices[-1] if prices else None
    table = fedex_fuel_table()
    selected_row = lookup_surcharge(latest["usgc_price_usd_per_gallon"], table) if latest else None
    status = "OK" if latest and selected_row else "NEED_REVIEW"
    payload: dict[str, Any] = {
        "checked_at_utc": datetime.now(timezone.utc).isoformat(),
        "method": "eia-weekly-usgc-plus-fedex-fuel-table",
        "status": status,
        "sources": {
            "eia_weekly_usgc_jet_fuel": EIA_URL,
            "fedex_fuel_table": FEDEX_TABLE_URL,
            "fedex_fuel_table_effective": FEDEX_TABLE_EFFECTIVE,
        },
        "latest_eia_price": latest,
        "fedex_apply_week": fedex_apply_week(latest["week_end_date"]) if latest else None,
        "matched_fedex_table_row": selected_row,
        "fedex_fuel_rate_percent": selected_row["surcharge_percent"] if selected_row else None,
        "fuel_buffer_percent": buffer_rate * 100,
        "tool_fuel_rate_percent": selected_row["surcharge_percent"] + buffer_rate * 100 if selected_row else None,
        "recent_eia_prices": prices[-6:],
        "note": (
            "FedEx applies a two-week lag. The latest EIA week price is matched to the FedEx trigger table."
            if status == "OK"
            else "Could not match latest EIA price to the FedEx fuel table."
        ),
    }
    return payload


def build_message(payload: dict[str, Any]) -> str:
    lines = [
        "FedEx 燃油费自动检查",
        "",
        f"状态：{payload['status']}",
        f"EIA 周价格：${payload['latest_eia_price']['usgc_price_usd_per_gallon']:.3f}"
        if payload.get("latest_eia_price")
        else "EIA 周价格：未识别",
        f"EIA 周结束日：{payload['latest_eia_price']['week_end_date']}"
        if payload.get("latest_eia_price")
        else "EIA 周结束日：未识别",
    ]
    if payload.get("fedex_apply_week"):
        lines.append(f"FedEx 适用周：{payload['fedex_apply_week']['label']}")
    if payload.get("matched_fedex_table_row"):
        row = payload["matched_fedex_table_row"]
        lines.append(f"FedEx 区间：${row['min_usd']:.2f} - ${row['max_usd']:.2f}")
    if payload.get("fedex_fuel_rate_percent") is not None:
        lines.append(f"官网燃油费：{payload['fedex_fuel_rate_percent']:.2f}%")
        lines.append(f"工具建议值：{payload['tool_fuel_rate_percent']:.2f}%（官网 +5%冗余）")
    lines.append(f"FedEx 表版本：{payload['sources']['fedex_fuel_table_effective']}")
    lines.append("说明：结果仍建议人工确认后再更新正式报价。")
    return "\n".join(lines)


def send_telegram(message: str) -> dict[str, Any]:
    token = os.environ.get("TELEGRAM_BOT_TOKEN")
    chat_id = os.environ.get("TELEGRAM_CHAT_ID")
    if not token or not chat_id:
        return {"skipped": True, "reason": "TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID is not set."}
    url = f"https://api.telegram.org/bot{token}/sendMessage"
    data = json.dumps({"chat_id": chat_id, "text": message, "disable_web_page_preview": True}).encode("utf-8")
    request = urllib.request.Request(url, data=data, headers={"content-type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(request, timeout=20) as response:
            body = response.read().decode("utf-8", errors="replace")
            return {"ok": 200 <= response.status < 300, "status": response.status, "body_sample": body[:300]}
    except urllib.error.URLError as exc:
        return {"ok": False, "error": str(exc)}


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--buffer-rate", type=float, default=DEFAULT_BUFFER_RATE)
    parser.add_argument("--notify", action="store_true")
    args = parser.parse_args()

    payload = build_payload(args.buffer_rate)
    if args.notify:
        payload["telegram"] = send_telegram(build_message(payload))
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
