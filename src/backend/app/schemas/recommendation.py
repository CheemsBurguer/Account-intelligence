from pydantic import BaseModel

class RecommendationAccept(BaseModel):
    is_accepted: bool

class RecommendationResponse(BaseModel):
    id: int
    product_id: int
    product_name: str
    match_percentage: float
    confidence_score: float
    is_accepted: bool


class RecommendationUpdate(BaseModel):
    is_accepted: bool