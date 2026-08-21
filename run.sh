#!/usr/bin/env bash
set -e

echo "🚀 Launching CivicBridge AI Policy + Impact Service (Sharmad)..."

export PYTHONPATH=$(pwd)
source .venv/bin/activate 2>/dev/null || true

python scripts/seed_demo_data.py
uvicorn services.policy_impact.app.main:app --host 127.0.0.1 --port 8000 --reload
