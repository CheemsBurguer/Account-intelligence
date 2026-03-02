from datetime import datetime, timedelta, timezone
from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import func
from sqlalchemy.orm import joinedload
from ...dependencies.deps import get_db
from ...dependencies.deps_auth import get_current_user
from ...models.user import User
from ...models.analysis import Analysis
from ...models.company import Company
from ...models.recommendation import Recommendation
from ...models.insight import Insight
from ...schemas.dashboard import TopCompanyResponse, DashboardSummaryResponse, ReasonSchema
from ...services.ai.daily_prioritization_service import DailyPrioritizationService
from ...models.enums import AnalysisStatus
from typing import List

api_router = APIRouter()


@api_router.get("/top-accounts", response_model=List[TopCompanyResponse])
async def get_top_accounts(
    limit: int = 5,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    result = await db.execute(
        select(Analysis)
        .where(
            Analysis.status == AnalysisStatus.COMPLETED,
            Analysis.user_id == current_user.id
        )
    )

    analyses = result.scalars().all()

    service = DailyPrioritizationService(db)
    ranked = await service.generate_daily_top(analyses, limit)

    company_ids = [item["company_id"] for item in ranked]

    if not company_ids:
        return []

    companies_result = await db.execute(
        select(Company)
        .options(
            joinedload(Company.industry)
        )
        .where(Company.id.in_(company_ids))
    )

    companies = {c.id: c for c in companies_result.scalars().all()}

    response = []

    for item in ranked:
        company = companies.get(item["company_id"])
        
        # Determine "level" based on score (simulated logic for the UI)
        score = item["daily_score"]
        if score > 80:
            level = "critico"
        elif score > 60:
            level = "alto"
        elif score > 40:
            level = "medio"
        else:
            level = "bajo"

        # Try to get a reason from insights
        insight_res = await db.execute(
            select(Insight.title)
            .where(Insight.analysis_id == item["analysis_id"])
            .order_by(Insight.severity == "high", Insight.id.desc())
            .limit(1)
        )
        best_insight = insight_res.scalar() or "Análisis estratégico disponible."

        response.append(
            TopCompanyResponse(
                id=str(item["company_id"]),
                name=company.name if company else "Unknown",
                code=f"MX-{item['company_id']:05}",
                industry=company.industry.name if company and company.industry else "General",
                location="MÉXICO",
                reason=ReasonSchema(
                    level=level,
                    text=best_insight
                ),
                score=round(score, 2)
            )
        )

    return response


@api_router.get("/summary", response_model=DashboardSummaryResponse)
async def get_dashboard_summary(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    # Prioritized (Completed)
    prioritized_result = await db.execute(
        select(func.count(Analysis.id))
        .where(
            Analysis.status == AnalysisStatus.COMPLETED,
            Analysis.user_id == current_user.id
        )
    )
    prioritized_companies = prioritized_result.scalar() or 0

    # Total
    total_result = await db.execute(
        select(func.count(Analysis.id))
        .where(Analysis.user_id == current_user.id)
    )
    total_analyses = total_result.scalar() or 0

    # Opportunities (All recommendations)
    opp_result = await db.execute(
        select(func.count(Recommendation.id))
        .join(Insight)
        .join(Analysis)
        .where(Analysis.user_id == current_user.id)
    )
    opportunities_detected = opp_result.scalar() or 0

    # This week
    one_week_ago = datetime.now(timezone.utc) - timedelta(days=7)
    this_week_result = await db.execute(
        select(func.count(Analysis.id))
        .where(
            Analysis.user_id == current_user.id,
            Analysis.created_at >= one_week_ago
        )
    )
    analyses_this_week = this_week_result.scalar() or 0

    return DashboardSummaryResponse(
        prioritized_companies=prioritized_companies,
        total_analyses=total_analyses,
        opportunities_detected=opportunities_detected,
        analyses_this_week=analyses_this_week
    )
