#!/usr/bin/env bash
set -e

echo "Launching CivicBridge AI Normalization Service (Shreyank) on port 8001..."

export PYTHONPATH=$(pwd)
source .venv/bin/activate 2>/dev/null || true

pip install -q -r services/ai_normalization/requirements.txt
uvicorn services.ai_normalization.main:app --host 127.0.0.1 --port "${AI_NORMALIZATION_PORT:-8001}" --reload
