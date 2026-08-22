import os
import sys
import uuid
import json
import datetime
from typing import Dict, Any, List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# Ensure packages path is importable
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(os.path.dirname(current_dir))
if project_root not in sys.path:
    sys.path.append(project_root)

from services.api.db import db
from services.worker.pipeline import ai_pipeline
from packages.country_packs import COUNTRY_PACKS
from packages.schemas import CitizenRequestAIResponse, ProjectRecommendationAIResponse

app = FastAPI(
    title="CivicBridge AI API",
    description="Digital Public Infrastructure feedback & policy recommendation backend.",
    version="1.0.0"
)

# Enable CORS for frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Request Bodies ---

class TextRequestPayload(BaseModel):
    country_code: str = Field(..., description="IN, BR, or ZA")
    channel: str = Field(..., description="text or voice")
    language: str = Field(..., description="en, hi, pt, etc.")
    text: str = Field(..., description="Raw text request from the citizen")
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class CorrectionItem(BaseModel):
    field: str
    old_value: Any
    new_value: Any
    reason: str

class CorrectionPayload(BaseModel):
    actor_role: str = "analyst"
    corrections: List[CorrectionItem]

class ReviewPayload(BaseModel):
    action: str = Field(..., description="approve, merge, split, mark_unusable")
    merge_with_request_id: Optional[str] = None
    corrections: Optional[Dict[str, Any]] = None
    reason: str

class DecisionPayload(BaseModel):
    action: str = Field(..., description="approve, defer, reject")
    reason: str
    actor: str

class ImpactUpdatePayload(BaseModel):
    metric_code: str
    current_value: float
    notes: Optional[str] = None

# --- Background Worker Simulator ---

def process_request_in_background(request_id: str, is_audio: bool, file_content: Optional[bytes] = None, text_content: Optional[str] = None):
    """
    Simulates asynchronous worker pipeline processing:
    1. Speech-to-Text translation (if audio).
    2. Document Translation to English.
    3. Gemini Structured Field Extraction.
    """
    try:
        req = db.requests.get(request_id)
        if not req:
            return
            
        lang = req["language"]
        country = req["tenant_country"]
        
        # 1. Transcribe (if audio)
        if is_audio and file_content:
            transcript = ai_pipeline.transcribe_audio(file_content, lang)
        else:
            transcript = text_content or ""
            
        # 2. Translate to English
        translation = ai_pipeline.translate_text(transcript, lang, "en")
        
        # 3. Structured Extraction via Gemini
        ai_labels = ai_pipeline.extract_structured_fields(translation, country)
        
        # Complete record updates and rebuild hotspots
        db.complete_request_processing(request_id, transcript, translation, ai_labels)
        
    except Exception as e:
        print(f"Background worker failed to process request {request_id}: {e}")
        if request_id in db.requests:
            db.requests[request_id]["processing_status"] = "failed"

# --- Endpoints ---

@app.get("/version")
def get_version():
    """Liveness probe & version details."""
    return {
        "status": "healthy",
        "service": "CivicBridge AI Backend",
        "version": "1.0.0",
        "environment": os.getenv("ENVIRONMENT", "development")
    }

# 1. POST /v1/requests - Create request (Supports JSON text or Form audio upload)
@app.post("/v1/requests")
async def create_request(
    background_tasks: BackgroundTasks,
    country_code: Optional[str] = Form(None),
    channel: Optional[str] = Form(None),
    language: Optional[str] = Form(None),
    text: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    file: Optional[UploadFile] = File(None)
):
    """
    Submits a request from the citizen channel. Supports voice audio recording or text submission.
    """
    # Accept fallback values from query or default text payloads
    if not country_code:
        raise HTTPException(status_code=400, detail="Missing country_code field")
        
    country_code = country_code.upper()
    if country_code not in COUNTRY_PACKS:
        raise HTTPException(status_code=400, detail=f"Unsupported country code: {country_code}")

    loc = None
    if latitude is not None and longitude is not None:
        loc = {"lat": latitude, "lon": longitude}

    # Add raw request entry in database
    media_uri = None
    is_audio = False
    file_bytes = None
    
    if file:
        is_audio = True
        file_bytes = await file.read()
        media_uri = f"gs://civicbridge-media/{country_code}/{uuid.uuid4().hex}.wav"
        channel = channel or "voice"
    else:
        channel = channel or "text"

    # Store request
    req_id = db.add_citizen_request(
        tenant_country=country_code,
        channel=channel,
        language=language or "en",
        text=text or "",
        media_uri=media_uri,
        location=loc
    )
    
    # Process asynchronously to ensure sub-second response
    background_tasks.add_task(
        process_request_in_background,
        request_id=req_id,
        is_audio=is_audio,
        file_content=file_bytes,
        text_content=text
    )
    
    return {
        "request_id": req_id,
        "status": "pending",
        "message": "Citizen request received successfully. Processing has started."
    }

# 2. GET /v1/requests/{id} - Citizen safe status
@app.get("/v1/requests/{id}")
def get_request_status(id: str):
    """
    Returns citizen-safe public status check page. Masks coordinates and personal info.
    """
    req = db.requests.get(id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    ai = db.request_ai_labels.get(id, {})
    
    return {
        "request_id": req["request_id"],
        "status": req["processing_status"],
        "created_at": req["created_at"],
        "channel": req["channel"],
        "category": ai.get("category", "other"),
        "summary": ai.get("summary", "Summarizing request..."),
        "urgency": ai.get("urgency", "medium"),
        "pii_masked": True
    }

# 3. POST /v1/requests/{id}/corrections - Submit citizen/analyst correction
@app.post("/v1/requests/{id}/corrections")
def submit_request_corrections(id: str, payload: CorrectionPayload):
    """
    Allows a citizen or analyst to correct AI-predicted tags/fields.
    """
    req = db.requests.get(id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    ai = db.request_ai_labels.get(id)
    if not ai:
        raise HTTPException(status_code=400, detail="AI processing is not completed for this request")
        
    # Log corrections
    for corr in payload.corrections:
        db.request_corrections.append({
            "request_id": id,
            "field": corr.field,
            "old_value": corr.old_value,
            "new_value": corr.new_value,
            "actor_role": payload.actor_role,
            "reason": corr.reason,
            "corrected_at": datetime.datetime.now()
        })
        
        # Apply change to labels
        if corr.field in ai:
            ai[corr.field] = corr.new_value
            
    # Rebuild hotspots as classifications changed
    db._rebuild_hotspots()
    
    return {"status": "success", "message": f"Applied {len(payload.corrections)} corrections."}

# 4. GET /v1/review-queue - Authorized analyst queue
@app.get("/v1/review-queue")
def get_review_queue():
    """
    Returns requests flagged by AI as needing human verification.
    """
    queue = []
    for req_id, req in db.requests.items():
        ai = db.request_ai_labels.get(req_id, {})
        if ai.get("needs_human_review") or req["processing_status"] == "failed":
            queue.append({
                "request_id": req_id,
                "tenant_country": req["tenant_country"],
                "created_at": req["created_at"],
                "language": req["language"],
                "transcript": req["transcript"],
                "translation": req["translation"],
                "ai_fields": ai,
                "reason": ai.get("review_reason", "AI extraction failure")
            })
    return queue

# 5. POST /v1/review/{id} - Analyst actions
@app.post("/v1/review/{id}")
def verify_request_review(id: str, payload: ReviewPayload):
    """
    Analyst actions: approves AI extraction, merges duplicates, or flags as unusable.
    """
    req = db.requests.get(id)
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
        
    if payload.action == "mark_unusable":
        req["processing_status"] = "unusable"
    elif payload.action == "approve":
        req["processing_status"] = "completed"
        # Apply field overrides if any
        if payload.corrections:
            ai = db.request_ai_labels.get(id)
            if ai:
                for k, v in payload.corrections.items():
                    ai[k] = v
    elif payload.action == "merge" and payload.merge_with_request_id:
        req["processing_status"] = "merged"
        # Log merge details
        db.cluster_members.append({
            "cluster_id": payload.merge_with_request_id,
            "request_id": id,
            "similarity": 1.0,
            "distance_m": 0.0,
            "match_reason": f"manual_merge: {payload.reason}"
        })
        
    db._rebuild_hotspots()
    return {"status": "success", "message": f"Review action '{payload.action}' completed."}

# 6. GET /v1/hotspots - Aggregated GeoJSON hotspots
@app.get("/v1/hotspots")
def get_hotspots(country: Optional[str] = None):
    """
    Returns GeoJSON feature collection of active demand hotspots.
    """
    return db.get_hotspot_geojson(country)

# 7. GET /v1/hotspots/{id} - Score breakdown
@app.get("/v1/hotspots/{id}")
def get_hotspot_details(id: str):
    """
    Returns details, evidence bundle, and score breakdowns for a hotspot.
    """
    hotspot = db.hotspots_daily.get(id)
    if not hotspot:
        raise HTTPException(status_code=404, detail="Hotspot not found")
        
    # Gather evidence requests
    member_ids = [m["request_id"] for m in db.cluster_members if m["cluster_id"] == id]
    evidence_requests = []
    for m_id in member_ids:
        r = db.requests.get(m_id)
        a = db.request_ai_labels.get(m_id)
        if r and a:
            evidence_requests.append({
                "request_id": m_id,
                "summary": a["summary"],
                "translation": r["translation"],
                "urgency": a["urgency"],
                "created_at": r["created_at"]
            })
            
    # Include overlap project info
    overlap_proj = None
    if hotspot["overlap_project_id"]:
        overlap_proj = db.investment_projects.get(hotspot["overlap_project_id"])

    return {
        "hotspot_id": id,
        "geography_id": hotspot["geography_id"],
        "sector": hotspot["sector"],
        "need_score": hotspot["need_score"],
        "need_formula": "0.25*DemandRate + 0.20*Gap + 0.15*Severity + 0.15*Vuln + 0.10*Pop + 0.10*Trend + 0.05*EvidenceConf",
        "need_components": hotspot["need_components"],
        "action_score": hotspot["action_score"],
        "action_components": hotspot["action_components"],
        "evidence_count": len(evidence_requests),
        "evidence": evidence_requests,
        "overlap_project": overlap_proj
    }

# 8. POST /v1/hotspots/{id}/recommendations - Generate project brief
@app.post("/v1/hotspots/{id}/recommendations")
def generate_recommendation(id: str):
    """
    Uses Gemini to generate an evidence-backed project recommendation brief for a hotspot.
    """
    hotspot = db.hotspots_daily.get(id)
    if not hotspot:
        raise HTTPException(status_code=404, detail="Hotspot not found")
        
    admin = db.admin_units[hotspot["geography_id"]]
    vuln = db.demographic_features[hotspot["geography_id"]]["vulnerability_index"]
    pop = db.demographic_features[hotspot["geography_id"]]["population"]
    
    # Build bundle
    member_ids = [m["request_id"] for m in db.cluster_members if m["cluster_id"] == id]
    summaries = []
    for m_id in member_ids:
        ai = db.request_ai_labels.get(m_id)
        if ai:
            summaries.append(ai["summary"])
            
    evidence_bundle = {
        "hotspot_id": id,
        "admin_name": admin["name"],
        "country": admin["country_code"],
        "sector": hotspot["sector"],
        "population": pop,
        "vulnerability": vuln,
        "request_count": len(member_ids),
        "source_ids": member_ids,
        "citizen_summaries": summaries
    }
    
    rec_json = ai_pipeline.generate_project_recommendation(id, evidence_bundle)
    
    # Save recommendation in DB
    rec_id = f"REC-{hotspot['sector'][:3]}-{uuid.uuid4().hex[:6]}".upper()
    db.recommendations[rec_id] = {
        "recommendation_id": rec_id,
        "hotspot_id": id,
        "evidence_bundle_hash": str(hash(json.dumps(evidence_bundle))),
        "model_version": "gemini-1.5-flash:v1",
        "brief": rec_json,
        "validation_status": "pending_approval",
        "created_at": datetime.datetime.now()
    }
    
    return {
        "recommendation_id": rec_id,
        "brief": rec_json
    }

# 9. POST /v1/recommendations/{id}/decisions - Approve project
@app.post("/v1/recommendations/{id}/decisions")
def submit_policy_decision(id: str, payload: DecisionPayload):
    """
    Allows a policymaker to Approve, Defer, or Reject a project recommendation.
    Approved projects enter the impact tracker.
    """
    rec = db.recommendations.get(id)
    if not rec:
        raise HTTPException(status_code=404, detail="Recommendation not found")
        
    decision_id = f"DEC-{uuid.uuid4().hex[:6]}".upper()
    
    # Log decision
    db.policy_decisions.append({
        "decision_id": decision_id,
        "recommendation_id": id,
        "action": payload.action,
        "reason": payload.reason,
        "actor": payload.actor,
        "timestamp": datetime.datetime.now(),
        "score_version": "1.0.0"
    })
    
    rec["validation_status"] = f"decision_{payload.action}"
    
    # If approved, bootstrap an active project & impact tracking
    project_id = None
    if payload.action == "approve":
        project_id = f"PROJ-{uuid.uuid4().hex[:6]}".upper()
        brief = rec["brief"]
        
        # Add to investment projects
        hotspot = db.hotspots_daily[rec["hotspot_id"]]
        admin = db.admin_units[hotspot["geography_id"]]
        
        db.investment_projects[project_id] = {
            "project_id": project_id,
            "country": admin["country_code"],
            "geography": hotspot["geography_id"],
            "sector": hotspot["sector"],
            "title": brief.get("project_title", "New Approved Infrastructure Project"),
            "status": "approved",
            "budget_value": 0.0, # Will be set by program manager
            "currency": COUNTRY_PACKS[admin["country_code"]]["currency"]["code"],
            "start_date": datetime.datetime.now().strftime("%Y-%m-%d"),
            "end_date": (datetime.datetime.now() + datetime.timedelta(days=180)).strftime("%Y-%m-%d"),
            "source_page": "CivicBridge AI Decision Console",
            "source_id": decision_id
        }
        
        # Bootstrap default impact metrics
        metric_items = []
        for met in brief.get("success_metrics", []):
            metric_items.append({
                "metric_code": met.get("metric", "kpi_progress"),
                "baseline": 10.0, # Demo baseline
                "target": 100.0,  # Demo target
                "current": 10.0,
                "unit": "%",
                "measured_at": datetime.datetime.now(),
                "source_id": met.get("baseline_source_id", "initial"),
                "confidence": 0.95
            })
        db.impact_metrics[project_id] = metric_items
        
    return {
        "status": "success",
        "action": payload.action,
        "project_id": project_id,
        "message": f"Recommendation has been successfully {payload.action}d."
    }

# 10. GET /v1/projects/{id}/impact - Get impact details
@app.get("/v1/projects/{id}/impact")
def get_project_impact(id: str):
    """
    Returns baseline-to-target details of an approved project.
    """
    proj = db.investment_projects.get(id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
        
    metrics = db.impact_metrics.get(id, [])
    return {
        "project_id": id,
        "title": proj["title"],
        "sector": proj["sector"],
        "status": proj["status"],
        "metrics": metrics
    }

# 11. POST /v1/projects/{id}/impact - Update project impact metric
@app.post("/v1/projects/{id}/impact")
def update_project_impact(id: str, payload: ImpactUpdatePayload):
    """
    Updates the current value of a project metric.
    """
    proj = db.investment_projects.get(id)
    if not proj:
        raise HTTPException(status_code=404, detail="Project not found")
        
    metrics = db.impact_metrics.get(id)
    if not metrics:
        raise HTTPException(status_code=400, detail="No metrics set up for this project")
        
    # Find and update metric
    updated = False
    for met in metrics:
        if met["metric_code"] == payload.metric_code:
            met["current"] = payload.current_value
            met["measured_at"] = datetime.datetime.now()
            updated = True
            break
            
    if not updated:
        # Create a new one
        metrics.append({
            "metric_code": payload.metric_code,
            "baseline": 0.0,
            "target": 100.0,
            "current": payload.current_value,
            "unit": "value",
            "measured_at": datetime.datetime.now(),
            "source_id": "manual_update",
            "confidence": 1.0
        })
        
    return {"status": "success", "message": "Project impact metric updated successfully."}

# 12. GET /v1/countries/{code}/config - Get country specific configuration
@app.get("/v1/countries/{code}/config")
def get_country_config(code: str):
    """
    Returns country configuration package.
    """
    code = code.upper()
    config = COUNTRY_PACKS.get(code)
    if not config:
        raise HTTPException(status_code=404, detail="Country configuration not found")
    return config
