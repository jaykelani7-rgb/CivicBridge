from __future__ import annotations

import argparse
import json
from pathlib import Path

from app.adapters.bigquery.ingestion import BigQueryOfficialDatasetIngestor
from app.config.settings import Settings


def main() -> None:
    parser=argparse.ArgumentParser(description="Load one approved official-dataset manifest into BigQuery.")
    parser.add_argument("manifest",type=Path)
    parser.add_argument("--dry-run",action="store_true",help="Validate and print a plan without contacting BigQuery load endpoints.")
    args=parser.parse_args()
    settings=Settings.from_env()
    if settings.analytical_backend!="bigquery":
        parser.error("set CB_MODE=google or CB_ANALYTICAL_BACKEND=bigquery")
    ingestor=BigQueryOfficialDatasetIngestor(settings.bigquery_project or "",settings.bigquery_dataset or "",
                                             settings.effective_raw_dataset or "",settings.bigquery_location)
    print(json.dumps(ingestor.ingest_path(args.manifest,dry_run=args.dry_run),sort_keys=True))


if __name__=="__main__":
    main()
