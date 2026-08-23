FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /service
COPY pyproject.toml README.md ./
COPY app ./app
COPY migrations ./migrations
COPY fixtures ./fixtures
RUN pip install --no-cache-dir '.[production]'
RUN mkdir -p /service/data && \
    python -m app.adapters.local.demo_database \
      --database-path /service/data/intelligence.db \
      --fixture-dir /service/fixtures
RUN useradd --create-home --uid 10001 appuser && chown -R appuser:appuser /service
USER appuser
EXPOSE 8080
CMD ["uvicorn","app.main:app","--host","0.0.0.0","--port","8080"]
