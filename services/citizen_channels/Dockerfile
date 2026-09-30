FROM python:3.12-slim
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg && rm -rf /var/lib/apt/lists/*
COPY services/citizen_channels/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir -r /tmp/requirements.txt
COPY packages ./packages
COPY services/citizen_channels ./services/citizen_channels
CMD ["sh", "-c", "uvicorn services.citizen_channels.main:app --host 0.0.0.0 --port ${PORT:-8080}"]
