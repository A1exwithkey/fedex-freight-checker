#!/usr/bin/env python3
"""Check production health for the FedEx freight checker.

This script uses only public endpoints. It does not read secrets.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from dataclasses import dataclass
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


WORKER_URL = "https://fedex-fuel-surcharge-checker.a1exwithkey.workers.dev/fuel-current"
GITHUB_CONFIG_URL = (
    "https://raw.githubusercontent.com/A1exwithkey/"
    "fedex-freight-checker/main/vercel_app/data/rate_config.json"
)
SITE_URL = "https://microsensor-fedex.vercel.app/"
EXCHANGE_URL = "https://microsensor-fedex.vercel.app/api/exchange-rate"


@dataclass
class CheckResult:
    name: str
    ok: bool
    detail: str


def fetch_text(url: str, timeout: int = 20) -> str:
    request = Request(url, headers={"user-agent": "fedex-health-check/1.0"})
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.read().decode("utf-8")
    except (HTTPError, URLError, OSError) as error:
        return fetch_text_with_curl(url, timeout, error)


def fetch_text_with_curl(url: str, timeout: int, original_error: BaseException) -> str:
    try:
        result = subprocess.run(
            [
                "curl",
                "-fsSL",
                "--max-time",
                str(timeout),
                "-A",
                "fedex-health-check/1.0",
                url,
            ],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout
    except (FileNotFoundError, subprocess.CalledProcessError) as curl_error:
        raise RuntimeError(f"{url} fetch failed: {original_error}; curl fallback failed: {curl_error}") from curl_error


def fetch_json(url: str) -> dict[str, Any]:
    return json.loads(fetch_text(url))


def percent(value: float | int | None) -> str:
    if value is None:
        return "null"
    return f"{float(value):.2f}%"


def config_percent(value: float | int | None) -> str:
    if value is None:
        return "null"
    return f"{float(value) * 100:.2f}%"


def main() -> int:
    results: list[CheckResult] = []

    worker = fetch_json(WORKER_URL)
    config = fetch_json(GITHUB_CONFIG_URL)
    site_html = fetch_text(SITE_URL)
    exchange = fetch_json(EXCHANGE_URL)

    worker_week = worker.get("fedex_apply_week", {}).get("label")
    worker_fedex = worker.get("fedex_fuel_rate_percent")
    worker_tool = worker.get("tool_fuel_rate_percent")

    config_week = config.get("fuel_effective_label")
    config_fedex = config.get("fedex_fuel_rate")
    config_tool = config.get("default_fuel_rate")

    results.append(
        CheckResult(
            "worker_status",
            worker.get("status") == "OK",
            f"status={worker.get('status')}, cache={worker.get('cache_status')}",
        )
    )
    results.append(
        CheckResult(
            "worker_vs_github_config",
            worker_week == config_week
            and percent(worker_fedex) == config_percent(config_fedex)
            and percent(worker_tool) == config_percent(config_tool),
            (
                f"worker={worker_week}, {percent(worker_fedex)} + buffer => {percent(worker_tool)}; "
                f"github={config_week}, {config_percent(config_fedex)} => {config_percent(config_tool)}"
            ),
        )
    )

    site_has_week = bool(worker_week and worker_week in site_html)
    site_has_fedex = bool(worker_fedex is not None and percent(worker_fedex) in site_html)
    site_has_tool = bool(worker_tool is not None and percent(worker_tool) in site_html)
    results.append(
        CheckResult(
            "github_config_vs_site",
            site_has_week and site_has_fedex and site_has_tool,
            (
                f"site_has_week={site_has_week}, "
                f"site_has_fedex={site_has_fedex}, site_has_tool={site_has_tool}"
            ),
        )
    )

    exchange_rate = exchange.get("exchange_rate_cny_per_usd")
    results.append(
        CheckResult(
            "exchange_api",
            exchange.get("status") == "OK" and isinstance(exchange_rate, (int, float)),
            f"status={exchange.get('status')}, source_date={exchange.get('source_date')}, rate={exchange_rate}",
        )
    )

    # Basic sanity check that the app shell is the expected product.
    title_matches = re.findall(r"FedEx 运费核价助手", site_html)
    results.append(
        CheckResult(
            "site_identity",
            bool(title_matches),
            f"title_matches={len(title_matches)}",
        )
    )

    output = {
        "status": "OK" if all(item.ok for item in results) else "NEED_REVIEW",
        "worker_checked_at_utc": worker.get("checked_at_utc"),
        "fuel_week": worker_week,
        "fedex_fuel_rate": percent(worker_fedex),
        "tool_fuel_rate": percent(worker_tool),
        "exchange_source_date": exchange.get("source_date"),
        "checks": [item.__dict__ for item in results],
    }
    print(json.dumps(output, ensure_ascii=False, indent=2))
    return 0 if output["status"] == "OK" else 1


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(
            json.dumps(
                {"status": "ERROR", "error": str(error)},
                ensure_ascii=False,
                indent=2,
            ),
            file=sys.stderr,
        )
        raise SystemExit(1)
