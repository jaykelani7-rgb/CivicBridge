# CivicBridge AI
> From multilingual citizen voices to ranked, evidence-backed infrastructure projects.

CivicBridge AI is a digital public infrastructure and governance platform designed for BRICS nations. It takes citizen requests (via text or audio recordings in multiple languages), transcribes and translates them, normalizes and extracts structured information using Google's Gemini on Vertex AI, performs spatial clustering and deduplication, ranks hotspots using an explainable priority scoring framework, and helps policymakers generate and track data-aligned infrastructure project recommendations.

---

## Repository Structure

```
civicbridge/
├── apps/
│   └── web/                   # Next.js/React frontend application
├── services/
│   ├── api/                   # FastAPI backend service
│   └── worker/                # Background worker (transcription, translation, extraction)
├── packages/
│   ├── schemas/               # Shared Pydantic data schemas
│   ├── scoring/               # Deterministic priority scoring engine
│   └── country-packs/         # Configurable localized taxomonies, bounds, and weights
├── data/                      # Data storage and inputs
├── analytics/                 # BigQuery DDLs & analytics views
├── tests/                     # Unit and integration tests
└── docs/                      # Architecture, schemas, and demo guides
```

---

## Setup & Running Locally

### Backend Setup (FastAPI)

1. Navigate to the backend directory:
   ```bash
   cd services/api
   ```

2. Create a virtual environment and install dependencies:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   pip install -r requirements.txt
   ```

3. Configure your environment variables:
   Copy `.env.example` to `.env` in the root workspace folder and configure your Google Cloud project settings. By default, `USE_MOCK_SERVICES=true` is enabled, allowing you to test the API endpoints without configuring GCP billing or credentials.

4. Start the backend:
   ```bash
   uvicorn main:app --reload
   ```
   The API will be available at `http://localhost:8000`. You can view the interactive documentation at `http://localhost:8000/docs`.

---

## Core Flow
1. **Citizen Request**: A citizen submits voice/text. The backend transcribes (STT V2), translates (Translation Advanced), and extracts structured JSON (Gemini).
2. **Data Enrichment**: Resolves location coordinates, checks for duplicates, and assigns to administrative boundary polygons.
3. **Hotspot Analysis**: Computes daily priority scores for active clusters of requests.
4. **Policy & Action**: Generates Gemini-backed project briefs for top-priority hotspots. Policy makers approve or defer actions and track the long-term impact loop.
