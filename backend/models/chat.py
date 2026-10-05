from datetime import datetime
from typing import Literal, Optional
from pydantic import BaseModel, Field


class Message(BaseModel):
    role: Literal["user", "assistant"]
    content: str
    ts: datetime = Field(default_factory=datetime.utcnow)


class ChatRequest(BaseModel):
    question: str
    documentId: Optional[str] = None
    language: Literal["hindi", "english"] = "hindi"
    state: Optional[str] = None  # Jurisdiction state key (e.g., "maharashtra")


class ChatResponse(BaseModel):
    answer: str
    language: str
