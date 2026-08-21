#!/usr/bin/env python3
"""Idempotently seed the local Data Intelligence SQLite demo database."""

from __future__ import annotations

import argparse
import os
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--database", default=str(ROOT / "data/intelligence-demo.db"))
    args = parser.parse_args()
    env = {**os.environ, "CB_DATABASE_PATH": args.database, "CB_FIXTURE_DIR": str(ROOT / "services/data-intelligence/fixtures")}
    subprocess.run(
        [str(ROOT / "services/data-intelligence/.venv/bin/python"), "-m", "app.adapters.local.seed"],
        cwd=ROOT / "services/data-intelligence", env=env, check=True,
    )
    print("Seed complete. Existing deterministic fixture rows were preserved; no reset or deletion was performed.")


if __name__ == "__main__":
    main()
