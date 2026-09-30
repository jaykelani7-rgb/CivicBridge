"""Fail-closed local validation/import of normalized official pilot records.

Source files are supplied by an operator after checking publisher reuse terms.
No source value is inferred from a title, ward number, or city-wide aggregate.
"""
import argparse
import csv
import json
from pathlib import Path


REQUIRED_KINDS = {"demographic", "infrastructure", "investment"}


def validate_catalog(catalog: dict, input_dir: Path) -> tuple[list[dict], list[str]]:
    errors = []
    accepted = []
    sources = catalog.get("sources", [])
    if {source.get("kind") for source in sources} != REQUIRED_KINDS:
        errors.append("All three source kinds are required: demographic, infrastructure, investment")
    for source in sources:
        source_id = source.get("source_id", "unknown")
        for key in ("publisher", "url", "retrieved_at", "reference_year", "geography_level", "dataset_version", "transformation", "reuse_terms"):
            if not source.get(key):
                errors.append(f"{source_id}: missing {key}")
        if source.get("reuse_cleared") is not True:
            errors.append(f"{source_id}: reuse terms have not been cleared for import")
        if source.get("geography_level") != catalog.get("target_geography_level"):
            errors.append(f"{source_id}: {source.get('geography_level')} data cannot be assigned to {catalog.get('target_geography_level')} without a validated crosswalk")
        if source.get("boundary_version") != catalog.get("target_boundary_version"):
            errors.append(f"{source_id}: boundary version is missing or mismatched")
        if abs(int(source.get("reference_year", 0)) - int(catalog.get("target_reference_year", 0))) > 3:
            errors.append(f"{source_id}: reference period is stale for this pilot")
        path = input_dir / source.get("asset_file", "")
        if not path.is_file():
            errors.append(f"{source_id}: normalized source file is missing: {path}")
            continue
        with path.open(newline="", encoding="utf-8") as file:
            records = list(csv.DictReader(file))
        if not records:
            errors.append(f"{source_id}: source file is empty")
        for row in records:
            if row.get("source_id") != source_id or row.get("geography_id") != catalog.get("target_geography_id"):
                errors.append(f"{source_id}: record has mismatched source or geography ID")
            if row.get("boundary_version") != catalog.get("target_boundary_version"):
                errors.append(f"{source_id}: record boundary version mismatch")
            if row.get("reference_year") != str(source.get("reference_year")):
                errors.append(f"{source_id}: record reference period mismatch")
            if not row.get("value"):
                errors.append(f"{source_id}: missing measured value")
            accepted.append({**row, "publisher": source.get("publisher"), "source_url": source.get("url"), "retrieved_at": source.get("retrieved_at"), "dataset_version": source.get("dataset_version"), "classification": "official_unverified_import"})
    return accepted, errors


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--catalog", type=Path, default=Path("docs/pilot/cape-town-source-assessment.json"))
    parser.add_argument("--input-dir", type=Path, default=Path("data/raw/cape-town-pilot"))
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    records, errors = validate_catalog(json.loads(args.catalog.read_text(encoding="utf-8")), args.input_dir)
    if errors:
        print(json.dumps({"status": "incomplete", "errors": errors}, indent=2))
        return 1
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(json.dumps(records, indent=2), encoding="utf-8")
    print(json.dumps({"status": "validated_local_import", "record_count": len(records), "production_ingested": False}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
