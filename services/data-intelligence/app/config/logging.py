from __future__ import annotations

import json
import logging
from datetime import datetime, timezone


class JsonFormatter(logging.Formatter):
    SAFE_FIELDS = ("trace_id","event_id","request_id","cluster_id","hotspot_id","processing_stage","duration_ms","result","error_code")

    def __init__(self, environment: str) -> None:
        super().__init__()
        self.environment = environment

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "timestamp": datetime.now(timezone.utc).isoformat().replace("+00:00","Z"),
            "service": "data-intelligence", "environment": self.environment,
            "level": record.levelname, "message": record.getMessage(),
        }
        payload.update({name:getattr(record,name) for name in self.SAFE_FIELDS if hasattr(record,name) and getattr(record,name) is not None})
        return json.dumps(payload,separators=(",",":"),default=str)


def configure_logging(level: str, environment: str) -> None:
    handler = logging.StreamHandler()
    handler.setFormatter(JsonFormatter(environment))
    root = logging.getLogger()
    root.handlers[:] = [handler]
    root.setLevel(level)
