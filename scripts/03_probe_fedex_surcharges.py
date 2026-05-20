"""Probe FedEx China surcharge pages and summarize current source documents.

This script intentionally does not update app pricing directly. It checks the
official pages, downloads the linked PDFs, extracts version dates, and writes a
machine-readable summary for manual review or a future GitHub Actions workflow.
"""

from __future__ import annotations

import argparse
import json
import re
import ssl
from dataclasses import asdict, dataclass
from datetime import datetime
from io import BytesIO
from pathlib import Path
from typing import Any
from urllib.parse import urljoin
from urllib.request import HTTPSHandler, ProxyHandler, Request, build_opener

from pypdf import PdfReader


DEFAULT_FUEL_URL = "https://www.fedex.com/en-cn/shipping/surcharges.html"
DEFAULT_DEMAND_URL = "https://www.fedex.com/en-cn/shipping/surcharges/demand-surcharge.html"
DEFAULT_FUEL_PDF_URL = "https://www.fedex.com/content/dam/fedex/international/rates/fedex-fuel-table-may-2026-apac.pdf"
DEFAULT_DEMAND_PDF_URL = "https://www.fedex.com/content/dam/fedex/international/rates/fedex-ds-2026-may9-638-en-cn.pdf"
DEFAULT_OUTPUT = Path("data_processed/fedex_surcharge_probe.json")

USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
    "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36"
)


@dataclass
class FetchResult:
    url: str
    ok: bool
    status: int | None
    content_type: str
    error: str | None = None


def fetch_bytes(url: str, timeout: int = 30) -> tuple[bytes, FetchResult]:
    request = Request(url, headers={"User-Agent": USER_AGENT, "Accept-Language": "en-US,en;q=0.9"})
    opener = build_opener(ProxyHandler({}), HTTPSHandler(context=ssl.create_default_context()))
    try:
        with opener.open(request, timeout=timeout) as response:
            data = response.read()
            result = FetchResult(
                url=url,
                ok=200 <= response.status < 400,
                status=response.status,
                content_type=response.headers.get("content-type", ""),
            )
            return data, result
    except Exception as exc:  # noqa: BLE001 - surfaced in JSON for operator review
        return b"", FetchResult(url=url, ok=False, status=None, content_type="", error=str(exc))


def html_text(data: bytes) -> str:
    return data.decode("utf-8", errors="replace")


def extract_links(html: str, base_url: str) -> list[dict[str, str]]:
    links: list[dict[str, str]] = []
    pattern = re.compile(r"<a\b[^>]*href=[\"']([^\"']+)[\"'][^>]*>(.*?)</a>", re.I | re.S)
    for href, label_html in pattern.findall(html):
        label = re.sub(r"<[^>]+>", " ", label_html)
        label = re.sub(r"\s+", " ", label).strip()
        links.append({"label": label, "url": urljoin(base_url, href)})
    return links


def pdf_text(data: bytes) -> str:
    if not data.lstrip().startswith(b"%PDF"):
        raise ValueError("Downloaded content is not a PDF.")
    reader = PdfReader(BytesIO(data))
    pages = []
    for page in reader.pages:
        pages.append(page.extract_text() or "")
    return "\n".join(pages)


def first_match(pattern: str, text: str, flags: int = re.I) -> str | None:
    matched = re.search(pattern, text, flags)
    if not matched:
        return None
    return matched.group(1).strip()


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def is_system_down(html: str) -> bool:
    return "FedEx | System Down" in html or "system down" in html.lower()


def parse_fuel(fuel_url: str, fallback_pdf_url: str | None = None) -> dict[str, Any]:
    data, fetch = fetch_bytes(fuel_url)
    result: dict[str, Any] = {"page_fetch": asdict(fetch)}
    if not fetch.ok:
        return result

    html = html_text(data)
    if is_system_down(html):
        result.update(
            {
                "page_blocked": True,
                "page_title": first_match(r"<title>(.*?)</title>", html, flags=re.I | re.S),
                "page_note": "FedEx returned a System Down page to the script request.",
            }
        )
        pdf_links = [{"label": "Fallback fuel table PDF", "url": fallback_pdf_url}] if fallback_pdf_url else []
    else:
        result["page_blocked"] = False
        text = normalize_spaces(re.sub(r"<[^>]+>", " ", html))
        links = extract_links(html, fuel_url)
        pdf_links = [link for link in links if "fuel-table" in link["url"].lower() and link["url"].lower().endswith(".pdf")]
        if not pdf_links:
            pdf_urls = sorted(set(re.findall(r"https?://[^\"'<> ]+fuel-table[^\"'<> ]+\.pdf", html, re.I)))
            pdf_links = [{"label": "Fuel table PDF", "url": url} for url in pdf_urls]

        result.update(
            {
                "page_title": first_match(r"<title>(.*?)</title>", html, flags=re.I | re.S),
                "page_note_effective": first_match(r"(Effective [A-Z][a-z]+ \d{1,2}, \d{4}[^.]*fuel surcharge table[^.]*\.)", text),
            }
        )

    result.update(
        {
            "fuel_pdf_url": pdf_links[0]["url"] if pdf_links else None,
            "current_surcharge_percent_from_page": None,
            "current_surcharge_status": "Need Review - page text exposes the fuel table PDF, but not a reliable current weekly surcharge row.",
        }
    )

    if not pdf_links:
        return result

    pdf_data, pdf_fetch = fetch_bytes(pdf_links[0]["url"])
    result["pdf_fetch"] = asdict(pdf_fetch)
    if not pdf_fetch.ok:
        return result

    try:
        text_pdf = pdf_text(pdf_data)
    except Exception as exc:  # noqa: BLE001
        result["pdf_parse_error"] = str(exc)
        result["pdf_content_sample"] = pdf_data[:120].decode("utf-8", errors="replace")
        return result
    effective_dates = re.findall(r"Effective (?:from )?([A-Z][A-Za-z]+ \d{1,2}, \d{4}(?:\s*[–-]\s*[A-Z][A-Za-z]+ \d{1,2}, \d{4})?)", text_pdf)
    rows = re.findall(r"\$(\d+\.\d{2})\s*-\s*\$(\d+\.\d{2})\s+(\d+\.\d{2})%", text_pdf)
    result.update(
        {
            "fuel_pdf_effective_dates": list(dict.fromkeys(effective_dates)),
            "fuel_table_row_count": len(rows),
            "fuel_table_first_rows": [{"min_usd": row[0], "max_usd": row[1], "surcharge_percent": row[2]} for row in rows[:5]],
            "fuel_table_last_rows": [{"min_usd": row[0], "max_usd": row[1], "surcharge_percent": row[2]} for row in rows[-5:]],
        }
    )
    return result


def parse_demand(demand_url: str, fallback_pdf_url: str | None = None) -> dict[str, Any]:
    data, fetch = fetch_bytes(demand_url)
    result: dict[str, Any] = {"page_fetch": asdict(fetch)}
    if not fetch.ok:
        return result

    html = html_text(data)
    if is_system_down(html):
        result.update(
            {
                "page_blocked": True,
                "page_title": first_match(r"<title>(.*?)</title>", html, flags=re.I | re.S),
                "page_note": "FedEx returned a System Down page to the script request.",
            }
        )
        pdf_links = [{"label": "Fallback demand surcharge PDF", "url": fallback_pdf_url}] if fallback_pdf_url else []
    else:
        result["page_blocked"] = False
        text = normalize_spaces(re.sub(r"<[^>]+>", " ", html))
        links = extract_links(html, demand_url)
        pdf_links = [
            link
            for link in links
            if link["url"].lower().endswith(".pdf") and ("fedex-ds" in link["url"].lower() or "demand" in link["label"].lower())
        ]
        if not pdf_links:
            pdf_urls = sorted(set(re.findall(r"https?://[^\"'<> ]+(?:fedex-ds|demand)[^\"'<> ]+\.pdf", html, re.I)))
            pdf_links = [{"label": "Demand surcharge PDF", "url": url} for url in pdf_urls]

        result["page_updated"] = first_match(r"Demand Surcharge updated:\s*([A-Z][a-z]+ \d{1,2}, \d{4})", text)

    result.update(
        {
            "demand_pdf_url": pdf_links[0]["url"] if pdf_links else None,
        }
    )

    if not pdf_links:
        return result

    pdf_data, pdf_fetch = fetch_bytes(pdf_links[0]["url"])
    result["pdf_fetch"] = asdict(pdf_fetch)
    if not pdf_fetch.ok:
        return result

    try:
        text_pdf = pdf_text(pdf_data)
    except Exception as exc:  # noqa: BLE001
        result["pdf_parse_error"] = str(exc)
        result["pdf_content_sample"] = pdf_data[:120].decode("utf-8", errors="replace")
        return result
    compact = normalize_spaces(text_pdf)
    export_rates = {
        "Australia, New Zealand": first_match(r"Australia,\s*New Zealand\s+([\d.]+)\s+[\d.]+", compact),
        "Asia": first_match(r"Asia1\s+([\d.]+)\s+[\d.]+", compact),
        "United States of America (USA) and Puerto Rico": first_match(
            r"United States of America \(USA\) and Puerto Rico\s+([\d.]+)\s+[\d.]+", compact
        ),
        "Canada": first_match(r"Canada\s+([\d.]+)\s+[\d.]+", compact),
        "Israel": first_match(r"Israel\s+([\d.]+)\s+[\d.]+", compact),
        "Europe": first_match(r"Europe2\s+([\d.]+)\s+[\d.]+", compact),
        "India": first_match(r"India\s+([\d.]+)\s+[\d.]+", compact),
        "MEISA": first_match(r"Africa3\(MEISA\)\s+([\d.]+)\s+[\d.]+", compact),
        "Mexico": first_match(r"Mexico\s+([\d.]+)\s+[\d.]+", compact),
        "Latin America (LAC)": first_match(r"Latin America4\(LAC\)\s+([\d.]+)\s+[\d.]+", compact),
    }
    result.update(
        {
            "demand_pdf_effective_from": first_match(r"Effective from ([A-Z][A-Za-z]+ \d{1,2}, \d{4})", text_pdf),
            "china_mainland_export_rates_cny_per_kg": export_rates,
            "minimum_cny_per_shipment": first_match(r"Minimum of RMB ([\d.]+) per shipment applies", compact),
            "region_footnote_status": "Captured in PDF text; country-level remapping should be handled in the main extraction script before production update.",
        }
    )
    return result


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--fuel-url", default=DEFAULT_FUEL_URL)
    parser.add_argument("--demand-url", default=DEFAULT_DEMAND_URL)
    parser.add_argument("--fuel-pdf-url", default=DEFAULT_FUEL_PDF_URL)
    parser.add_argument("--demand-pdf-url", default=DEFAULT_DEMAND_PDF_URL)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    payload = {
        "generated_at": datetime.now().isoformat(timespec="seconds"),
        "fuel": parse_fuel(args.fuel_url, args.fuel_pdf_url),
        "demand_surcharge": parse_demand(args.demand_url, args.demand_pdf_url),
    }

    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
