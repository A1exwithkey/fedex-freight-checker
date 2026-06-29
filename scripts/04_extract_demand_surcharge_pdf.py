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

CHINESE_REGION_RATES = [
    ("AUNZ", "澳大利亚、新西兰", "Australia, New Zealand", 0.0, 0.0),
    ("ASIA", "亚洲区", "Asia", 0.0, 0.0),
    ("US_PR", "美国和波多黎各", "United States of America (USA) and Puerto Rico", 5.4, 4.0),
    ("CANADA", "加拿大", "Canada", 5.4, 4.0),
    ("ISRAEL", "以色列", "Israel", 8.0, 8.0),
    ("EUROPE", "欧洲区", "Europe", 8.0, 8.0),
    ("INDIA", "印度", "India", 0.0, 0.0),
    (
        "MEISA_1",
        "中东/印度次大陆/非洲区 第 1 组",
        "Middle East, Indian Subcontinent and Africa Group 1",
        11.2,
        11.2,
    ),
    (
        "MEISA_2",
        "中东/印度次大陆/非洲区 第 2 组",
        "Middle East, Indian Subcontinent and Africa Group 2",
        17.4,
        17.4,
    ),
    ("MEXICO", "墨西哥", "Mexico", 5.4, 4.0),
    ("LAC", "拉丁美洲区", "Latin America", 5.4, 4.0),
]

CHINESE_RATE_CHECKS = [
    ("AUNZ", r"澳大利亚，新西兰\s+0\s+0"),
    ("ASIA", r"亚洲\s*1\s+0\s+0"),
    ("US_PR", r"美国和波多黎各\s+国际优先服务\^\s+5\.4\s+0\s+国际经济服务\^\^\s+4\.0"),
    ("CANADA", r"加拿大\s+国际优先服务\^\s+5\.4\s+0\s+国际经济服务\^\^\s+4\.0"),
    ("ISRAEL", r"以色列\s+8\.0\s+0\.7"),
    ("EUROPE", r"欧洲\s*2\s+8\.0\s+0\.7"),
    ("INDIA", r"印度\s+0\s+0"),
    ("MEISA_1", r"第\s*1\s*组\s+11\.2\s+8\.0"),
    ("MEISA_2", r"第\s*2\s*组\s+17\.4\s+8\.0"),
    ("MEXICO", r"墨西哥\s+国际优先服务\^\s+5\.4\s+0\s+国际经济服务\^\^\s+4\.0"),
    ("LAC", r"拉丁美洲\s*4\s*\(LAC\)\s+国际优先服务\^\s+5\.4\s+0\s+国际经济服务\^\^\s+4\.0"),
]


def normalize_spaces(text: str) -> str:
    return re.sub(r"\s+", " ", text).strip()


def read_pdf_text(pdf_path: Path) -> str:
    reader = PdfReader(str(pdf_path))
    return "\n".join(page.extract_text() or "" for page in reader.pages)


def format_cn_date(match: re.Match[str]) -> str:
    year, month, day = match.groups()
    return f"{int(year):04d}-{int(month):02d}-{int(day):02d}"


def extract_chinese_rates(pdf_path: Path, text: str, compact: str) -> dict[str, Any] | None:
    if "需求附加费（中国大陆）" not in text:
        return None

    effective_match = re.search(r"(\d{4})\s*年\s*(\d{1,2})\s*月\s*(\d{1,2})\s*日起生效", text)
    minimum_match = re.search(r"每票货件的最低收费为\s*([\d.]+)\s*元", compact)
    effective_date = format_cn_date(effective_match) if effective_match else None
    minimum = float(minimum_match.group(1)) if minimum_match else None
    missing = [code for code, pattern in CHINESE_RATE_CHECKS if not re.search(pattern, compact)]

    rates = []
    for code, region_cn, region_en, priority_rate, economy_rate in CHINESE_REGION_RATES:
        rates.append(
            {
                "demand_region_code": code,
                "demand_region_cn": region_cn,
                "demand_region_en": region_en,
                "priority_rate_cny_per_kg": priority_rate,
                "economy_rate_cny_per_kg": economy_rate,
                "minimum_cny_per_shipment": minimum,
                "source_pdf": pdf_path.name,
                "effective_date": effective_date,
                "notes": "China Mainland export shipments only. ImportOne and G3P columns are excluded.",
            }
        )

    return {
        "source_pdf": pdf_path.name,
        "effective_date": effective_date,
        "minimum_cny_per_shipment": minimum,
        "review_status": "OK" if effective_date and minimum and not missing else "Need Review",
        "missing_region_codes": missing,
        "rates": rates,
    }


def extract_rates(pdf_path: Path) -> dict[str, Any]:
    text = read_pdf_text(pdf_path)
    compact = normalize_spaces(text)
    chinese_payload = extract_chinese_rates(pdf_path, text, compact)
    if chinese_payload:
        return chinese_payload

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
                "economy_rate_cny_per_kg": rate,
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
