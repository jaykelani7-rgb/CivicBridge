from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class PubSubPushMessage(BaseModel):
    model_config = ConfigDict(extra="ignore", populate_by_name=True)

    data: str = Field(min_length=1)
    message_id: str = Field(alias="messageId", min_length=1)
    publish_time: Optional[datetime] = Field(default=None, alias="publishTime")
    attributes: dict[str, str] = Field(default_factory=dict)


class PubSubPushEnvelope(BaseModel):
    model_config = ConfigDict(extra="ignore")

    message: PubSubPushMessage
    subscription: str = Field(min_length=1)
