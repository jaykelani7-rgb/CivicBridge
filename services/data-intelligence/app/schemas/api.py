from __future__ import annotations

from typing import Optional

from pydantic import BaseModel, Field

from .events import EventEnvelope, NormalizedRequest


class ProcessRequest(BaseModel):
    event: EventEnvelope[NormalizedRequest]


class RecalculateRequest(BaseModel):
    reason: str = Field(min_length=3, max_length=500)
    requested_score_version: str
    trace_id: str


class PageMeta(BaseModel):
    page: int
    page_size: int
    total: int
    pages: int


class HotspotPage(BaseModel):
    items: list[dict]
    pagination: PageMeta
