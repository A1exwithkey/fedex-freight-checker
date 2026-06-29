#!/usr/bin/env python3
"""Sync vercel_app/data/rate_config.json from the public fuel Worker.

This script is intended for GitHub Actions watchdog runs. It uses only the
public Worker endpoint and writes the local config file when the Worker has a
newer current fuel week.
"""

from __future__ import annotations

import json
import os
import subprocess
import sys
from datetime import UTC, datetime
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


WORKER_URL = os.environ.get(
    "FUEL_WORKER_URL",
    "https://fedex-fuel-surcharge-checker.a1exwithkey.workers.dev/fuel-current",
)
CONFIG_PATH = Path(os.environ.get("RATE_CONFIG_PATH", "vercel_app/data/rate_config.json"))


def fetch_text(url: str, timeout: int = 20) -> str:
    request = Request(url, headers={"user-agent": "fedex-fuel-sync/1.0"})
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.read().decode("utf-8")
    except (HTTPError, URLError, OSError) as error:
        return fetch_text_with_curl(url, timeout, error)


def fetch_text_with_curl(url: str, timeout: int, original_error: BaseException) -> str:
    try:
        result = subprocess.run(
            ["curl", "-fsSL", "--max-time", str(timeout), "-A", "fedex-fuel-sync/1.0", url],
            check=True,
            capture_output=True,
            text=True,
        )
        return result.stdout
    except (FileNotFoundError, subprocess.CalledProcessError) as curl_error:
        raise RuntimeError(f"{url} fetch failed: {original_error}; curl fallback failed: {curl_error}") from curl_error


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, payload: dict[str, Any]) -> None:
    path.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def today_utc_date() -> str:
    return datetime.now(UTC).strftime("%Y-%m-%d")


def build_fuel_item(worker: dict[str, Any]) -> dict[str, Any]:
    apply_week = worker.get("fedex_apply_week") or {}
    required = [
        apply_week.get("start_date"),
        apply_week.get("end_date"),
        apply_week.get("label"),
        worker.get("fedex_fuel_rate_percent"),
        worker.get("fuel_buffer_percent"),
        worker.get("tool_fuel_rate_percent"),
    ]
    if any(value is None for value in required):
        raise ValueError("Worker payload is missing publishable fuel fields.")

    return {
        "start_date": apply_week["start_date"],
        "end_date": apply_week["end_date"],
        "label": apply_week["label"],
        "fedex_fuel_rate": round(float(worker["fedex_fuel_rate_percent"]) / 100, 6),
        "fuel_buffer_rate": round(float(worker["fuel_buffer_percent"]) / 100, 6),
        "default_fuel_rate": round(float(worker["tool_fuel_rate_percent"]) / 100, 6),
    }


def sync_config(config: dict[str, Any], worker: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    if worker.get("status") != "OK":
        raise ValueError(f"Worker status is not OK: {worker.get('status')}")

    next_item = build_fuel_item(worker)
    current_label = config.get("fuel_effective_label")
    current_default = config.get("default_fuel_rate")
    changed = current_label != next_item["label"] or float(current_default) != float(next_item["default_fuel_rate"])

    schedule = config.get("fuel_schedule") if isinstance(config.get("fuel_schedule"), list) else []
    merged_schedule = [
        item for item in schedule if item.get("start_date") != next_item["start_date"]
    ]
    merged_schedule.append(next_item)
    merged_schedule = sorted(merged_schedule, key=lambda item: str(item.get("start_date", "")))[-4:]

    next_config = {
        **config,
        "web_version": next_item["start_date"],
        "fuel_effective_label": next_item["label"],
        "fedex_fuel_rate": next_item["fedex_fuel_rate"],
        "fuel_buffer_rate": next_item["fuel_buffer_rate"],
        "default_fuel_rate": next_item["default_fuel_rate"],
        "fuel_schedule": merged_schedule,
        "fuel_update_method": "Auto synced from Cloudflare Worker public fuel endpoint by GitHub Actions watchdog.",
        "updated_at": today_utc_date(),
    }

    return next_config, changed or json.dumps(schedule, sort_keys=True) != json.dumps(merged_schedule, sort_keys=True)


def main() -> int:
    worker = json.loads(fetch_text(WORKER_URL))
    config = load_json(CONFIG_PATH)
    next_config, changed = sync_config(config, worker)

    if changed:
        save_json(CONFIG_PATH, next_config)

    print(json.dumps({
        "status": "UPDATED" if changed else "UNCHANGED",
        "worker_checked_at_utc": worker.get("checked_at_utc"),
        "fuel_week": worker.get("fedex_apply_week", {}).get("label"),
        "fedex_fuel_rate_percent": worker.get("fedex_fuel_rate_percent"),
        "tool_fuel_rate_percent": worker.get("tool_fuel_rate_percent"),
        "config_path": str(CONFIG_PATH),
    }, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(json.dumps({"status": "ERROR", "error": str(error)}, ensure_ascii=False, indent=2), file=sys.stderr)
        raise SystemExit(1)
