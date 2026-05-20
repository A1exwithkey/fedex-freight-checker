"""Extract China Mainland export Demand Surcharge rates from a FedEx PDF."""

from __future__ import annotations

import argparse
import csv
import json
import re
from pathlib import Path
from typing import Any

from pypdf import PdfReader


DEFAULT_PDF = Path("data_raw/fedex-ds-2026-may9-638-en-cn.pdf")
DEFAULT_JSON = Path("data_processed/demand_surcharge_latest.json")
DEFAULT_CSV = Path("data_processed/demand_surcharge_latest.csv")

REGIONS = [
    ("AUNZ", "澳大利亚、新西兰", "Australia, New Zealand", r"Australia,\s*New Zealand\s+([\d.]+)\s+[\d.]+"),
    ("ASIA", "亚洲区", "Asia", r"Asia1\s+([\d.]+)\s+[\d.]+"),
    (
        "US_PR",
        "美国和波多黎各",
        "United States of America (USA) and Puerto Rico",
        r"United States of America \(USA\) and\s+Puerto Rico\s+([\d.]+)\s+[\d.]+",
    ),
    ("CANADA", "加拿大", "Canada", r"Canada\s+([\d.]+)\s+[\d.]+"),
    ("ISRAEL", "以色列", "Israel", r"Israel\s+([\d.]+)\s+[\d.]+"),
    ("EUROPE", "欧洲区", "Europe", r"Europe2\s+([\d.]+)\s+[\d.]+"),
    ("INDIA", "印度", "India", r"India\s+([\d.]+)\s+[\d.]+"),
    (
        "MEISA",
        "中东/印度次大陆/非洲区",
        "Middle East, Indian Subcontinent and Africa",
        r"Middle East/Indian Subcontinent/\s*Africa3\s*\(MEISA\)\s+([\d.]+)\s+[\d.]+",
    ),
    ("MEXICO", "墨西哥", "Mexico", r"Mexico\s+([\d.]+)\s+[\d.]+"),
    ("LAC", "拉丁美洲区", "Latin America", r"Latin America4\s*\(LAC\)\s+([\d.]+)\s+[\d.]+"),
]


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def read_pdf_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def extract_rates(pdf_path: Path) -> dict[str, Any]:
    text = read_pdf_text(pdf_path)
    compact = normalize_spaces(text)
    effective_match = re.search(r"Effective from ([A-Z][A-Za-z]+ \d{1,2}, \d{4})", text)
    minimum_match = re.search(r"Minimum of RMB ([\d.]+) per shipment applies", compact)

    rates = []
    missing = []
    for code, region_cn, region_en, pattern in REGIONS:
        matched = re.search(pattern, compact)
        if not matched:
            missing.append(code)
            rate = None
        else:
            rate = float(matched.group(1))
        rates.append(
            {
                "demand_region_code": code,
                "demand_region_cn": region_cn,
                "demand_region_en": region_en,
                "priority_rate_cny_per_kg": rate,
                "minimum_cny_per_shipment": float(minimum_match.group(1)) if minimum_match else None,
                "source_pdf": pdf_path.name,
                "effective_date": effective_match.group(1) if effective_match else None,
                "notes": "China Mainland export shipments only. ImportOne and G3P columns are excluded.",
            }
        )

    return {
        "source_pdf": pdf_path.name,
        "effective_date": effective_match.group(1) if effective_match else None,
        "minimum_cny_per_shipment": float(minimum_match.group(1)) if minimum_match else None,
        "review_status": "OK" if not missing and effective_match and minimum_match else "Need Review",
        "missing_region_codes": missing,
        "rates": rates,
    }


def write_csv(path: Path, rows: list[dict[str, Any]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8-sig") as file:
        writer = csv.DictWriter(file, fieldnames=list(rows[0].keys()))
        writer.writeheader()
        writer.writerows(rows)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", type=Path, default=DEFAULT_PDF)
    parser.add_argument("--json-output", type=Path, default=DEFAULT_JSON)
    parser.add_argument("--csv-output", type=Path, default=DEFAULT_CSV)
    args = parser.parse_args()

    payload = extract_rates(args.pdf)
    args.json_output.parent.mkdir(parents=True, exist_ok=True)
    args.json_output.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
    write_csv(args.csv_output, payload["rates"])
    print(json.dumps(payload, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
