from pydantic import BaseModel
from typing import Optional, List, Dict, Any


class SalesStrategyResponse(BaseModel):
    id: int
    status: str
    account_strategic_overview: Optional[str]
    priority_initiatives: List[Dict[str, Any]]
    financial_positioning: Optional[str]
    technical_enablement_summary: Optional[str]
    objection_handling: List[Dict[str, Any]]
    executive_conversation_version: Optional[str]
    email_version: Optional[str]