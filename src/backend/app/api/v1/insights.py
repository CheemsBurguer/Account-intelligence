from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional, List
from ...models.insight import Insight
from ...models.analysis import Analysis
from ...schemas.insight import InsightResponse
from ...dependencies.deps import get_db
from ...dependencies.deps_auth import get_current_user
from ...models.user import User

api_router = APIRouter()


from sqlalchemy.orm import selectinload

@api_router.get("/", response_model=List[InsightResponse])
async def list_user_insights(
    company_id: Optional[int] = Query(None),
    severity: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    query = (
        select(Insight)
        .join(Analysis)
        .options(selectinload(Insight.analysis))
        .where(Analysis.user_id == current_user.id)
    )

    if company_id:
        query = query.where(Analysis.company_id == company_id)

    if severity:
        query = query.where(Insight.severity == severity)

    result = await db.execute(query)
    insights = result.scalars().all()

    response = []
    for ins in insights:
        # Determine tone based on severity
        sev = ins.severity.lower()
        tone = "media"
        if sev == "critical": tone = "critica"
        elif sev == "high": tone = "alta"
        elif sev == "low": tone = "baja"

        # Construct impact tag
        impact_tag = {
            "label": ins.severity.upper(),
            "tone": tone
        }

        # Simulated factors based on breakdown or generic
        breakdown = ins.analysis.score_breakdown or {}
        factors = []
        if breakdown.get("tech_intensity"):
            factors.append({"label": "Tech Intensity", "level": "ALTA" if breakdown["tech_intensity"] > 7 else "MEDIA"})
        if breakdown.get("financial_pressure"):
            factors.append({"label": "Financial Pressure", "level": "ALTA" if breakdown["financial_pressure"] > 7 else "MEDIA"})

        response.append(
            InsightResponse(
                id=str(ins.id),
                category=ins.category or "General",
                title=ins.title,
                quote=f"Basado en señales detectadas en {ins.analysis.created_at.strftime('%Y-%m-%d')}.",
                opportunityTitle=ins.title,
                opportunityBody=ins.description,
                propensityValue=float(ins.analysis.propensity_score or 0),
                impactTag=impact_tag,
                detectedAt=ins.analysis.created_at.isoformat(),
                factors=factors
            )
        )

    return response