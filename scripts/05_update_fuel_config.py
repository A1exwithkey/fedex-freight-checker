"""Update app fuel surcharge config.

FedEx's fuel page may block plain script requests. This helper keeps the
business value in a small JSON file so the Streamlit app does not hard-code
fuel dates or percentages.
"""

from __future__ import annotations

import argparse
import json
from datetime import date
from pathlib import Path
from typing import Any


DEFAULT_CONFIG = Path("data_processed/rate_config.json")
DEFAULT_SOURCE_URL = "https://www.fedex.com/en-cn/shipping/surcharges.html"
DEFAULT_TABLE_URL = "https://www.fedex.com/content/dam/fedex/international/rates/fedex-fuel-table-may-2026-apac.pdf"


def load_config(path: Path) -> dict[str, Any]:
    if not path.exists():
        return {}
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG)
    parser.add_argument("--fedex-rate", type=float, required=True, help="Official FedEx fuel rate, e.g. 0.5025 for 50.25%.")
    parser.add_argument("--buffer-rate", type=float, default=0.05, help="Internal buffer rate, default 0.05.")
    parser.add_argument("--effective-label", required=True, help="Display label, e.g. '2026-05-18 起'.")
    parser.add_argument("--source-url", default=DEFAULT_SOURCE_URL)
    parser.add_argument("--table-url", default=DEFAULT_TABLE_URL)
    parser.add_argument("--note", default="")
    args = parser.parse_args()

    config = load_config(args.config)
    config.update(
        {
            "fuel_effective_label": args.effective_label,
            "fedex_fuel_rate": args.fedex_rate,
            "fuel_buffer_rate": args.buffer_rate,
            "default_fuel_rate": args.fedex_rate + args.buffer_rate,
            "fuel_source_url": args.source_url,
            "fuel_table_url": args.table_url,
            "fuel_update_method": args.note,
            "updated_at": date.today().isoformat(),
        }
    )
    args.config.parent.mkdir(parents=True, exist_ok=True)
    args.config.write_text(json.dumps(config, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(config, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
