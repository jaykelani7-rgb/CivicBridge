import json
import logging
from pathlib import Path
from typing import Any, Dict, List, Optional
import httpx
from packages.cloud_runtime import cloud_run_headers

logger = logging.getLogger("data-intelligence-stub")


class DataIntelligenceClient:
    def __init__(self, base_url: str = "http://127.0.0.1:8002", enable_mock: bool = True, authenticate_cloud_run: bool = False):
        self.base_url = base_url
        self.enable_mock = enable_mock
        self.authenticate_cloud_run = authenticate_cloud_run
        self._fixtures_cache: Dict[str, dict] = {}
        self._load_fixtures()

    def _load_fixtures(self):
        # Resolve root C:\googlehacka properly
        root = Path(__file__).resolve().parents[4]
        fixtures_dir = root / "packages" / "test_fixtures"
        if not fixtures_dir.exists():
            fixtures_dir = root / "packages" / "test-fixtures"

        for filename in [
            "india_jaipur_fixtures.json",
            "brazil_rio_fixtures.json",
            "south_africa_capetown_fixtures.json",
        ]:
            filepath = fixtures_dir / filename
            if filepath.exists():
                try:
                    with open(filepath, "r", encoding="utf-8") as f:
                        data = json.load(f)
                        eb_id = data.get("evidence_bundle", {}).get("evidence_bundle_id")
                        hs_id = data.get("hotspot", {}).get("hotspot_id")
                        if eb_id:
                            self._fixtures_cache[eb_id] = data
                        if hs_id:
                            self._fixtures_cache[hs_id] = data
                except Exception as e:
                    logger.warning(f"Could not load fixture file {filename}: {e}")

    def get_evidence_bundle(self, hotspot_id: str, evidence_bundle_id: str) -> Optional[dict]:
        if self.enable_mock:
            if evidence_bundle_id in self._fixtures_cache:
                return self._fixtures_cache[evidence_bundle_id].get("evidence_bundle")
            if hotspot_id in self._fixtures_cache:
                return self._fixtures_cache[hotspot_id].get("evidence_bundle")
            # Default fallback fixture
            return {
                "evidence_bundle_id": evidence_bundle_id,
                "hotspot_id": hotspot_id,
                "valid_evidence_ids": [
                    "src_population_42",
                    "cluster_drainage_42",
                    "src_infra_gap_42",
                ],
                "summary": "Default fallback evidence bundle.",
                "citizen_summaries": ["Recurring flooding reported."],
            }

        try:
            resp = httpx.get(
                f"{self.base_url}/v1/hotspots/{hotspot_id}/evidence",
                headers=cloud_run_headers(self.base_url, self.authenticate_cloud_run),
                timeout=10.0,
            )
            if resp.status_code == 200:
                bundle = resp.json()
                if "valid_evidence_ids" not in bundle:
                    ids = list(bundle.get("request_and_cluster_evidence_ids", []))
                    ids.extend(
                        row.get("source_id")
                        for row in bundle.get("data_sources", [])
                        if row.get("source_id")
                    )
                    bundle["valid_evidence_ids"] = list(dict.fromkeys(ids))
                return bundle
        except Exception as e:
            logger.warning(f"HTTP call to Jay's service failed ({e}). Falling back to mock fixture.")

        return None
