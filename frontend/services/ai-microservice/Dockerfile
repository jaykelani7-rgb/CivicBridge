FROM python:3.11-slim AS base

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app/services/ai-microservice

COPY services/ai-microservice/requirements.txt /tmp/requirements.txt

RUN pip install -r /tmp/requirements.txt

COPY services/ai-microservice /app/services/ai-microservice

FROM base AS dev

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--reload"]

FROM base AS production

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
