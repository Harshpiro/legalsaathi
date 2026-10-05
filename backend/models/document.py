from datetime import datetime
from enum import Enum
from pydantic import BaseModel, Field


class DocType(str, Enum):
    rent = "rent"
    fir = "fir"
    notice = "notice"
    employment = "employment"
    other = "other"


class Severity(str, Enum):
    high = "high"
    medium = "medium"
    low = "low"


class RiskItem(BaseModel):
    clause: str
    reason: str
    severity: Severity = Severity.medium


class DocumentOut(BaseModel):
    id: str = Field(..., alias="_id")
    userId: str
    fileName: str
    fileUrl: str
    fileType: str = ""
    summary: str = ""
    risks: list[RiskItem] = []
    docType: DocType = DocType.other
    status: str = "processing"
    createdAt: datetime = Field(default_factory=datetime.utcnow)

    class Config:
        populate_by_name = True
