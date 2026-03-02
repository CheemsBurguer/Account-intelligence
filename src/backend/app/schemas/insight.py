from pydantic import BaseModel
from typing import Optional, List

class InsightBase(BaseModel):
    title: str
    description: Optional[str]
    category: Optional[str]
    severity: Optional[str]
    source_url: Optional[str]
    source_snippet: Optional[str]

class InsightCreate(InsightBase):
    analysis_id: int

class InsightUpdate(BaseModel):
    title: Optional[str]
    description: Optional[str]
    category: Optional[str]
    severity: Optional[str]
    source_url: Optional[str]
    source_snippet: Optional[str]


class ImpactTagSchema(BaseModel):
    label: str
    tone: str  # "critica", "alta", "media", "baja"

class FactorSchema(BaseModel):
    label: str
    level: str  # "ALTA", "MEDIA", "BAJA"

class InsightResponse(BaseModel):
    id: str
    category: str
    title: str
    quote: Optional[str] = None
    opportunityTitle: str
    opportunityBody: str
    propensityValue: float
    impactTag: Optional[ImpactTagSchema] = None
    detectedAt: Optional[str] = None
    factors: List[FactorSchema] = []


# Simple schema that maps directly to the Insight DB model.
# Used by get_full_analysis endpoint.
class InsightSimpleResponse(BaseModel):
    id: int
    title: str
    description: Optional[str] = None
    severity: Optional[str] = None
    category: Optional[str] = None


class InsightItem(BaseModel):
    title: str
    description: str
    category: str
    severity: str
    tech_intensity: int
    operational_complexity: int
    financial_pressure: int


class InsightOutput(BaseModel):
    insights: List[InsightItem]