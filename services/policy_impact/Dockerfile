FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
COPY services/policy_impact/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY packages ./packages
COPY services/policy_impact ./services/policy_impact
CMD ["sh", "-c", "uvicorn services.policy_impact.app.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
