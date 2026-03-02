from pydantic import BaseModel, HttpUrl
from typing import Optional, List
from pydantic import BaseModel
from .insight import InsightSimpleResponse
from .recommendation import RecommendationResponse
from .sales_strategy import SalesStrategyResponse

class AnalysisCreate(BaseModel):
    company_name: str
    industry_id: int
    website_url: Optional[HttpUrl] = None


class AnalysisResponse(BaseModel):
    analysis_id: int
    status: str

class AnalysisStatusResponse(BaseModel):
    analysis_id: int
    company_id: int
    status: str
    strategic_score: Optional[float] = None
    propensity_score: Optional[float] = None


class AnalysisListItem(BaseModel):
    analysis_id: int
    company_id: int
    company_name: str
    status: str
    strategic_score: Optional[float] = None
    propensity_score: Optional[float] = None


class AnalysisFullResponse(BaseModel):
    analysis_id: int
    company_id: int
    company_name: str
    status: str
    strategic_score: Optional[float]
    propensity_score: Optional[float]
    insights: List[InsightSimpleResponse]
    recommendations: List[RecommendationResponse]
    sales_strategy: Optional[SalesStrategyResponse]


class AnalysisProgressResponse(BaseModel):
    analysis_id: int
    status: str
    progress_percentage: int