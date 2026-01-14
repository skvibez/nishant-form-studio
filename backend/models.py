from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from datetime import datetime
from enum import Enum

class VersionStatus(str, Enum):
    DRAFT = "DRAFT"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"

class FieldType(str, Enum):
    TEXT = "TEXT"
    CHECKBOX = "CHECKBOX"
    IMAGE = "IMAGE"
    DATE = "DATE"
    SIGNATURE_ANCHOR = "SIGNATURE_ANCHOR"

class FieldRect(BaseModel):
    x: float
    y: float
    w: float
    h: float

class FieldStyle(BaseModel):
    fontFamily: str = "Helvetica"
    fontSize: int = 11
    alignment: str = "LEFT"
    color: str = "#000000"
    tickChar: Optional[str] = "✓"

class FieldValidation(BaseModel):
    required: bool = False
    regex: Optional[str] = None
    maxLen: Optional[int] = None
    charSpacing: Optional[float] = None

class FieldSchema(BaseModel):
    id: str
    key: str
    type: FieldType
    pageIndex: int
    rect: FieldRect
    style: FieldStyle = Field(default_factory=FieldStyle)
    validation: FieldValidation = Field(default_factory=FieldValidation)

class TemplateCreate(BaseModel):
    name: str
    key: str

class TemplateResponse(BaseModel):
    id: str
    name: str
    key: str
    active_version_id: Optional[str]
    created_at: datetime
    updated_at: datetime

class VersionCreate(BaseModel):
    template_id: str
    file_url: str
    dimensions: Dict[str, float]
    field_schema: List[FieldSchema] = Field(default_factory=list)

class VersionUpdate(BaseModel):
    field_schema: List[FieldSchema]
    status: Optional[VersionStatus] = None

class VersionResponse(BaseModel):
    id: str
    template_id: str
    version_number: int
    file_url: str
    dimensions: Dict[str, float]
    field_schema: List[FieldSchema]
    status: VersionStatus
    created_at: datetime

class GenerateRequest(BaseModel):
    template_key: str
    version: str = "latest"
    payload: Dict[str, Any]
    options: Optional[Dict[str, Any]] = Field(default_factory=lambda: {"flatten": True, "output": "base64"})

class GenerateResponse(BaseModel):
    pdf_data: Optional[str] = None
    url: Optional[str] = None
    submission_id: str