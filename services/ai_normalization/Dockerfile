# Build from the REPO ROOT (this service imports the shared `packages/` package
# and is addressed as `services.ai_normalization.*`), e.g.:
#   docker build -f services/ai_normalization/Dockerfile -t civicbridge-ai-normalization .
#   docker run -p 8001:8001 -e USE_MOCK_SERVICES=true civicbridge-ai-normalization
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PYTHONPATH=/app \
    USE_MOCK_SERVICES=true \
    AI_NORMALIZATION_PORT=8001

WORKDIR /app

COPY services/ai_normalization/requirements.txt ./services/ai_normalization/requirements.txt
RUN pip install --no-cache-dir -r services/ai_normalization/requirements.txt

# Shared contracts/schemas/event-bus/country-packs this service depends on, plus its own code.
COPY packages ./packages
COPY services/ai_normalization ./services/ai_normalization

RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8001
CMD ["uvicorn", "services.ai_normalization.main:app", "--host", "0.0.0.0", "--port", "8001"]
