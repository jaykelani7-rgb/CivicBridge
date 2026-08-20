import os
import math
import uuid
import datetime
from typing import Dict, Any, List, Optional
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

USE_MOCK_SERVICES = os.getenv("USE_MOCK_SERVICES", "true").lower() == "true"

class CivicBridgeDatabase:
    def __init__(self):
        # In-memory collections to act as our Firestore / BigQuery database for the demo
        self.requests: Dict[str, Dict[str, Any]] = {}
        self.request_ai_labels: Dict[str, Dict[str, Any]] = {}
        self.request_corrections: List[Dict[str, Any]] = []
        self.issue_clusters: Dict[str, Dict[str, Any]] = {}
        self.cluster_members: List[Dict[str, Any]] = []
        
        # Hardcoded geo polygons (wards in India, Brazil, South Africa) for demo purposes
        # Each contains coordinates representing the bounds, plus mock demographic and infrastructure metrics.
        self.admin_units: Dict[str, Dict[str, Any]] = {}
        self.demographic_features: Dict[str, Dict[str, Any]] = {}
        self.infrastructure_indices: Dict[str, Dict[str, Any]] = {}
        self.investment_projects: Dict[str, Dict[str, Any]] = {}
        self.hotspots_daily: Dict[str, Dict[str, Any]] = {}
        self.recommendations: Dict[str, Dict[str, Any]] = {}
        self.policy_decisions: List[Dict[str, Any]] = []
        self.impact_metrics: Dict[str, List[Dict[str, Any]]] = {} # project_id -> list of metrics
        
        self._seed_database()

    def _seed_database(self):
        """
        Populates the in-memory database with realistic seed data for the 3 pilot countries:
        India (Jaipur), Brazil (Rio de Janeiro), South Africa (Cape Town)
        """
        # --- Seed Admin Units (Polygons or Points acting as Wards) ---
        self.admin_units = {
            "IN-JAIPUR-WARD1": {
                "admin_id": "IN-JAIPUR-WARD1",
                "country_code": "IN",
                "name": "Jaipur Ward 1 (Old City)",
                "admin_level": 3,
                "parent_id": "IN-JAIPUR",
                "geometry": {"type": "Polygon", "coordinates": [[[26.91, 75.81], [26.93, 75.81], [26.93, 75.83], [26.91, 75.83], [26.91, 75.81]]]}
            },
            "IN-JAIPUR-WARD2": {
                "admin_id": "IN-JAIPUR-WARD2",
                "country_code": "IN",
                "name": "Jaipur Ward 2 (Mansarovar)",
                "admin_level": 3,
                "parent_id": "IN-JAIPUR",
                "geometry": {"type": "Polygon", "coordinates": [[[26.85, 75.74], [26.88, 75.74], [26.88, 75.77], [26.85, 75.77], [26.85, 75.74]]]}
            },
            "BR-RIO-DIST1": {
                "admin_id": "BR-RIO-DIST1",
                "country_code": "BR",
                "name": "Rio Centro",
                "admin_level": 3,
                "parent_id": "BR-RIO",
                "geometry": {"type": "Polygon", "coordinates": [[[-22.91, -43.20], [-22.89, -43.20], [-22.89, -43.18], [-22.91, -43.18], [-22.91, -43.20]]]}
            },
            "BR-RIO-DIST2": {
                "admin_id": "BR-RIO-DIST2",
                "country_code": "BR",
                "name": "Rocinha",
                "admin_level": 3,
                "parent_id": "BR-RIO",
                "geometry": {"type": "Polygon", "coordinates": [[[-22.99, -43.26], [-22.97, -43.26], [-22.97, -43.24], [-22.99, -43.24], [-22.99, -43.26]]]}
            },
            "ZA-CT-WARD1": {
                "admin_id": "ZA-CT-WARD1",
                "country_code": "ZA",
                "name": "Cape Town Ward 115 (CBD)",
                "admin_level": 3,
                "parent_id": "ZA-CT",
                "geometry": {"type": "Polygon", "coordinates": [[[-33.93, 18.41], [-33.91, 18.41], [-33.91, 18.43], [-33.93, 18.43], [-33.93, 18.41]]]}
            },
            "ZA-CT-WARD2": {
                "admin_id": "ZA-CT-WARD2",
                "country_code": "ZA",
                "name": "Cape Town Ward 36 (Khayelitsha)",
                "admin_level": 3,
                "parent_id": "ZA-CT",
                "geometry": {"type": "Polygon", "coordinates": [[[-34.04, 18.66], [-34.02, 18.66], [-34.02, 18.69], [-34.04, 18.69], [-34.04, 18.66]]]}
            }
        }

        # --- Seed Demographic Features ---
        self.demographic_features = {
            "IN-JAIPUR-WARD1": {"population": 65000, "vulnerability_index": 78.5},
            "IN-JAIPUR-WARD2": {"population": 120000, "vulnerability_index": 35.0},
            "BR-RIO-DIST1": {"population": 45000, "vulnerability_index": 42.0},
            "BR-RIO-DIST2": {"population": 100000, "vulnerability_index": 92.1}, # High vulnerability
            "ZA-CT-WARD1": {"population": 38000, "vulnerability_index": 22.4},
            "ZA-CT-WARD2": {"population": 85000, "vulnerability_index": 87.8}  # High vulnerability
        }

        # --- Seed Infrastructure Gap Indices (Normalized 0-100 where 100 is maximum gap/unmet need) ---
        self.infrastructure_indices = {
            "IN-JAIPUR-WARD1": {"water": 65.0, "sanitation": 70.0, "roads": 45.0, "drainage": 80.0, "electricity": 30.0},
            "IN-JAIPUR-WARD2": {"water": 15.0, "sanitation": 20.0, "roads": 25.0, "drainage": 30.0, "electricity": 10.0},
            "BR-RIO-DIST1": {"water": 10.0, "sanitation": 15.0, "roads": 20.0, "drainage": 40.0, "electricity": 15.0},
            "BR-RIO-DIST2": {"water": 85.0, "sanitation": 90.0, "roads": 75.0, "drainage": 85.0, "electricity": 50.0},
            "ZA-CT-WARD1": {"water": 5.0, "sanitation": 8.0, "roads": 12.0, "drainage": 15.0, "electricity": 5.0},
            "ZA-CT-WARD2": {"water": 80.0, "sanitation": 85.0, "roads": 60.0, "drainage": 70.0, "electricity": 65.0}
        }

        # --- Seed Planned/Active Public Investment Projects ---
        self.investment_projects = {
            "PROJ-IN-001": {
                "project_id": "PROJ-IN-001",
                "country": "IN",
                "geography": "IN-JAIPUR-WARD1",
                "sector": "drainage",
                "title": "Old City Main Drain Desilting",
                "status": "planned",
                "budget_value": 4500000,
                "currency": "INR",
                "start_date": "2026-09-01",
                "end_date": "2026-12-31",
                "source_page": "Jaipur Municipal Corp Annual Budget 2026, Page 12",
                "source_id": "SRC-JMC-2026"
            },
            "PROJ-ZA-001": {
                "project_id": "PROJ-ZA-001",
                "country": "ZA",
                "geography": "ZA-CT-WARD2",
                "sector": "water",
                "title": "Khayelitsha Water Main Rehabilitation Phase 1",
                "status": "active",
                "budget_value": 8500000,
                "currency": "ZAR",
                "start_date": "2026-04-01",
                "end_date": "2026-11-30",
                "source_page": "City of Cape Town Capital Plan, Page 84",
                "source_id": "SRC-CCT-2026"
            }
        }

        # --- Seed Request Examples ---
        # We start with some pre-loaded citizen requests that form initial hotspots
        seed_requests = [
            # India Water / Drainage Hotspot (Ward 1)
            {
                "request_id": "REQ-IN-001",
                "tenant_country": "IN",
                "channel": "voice",
                "created_at": datetime.datetime.now() - datetime.timedelta(days=12),
                "language": "hi",
                "consent_version": "1.0",
                "media_uri": "gs://civicbridge-media/IN/audio_001.wav",
                "location": {"lat": 26.921, "lon": 75.822},
                "admin_id": "IN-JAIPUR-WARD1",
                "processing_status": "completed",
                "transcript": "हमारे यहाँ पुरानी बस्ती में नालियां जाम हैं और बारिश का पानी सड़कों पर भर रहा है। पीने का पानी भी गंदा आ रहा है।",
                "translation": "The drains are blocked in our Old City (Purani Basti) area and rainwater is overflowing onto the streets. The drinking water is also dirty."
            },
            {
                "request_id": "REQ-IN-002",
                "tenant_country": "IN",
                "channel": "text",
                "created_at": datetime.datetime.now() - datetime.timedelta(days=8),
                "language": "en",
                "consent_version": "1.0",
                "media_uri": None,
                "location": {"lat": 26.924, "lon": 75.825},
                "admin_id": "IN-JAIPUR-WARD1",
                "processing_status": "completed",
                "transcript": "Severe blockage in secondary sewage drains near the market. Water is leaking into basement shops.",
                "translation": "Severe blockage in secondary sewage drains near the market. Water is leaking into basement shops."
            },
            {
                "request_id": "REQ-IN-003",
                "tenant_country": "IN",
                "channel": "voice",
                "created_at": datetime.datetime.now() - datetime.timedelta(days=5),
                "language": "hi",
                "consent_version": "1.0",
                "media_uri": "gs://civicbridge-media/IN/audio_003.wav",
                "location": {"lat": 26.918, "lon": 75.819},
                "admin_id": "IN-JAIPUR-WARD1",
                "processing_status": "completed",
                "transcript": "गली नंबर ४ में सीवर लाइन फूट गई है। बदबू आ रही है और बच्चों का बाहर निकलना मुश्किल हो गया है।",
                "translation": "Sewer line has burst in Street Number 4. It smells bad and it is difficult for children to go outside."
            },

            # Brazil Water Hotspot (Rocinha)
            {
                "request_id": "REQ-BR-001",
                "tenant_country": "BR",
                "channel": "voice",
                "created_at": datetime.datetime.now() - datetime.timedelta(days=15),
                "language": "pt",
                "consent_version": "1.0",
                "media_uri": "gs://civicbridge-media/BR/audio_001.wav",
                "location": {"lat": -22.982, "lon": -43.251},
                "admin_id": "BR-RIO-DIST2",
                "processing_status": "completed",
                "transcript": "Estamos sem água encanada há quase duas semanas aqui na parte alta da Rocinha. A bomba está quebrada.",
                "translation": "We have been without piped water for almost two weeks here in the upper part of Rocinha. The pump is broken."
            },
            {
                "request_id": "REQ-BR-002",
                "tenant_country": "BR",
                "channel": "text",
                "created_at": datetime.datetime.now() - datetime.timedelta(days=6),
                "language": "pt",
                "consent_version": "1.0",
                "media_uri": None,
                "location": {"lat": -22.979, "lon": -43.249},
                "admin_id": "BR-RIO-DIST2",
                "processing_status": "completed",
                "transcript": "Vazamento enorme de esgoto na descida da comunidade, água suja escorrendo na calçada.",
                "translation": "Huge sewage leak coming down from the community, dirty water running on the sidewalk."
            }
        ]

        for req in seed_requests:
            req_id = req["request_id"]
            self.requests[req_id] = req
            
            # Create AI labels matching seed
            is_in = req_id.startswith("REQ-IN")
            cat = "drainage" if is_in and "drain" in req["translation"].lower() or "sewer" in req["translation"].lower() else "water"
            
            self.request_ai_labels[req_id] = {
                "request_id": req_id,
                "model_name": "gemini-1.5-flash",
                "prompt_version": "1.0",
                "category": cat,
                "subcategory": "clogged_drain" if cat == "drainage" else "no_supply",
                "summary": req["translation"][:60] + "...",
                "problem_description": req["translation"],
                "requested_outcome": "Fix drain blockage" if cat == "drainage" else "Restore water supply",
                "urgency": "critical" if "burst" in req["translation"].lower() or "two weeks" in req["translation"].lower() else "high",
                "location_mentions": ["Purani Basti"] if is_in else ["Rocinha"],
                "evidence_types": [req["channel"]],
                "affected_scope": "street" if is_in else "community",
                "pii_flags": ["none"],
                "confidence": 0.94,
                "needs_human_review": False,
                "review_reason": None,
                "raw_schema_version": "1.0"
            }

        # Initialize clusters for seed requests
        self._rebuild_hotspots()

    def _rebuild_hotspots(self):
        """
        Performs spatial and category-wise aggregation to build issue clusters and active hotspots.
        """
        self.issue_clusters.clear()
        self.cluster_members.clear()
        self.hotspots_daily.clear()
        
        # Simple clustering: group requests in the same Admin ID and Category
        groups: Dict[str, List[str]] = {} # "admin_id:category" -> list of request_ids
        
        for req_id, req in self.requests.items():
            ai = self.request_ai_labels.get(req_id)
            if not ai or req["processing_status"] != "completed":
                continue
            
            key = f"{req['admin_id']}:{ai['category']}"
            if key not in groups:
                groups[key] = []
            groups[key].append(req_id)

        for key, members in groups.items():
            admin_id, category = key.split(":")
            cluster_id = f"CLUST-{admin_id[:6]}-{category[:4]}-{uuid.uuid4().hex[:4]}".upper()
            
            # Assemble cluster
            rep_req = self.requests[members[0]]
            rep_ai = self.request_ai_labels[members[0]]
            
            self.issue_clusters[cluster_id] = {
                "cluster_id": cluster_id,
                "sector": category,
                "canonical_summary": f"Multiple requests regarding {category} issues in {self.admin_units[admin_id]['name']}",
                "geography_id": admin_id,
                "first_seen": min(self.requests[m]["created_at"] for m in members),
                "last_seen": max(self.requests[m]["created_at"] for m in members),
                "corroboration_count": len(members),
                "duplicate_method": "deterministic_spatial"
            }
            
            for m in members:
                self.cluster_members.append({
                    "cluster_id": cluster_id,
                    "request_id": m,
                    "similarity": 0.92,
                    "distance_m": 120.0,
                    "match_reason": "spatial_category_overlap"
                })

            # Calculate hotspot indicators
            # 1. DemandRate: Unique reports per 100k + persistence
            pop = self.demographic_features[admin_id]["population"]
            raw_rate = (len(members) / pop) * 100000
            demand_rate = min(100.0, raw_rate * 5) # Scale for demo visibility
            
            # 2. InfrastructureGap: Join indicator
            infra_gap = self.infrastructure_indices[admin_id].get(category, 50.0)
            
            # 3. Severity: Based on highest urgency
            urgency_map = {"low": 20.0, "medium": 50.0, "high": 80.0, "critical": 100.0}
            severity = max(urgency_map.get(self.request_ai_labels[m]["urgency"], 50.0) for m in members)
            
            # 4. EquityAndVulnerability: Area level indicator
            equity_vuln = self.demographic_features[admin_id]["vulnerability_index"]
            
            # 5. AffectedPopulation: log scale representation of population
            affected_pop = min(100.0, math.log10(pop) * 20.0)
            
            # 6. RecentTrend: change rate (simplified for demo)
            recent_trend = 65.0
            
            # 7. EvidenceConfidence: standard average confidence
            evidence_conf = sum(self.request_ai_labels[m]["confidence"] for m in members) / len(members) * 100.0

            # Import packages/scoring to compute score
            from packages.scoring.priority import calculate_need_score
            need_res = calculate_need_score(
                demand_rate=demand_rate,
                infrastructure_gap=infra_gap,
                severity=severity,
                equity_vulnerability=equity_vuln,
                affected_population=affected_pop,
                recent_trend=recent_trend,
                evidence_confidence=evidence_conf
            )
            
            # Compute action score (incorporates strategic alignment, delivery readiness, and coverage penalty)
            # Find if there's any active project in the same area & sector
            overlap_project = None
            for p_id, p in self.investment_projects.items():
                if p["geography"] == admin_id and p["sector"] == category and p["status"] in ["active", "planned"]:
                    overlap_project = p_id
                    break
            
            coverage_penalty = 35.0 if overlap_project else 0.0
            from packages.scoring.priority import calculate_action_score
            action_res = calculate_action_score(
                need_score=need_res["score"],
                strategic_alignment=75.0, # Default for demo
                delivery_readiness=80.0,  # Default for demo
                data_confidence=evidence_conf,
                existing_coverage_penalty=coverage_penalty
            )

            self.hotspots_daily[cluster_id] = {
                "hotspot_id": cluster_id,
                "date": datetime.datetime.now().strftime("%Y-%m-%d"),
                "geography_id": admin_id,
                "sector": category,
                "request_rate": len(members),
                "trend": "increasing",
                "service_gap": infra_gap,
                "vulnerability": equity_vuln,
                "evidence_confidence": evidence_conf / 100.0,
                "need_score": need_res["score"],
                "action_score": action_res["score"],
                "need_components": need_res["components"],
                "action_components": action_res["components"],
                "overlap_project_id": overlap_project
            }

    # --- API Helper methods ---
    
    def add_citizen_request(self, tenant_country: str, channel: str, language: str, text: Optional[str] = None, media_uri: Optional[str] = None, location: Optional[Dict[str, float]] = None) -> str:
        """
        Creates a new raw request and triggers background-like processing.
        """
        req_id = f"REQ-{tenant_country}-{uuid.uuid4().hex[:6]}".upper()
        
        # Match administrative unit by location coordinates (simple bounding box match)
        admin_id = "IN-JAIPUR-WARD1" # Fallback
        if location and location.get("lat") is not None:
            lat, lon = location["lat"], location["lon"]
            for a_id, a in self.admin_units.items():
                if a["country_code"] == tenant_country:
                    poly = a["geometry"]["coordinates"][0]
                    # Simple bounding box check
                    lats = [pt[0] for pt in poly]
                    lons = [pt[1] for pt in poly]
                    if min(lats) <= lat <= max(lats) and min(lons) <= lon <= max(lons):
                        admin_id = a_id
                        break
        else:
            # Fallback by country
            if tenant_country == "BR":
                admin_id = "BR-RIO-DIST2"
            elif tenant_country == "ZA":
                admin_id = "ZA-CT-WARD2"

        self.requests[req_id] = {
            "request_id": req_id,
            "tenant_country": tenant_country,
            "channel": channel,
            "created_at": datetime.datetime.now(),
            "language": language,
            "consent_version": "1.0",
            "media_uri": media_uri,
            "location": location or {"lat": 26.920, "lon": 75.820},
            "admin_id": admin_id,
            "processing_status": "pending",
            "transcript": text or "",
            "translation": text or ""
        }
        return req_id

    def complete_request_processing(self, request_id: str, transcript: str, translation: str, ai_label: Dict[str, Any]):
        """
        Simulates completion of async worker processing.
        """
        if request_id in self.requests:
            self.requests[request_id]["transcript"] = transcript
            self.requests[request_id]["translation"] = translation
            self.requests[request_id]["processing_status"] = "completed"
            
            # Save AI labels
            self.request_ai_labels[request_id] = {
                "request_id": request_id,
                "model_name": ai_label.get("model_name", "gemini-1.5-flash"),
                "prompt_version": ai_label.get("prompt_version", "1.0"),
                "category": ai_label.get("category", "other"),
                "subcategory": ai_label.get("subcategory", "other"),
                "summary": ai_label.get("summary", ""),
                "problem_description": ai_label.get("problem_description", ""),
                "requested_outcome": ai_label.get("requested_outcome", ""),
                "urgency": ai_label.get("urgency", "medium"),
                "location_mentions": ai_label.get("location_mentions", []),
                "evidence_types": ai_label.get("evidence_types", ["text"]),
                "affected_scope": ai_label.get("affected_scope", "unknown"),
                "pii_flags": ai_label.get("pii_flags", ["none"]),
                "confidence": ai_label.get("confidence", 0.90),
                "needs_human_review": ai_label.get("needs_human_review", False),
                "review_reason": ai_label.get("review_reason", None),
                "raw_schema_version": "1.0"
            }
            
            # Rebuild hotspots to incorporate the new record
            self._rebuild_hotspots()

    def get_hotspot_geojson(self, country: Optional[str] = None) -> Dict[str, Any]:
        """
        Builds a privacy-safe GeoJSON feature collection of hot spots.
        """
        features = []
        for h_id, h in self.hotspots_daily.items():
            admin_id = h["geography_id"]
            admin = self.admin_units[admin_id]
            
            if country and admin["country_code"] != country:
                continue
                
            # Privacy threshold check: suppress if few reports
            if h["request_rate"] < 1: # Let it show even for 1 in the prototype, but check threshold in config
                continue
                
            # Add GeoJSON feature
            features.append({
                "type": "Feature",
                "id": h_id,
                "properties": {
                    "hotspot_id": h_id,
                    "admin_id": admin_id,
                    "admin_name": admin["name"],
                    "country_code": admin["country_code"],
                    "sector": h["sector"],
                    "request_rate": h["request_rate"],
                    "need_score": h["need_score"],
                    "action_score": h["action_score"],
                    "service_gap": h["service_gap"],
                    "vulnerability": h["vulnerability"]
                },
                "geometry": admin["geometry"]
            })
            
        return {
            "type": "FeatureCollection",
            "features": features
        }

# Global DB instance
db = CivicBridgeDatabase()
