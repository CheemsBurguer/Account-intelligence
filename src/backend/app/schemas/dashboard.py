from pydantic import BaseModel


class ReasonSchema(BaseModel):
    level: str  # "critico", "alto", "medio", "bajo"
    text: str

class TopCompanyResponse(BaseModel):
    id: str
    name: str
    code: str
    industry: str
    location: str
    reason: ReasonSchema
    score: float


class DashboardSummaryResponse(BaseModel):
    prioritized_companies: int
    total_analyses: int
    opportunities_detected: int
    analyses_this_week: int