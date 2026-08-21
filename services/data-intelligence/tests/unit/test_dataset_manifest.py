import json
from copy import deepcopy
from pathlib import Path

import pytest
from pydantic import ValidationError

from app.adapters.bigquery.ingestion import OfficialDatasetManifest


EXAMPLE=Path(__file__).resolve().parents[2]/"datasets"/"manifests"/"examples"/"india-census-demo.json"


def manifest_payload():
    return json.loads(EXAMPLE.read_text(encoding="utf-8"))


def test_official_manifest_is_versioned_and_hash_is_deterministic():
    first=OfficialDatasetManifest.model_validate(manifest_payload())
    second=OfficialDatasetManifest.model_validate(manifest_payload())
    assert first.snapshot_id==second.snapshot_id
    assert first.snapshot_id.startswith("snap_")
    assert first.synthetic is False
    assert first.assets[0].uri.startswith("gs://")


def test_official_ingestion_rejects_synthetic_or_unversioned_inputs():
    payload=manifest_payload()
    payload["synthetic"]=True
    with pytest.raises(ValidationError): OfficialDatasetManifest.model_validate(payload)
    payload=manifest_payload()
    payload["manifest_version"]="unversioned"
    with pytest.raises(ValidationError): OfficialDatasetManifest.model_validate(payload)


def test_manifest_rejects_duplicate_assets_and_non_gcs_uri():
    payload=manifest_payload()
    payload["assets"].append(deepcopy(payload["assets"][0]))
    with pytest.raises(ValidationError,match="asset_id"): OfficialDatasetManifest.model_validate(payload)
    payload=manifest_payload()
    payload["assets"][0]["uri"]="https://example.com/data.parquet"
    with pytest.raises(ValidationError,match="gs://"): OfficialDatasetManifest.model_validate(payload)
