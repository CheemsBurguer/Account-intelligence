from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_
from sqlalchemy.orm import selectinload
from ...dependencies.deps import get_db
from ...dependencies.deps_auth import get_current_user
from ...models.user import User
from ...models.sales_strategy import SalesStrategy
from ...models.analysis import Analysis
from ...models.recommendation import Recommendation
from ...models.insight import Insight
from ...models.company import Company
from ...schemas.analysis import AnalysisResponse, AnalysisCreate, AnalysisListItem, AnalysisFullResponse, AnalysisProgressResponse
from ...schemas.recommendation import RecommendationAccept, RecommendationResponse, RecommendationUpdate
from ...schemas.sales_strategy import SalesStrategyResponse
from ...schemas.insight import InsightResponse
from ...services.ai.tasks.research_task import run_research
from ...models.enums import PROGRESS_MAP, AnalysisStatus
from ...utils.url import normalize_domain
from ...services.ai.tasks.sales_strategy_task import run_sales_strategy

api_router = APIRouter()

@api_router.post("/", response_model=AnalysisResponse)
async def create_analysis(
    payload: AnalysisCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    normalized_domain = normalize_domain(str(payload.website_url) if payload.website_url else None)

    # Try to find existing company by name OR domain
    result = await db.execute(
        select(Company).where(
            Company.name.ilike(payload.company_name)
        )
    )

    company = result.scalar_one_or_none()

    if not company:
        company = Company(
            name=payload.company_name,
            industry_id=payload.industry_id,
            website_url=normalized_domain
        )
        db.add(company)
        await db.commit()
        await db.refresh(company)


    active_statuses = [
        AnalysisStatus.COMPLETED,
        AnalysisStatus.RESEARCHING,
        AnalysisStatus.INSIGHT_PROCESSING,
        AnalysisStatus.RECOMMENDING,
        AnalysisStatus.STRATEGY_GENERATING,
    ]
    
    existing_analysis_result = await db.execute(
        select(Analysis).where(
            and_(
                Analysis.company_id == company.id,
                Analysis.user_id == current_user.id,
                Analysis.status.in_(active_statuses)
            )
        )
    )

    existing_analysis = existing_analysis_result.scalar_one_or_none()

    if existing_analysis:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An analysis for this company is already in progress."
        )

    analysis = Analysis(
        company_id=company.id,
        user_id=current_user.id,
        status="created"
    )

    db.add(analysis)
    await db.commit()
    await db.refresh(analysis)

    # Trigger AI pipeline
    run_research.delay(analysis.id)

    return AnalysisResponse(
        analysis_id=analysis.id,
        status=analysis.status
    )


@api_router.patch("/{recommendation_id}/accept", response_model=RecommendationResponse)
async def accept_recommendation(
    recommendation_id: int,
    payload: RecommendationAccept,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    result = await db.execute(
        select(Recommendation)
        .join(Insight, Recommendation.insight_id == Insight.id)
        .join(Analysis, Insight.analysis_id == Analysis.id)
        .where(
            Recommendation.id == recommendation_id,
            Analysis.user_id == current_user.id
        )
    )

    recommendation = result.scalar_one_or_none()

    if not recommendation:
        raise HTTPException(status_code=404, detail="Recommendation not found")

    recommendation.is_accepted = payload.is_accepted
    await db.commit()

    return RecommendationResponse(
        recommendation_id=recommendation.id,
        is_accepted=recommendation.is_accepted
    )


@api_router.get("/{analysis_id}", response_model=SalesStrategyResponse)
async def get_sales_strategy(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    result = await db.execute(
        select(SalesStrategy)
        .join(Analysis, SalesStrategy.analysis_id == Analysis.id)
        .where(
            SalesStrategy.analysis_id == analysis_id,
            Analysis.user_id == current_user.id
        )
    )

    strategy = result.scalar_one_or_none()

    if not strategy:
        raise HTTPException(status_code=404, detail="Strategy not found")

    return SalesStrategyResponse(
        id=strategy.analysis_id,
        status=strategy.status,
        account_strategic_overview=strategy.account_strategic_overview,
        priority_initiatives=strategy.priority_initiatives,
        financial_positioning=strategy.financial_positioning,
        technical_enablement_summary=strategy.technical_enablement_summary,
        objection_handling=strategy.objection_handling,
        executive_conversation_version=strategy.executive_conversation_version,
        email_version=strategy.email_version,
    )


@api_router.patch("/{analysis_id}/complete")
async def mark_analysis_completed(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    result = await db.execute(
        select(Analysis).where(
            and_(
                Analysis.id == analysis_id,
                Analysis.user_id == current_user.id
            )
        )
    )

    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Analysis not found"
        )

    analysis.status = "completed"

    await db.commit()

    return {"message": "Analysis marked as completed"}


@api_router.get("/", response_model=list[AnalysisListItem])
async def list_user_analyses(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    result = await db.execute(
        select(Analysis)
        .options(selectinload(Analysis.company))
        .where(Analysis.user_id == current_user.id)
        .order_by(Analysis.id.desc())
    )

    analyses = result.scalars().all()

    return [
        AnalysisListItem(
            analysis_id=a.id,
            company_id=a.company_id,
            company_name=a.company.name if a.company else None,
            status=a.status,
            strategic_score=a.strategic_score,
            propensity_score=a.propensity_score
        )
        for a in analyses
    ]



@api_router.get("/{analysis_id}/full", response_model=AnalysisFullResponse)
async def get_full_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    result = await db.execute(
        select(Analysis)
        .options(
            selectinload(Analysis.company),
            selectinload(Analysis.insights)
            .selectinload(Insight.recommendations),
            selectinload(Analysis.sales_strategy)
        )
        .where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id
        )
    )

    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found"
        )

    insights_response = []
    recommendations_response = []

    for insight in analysis.insights:
        insights_response.append(
            InsightResponse(
                id=insight.id,
                title=insight.title,
                severity=insight.severity,
                description=insight.description
            )
        )

        for rec in insight.recommendations:
            recommendations_response.append(
                RecommendationResponse(
                    id=rec.id,
                    product_id=rec.product_id,
                    match_percentage=rec.match_percentage,
                    confidence_score=rec.confidence_score,
                    is_accepted=rec.is_accepted
                )
            )

    strategy_response = None

    if analysis.sales_strategy:
        strategy = analysis.sales_strategy

        strategy_response = SalesStrategyResponse(
            id=strategy.id,
            status=strategy.status,
            account_strategic_overview=strategy.account_strategic_overview,
            priority_initiatives=strategy.priority_initiatives,
            financial_positioning=strategy.financial_positioning,
            technical_enablement_summary=strategy.technical_enablement_summary,
            objection_handling=strategy.objection_handling,
            executive_conversation_version=strategy.executive_conversation_version,
            email_version=strategy.email_version,
        )

    return AnalysisFullResponse(
        analysis_id=analysis.id,
        company_id=analysis.company_id,
        company_name=analysis.company.name if analysis.company else None,
        status=analysis.status,
        strategic_score=analysis.strategic_score,
        propensity_score=analysis.propensity_score,
        insights=insights_response,
        recommendations=recommendations_response,
        sales_strategy=strategy_response
    )



@api_router.patch(
    "/{analysis_id}/recommendations/{recommendation_id}"
)
async def update_recommendation_status(
    analysis_id: int,
    recommendation_id: int,
    payload: RecommendationUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    result = await db.execute(
        select(Recommendation)
        .join(Insight)
        .join(Analysis)
        .where(
            Recommendation.id == recommendation_id,
            Insight.analysis_id == analysis_id,
            Analysis.user_id == current_user.id
        )
    )

    recommendation = result.scalar_one_or_none()

    if not recommendation:
        raise HTTPException(
            status_code=404,
            detail="Recommendation not found"
        )

    recommendation.is_accepted = payload.is_accepted

    await db.commit()

    return {
        "message": "Recommendation updated",
        "recommendation_id": recommendation.id,
        "is_accepted": recommendation.is_accepted
    }


@api_router.post("/{analysis_id}/regenerate-strategy")
async def regenerate_sales_strategy(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    result = await db.execute(
        select(Analysis)
        .where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id
        )
    )

    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found"
        )

    # Prevent duplicate strategy generation
    if analysis.status == "generating_strategy":
        raise HTTPException(
            status_code=409,
            detail="Sales strategy generation already in progress"
        )

    # Verificar que haya al menos una recommendation aceptada
    accepted_result = await db.execute(
        select(Recommendation)
        .join(Insight)
        .where(
            Insight.analysis_id == analysis_id,
            Recommendation.is_accepted == True
        )
    )

    accepted = accepted_result.scalars().first()

    if not accepted:
        raise HTTPException(
            status_code=400,
            detail="No accepted recommendations found"
        )

    # Update status BEFORE launching task
    analysis.status = "generating_strategy"
    await db.commit()

    # Launch async task
    run_sales_strategy.delay(analysis_id)

    return {
        "message": "Sales strategy regeneration started",
        "analysis_id": analysis_id
    }



@api_router.get("/{analysis_id}/progress", response_model=AnalysisProgressResponse)
async def get_analysis_progress(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    result = await db.execute(
        select(Analysis).where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id
        )
    )

    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(
            status_code=404,
            detail="Analysis not found"
        )

    progress = PROGRESS_MAP.get(analysis.status, 0)

    return AnalysisProgressResponse(
        analysis_id=analysis.id,
        status=analysis.status,
        progress_percentage=progress
    )


@api_router.delete("/{analysis_id}")
async def delete_analysis(
    analysis_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):

    result = await db.execute(
        select(Analysis)
        .where(
            Analysis.id == analysis_id,
            Analysis.user_id == current_user.id
        )
    )

    analysis = result.scalar_one_or_none()

    if not analysis:
        raise HTTPException(status_code=404, detail="Analysis not found")

    await db.delete(analysis)
    await db.commit()

    return {"message": "Analysis deleted successfully"}