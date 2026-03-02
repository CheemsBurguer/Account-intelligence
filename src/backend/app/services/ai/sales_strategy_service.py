import json
import logging
from sqlalchemy import select
from ...models.sales_strategy import SalesStrategy
from ...models.recommendation import Recommendation
from ...models.insight import Insight
from ...models.analysis import Analysis
from ...models.hpe_product import HPEProduct
from ...clients.llm_client import LLMClient

logger = logging.getLogger(__name__)


class SalesStrategyService:

    def __init__(self, db):
        self.db = db  # AsyncSession
        self.llm_client = LLMClient()

    def generate_for_analysis(self, analysis_id: int):

        logger.info(f"[SalesStrategy] Generating for analysis_id={analysis_id}")

        # --------------------------------------------------
        # Get analysis (async)
        # --------------------------------------------------

        analysis = self.db.get(Analysis, analysis_id)
        if not analysis:
            raise ValueError("Analysis not found")

        # --------------------------------------------------
        # Get accepted recommendations via JOIN with Insight
        # This ensures recommendations belong to this analysis
        # --------------------------------------------------

        result = self.db.execute(
            select(Recommendation)
            .join(Insight, Recommendation.insight_id == Insight.id)
            .where(
                Insight.analysis_id == analysis_id,
                Recommendation.is_accepted == True
            )
        )

        accepted_recommendations = result.scalars().all()

        if not accepted_recommendations:
            raise ValueError("No accepted products selected")

        # --------------------------------------------------
        # Get product details for accepted recommendations
        # (LLM must explicitly reference product names)
        # --------------------------------------------------

        accepted_products = []

        for r in accepted_recommendations:
            product = self.db.get(HPEProduct, r.product_id)
            if not product:
                continue

            accepted_products.append({
                "product_id": product.id,
                "name": product.name,
                "category_id": product.category_id,
                "match_percentage": r.match_percentage,
                "confidence_score": r.confidence_score
            })

        # --------------------------------------------------
        # Get insights
        # --------------------------------------------------

        result = self.db.execute(
            select(Insight)
            .where(Insight.analysis_id == analysis_id)
        )

        insights = result.scalars().all()

        # Severity prioritization
        severity_weight_map = {"high": 3, "medium": 2, "low": 1}

        sorted_insights = sorted(
            insights,
            key=lambda i: severity_weight_map.get(i.severity, 1),
            reverse=True
        )

        # --------------------------------------------------
        # Build LLM context payload
        # This is the strategic input for speech generation
        # --------------------------------------------------

        context_payload = {
            "analysis_summary": {
                "strategic_score": analysis.strategic_score,
                "propensity_score": analysis.propensity_score,
            },
            "insights": [
                {
                    "title": i.title,
                    "severity": i.severity,
                    "description": i.description,
                }
                for i in sorted_insights
            ],
            "accepted_products": accepted_products
        }

        # --------------------------------------------------
        # LLM Strategy Generation
        # --------------------------------------------------

        llm_response = self.llm_client.generate_sales_strategy(context_payload)

        logger.info(f"[SalesStrategy] LLM RAW RESPONSE: {llm_response}")

        # --------------------------------------------------
        # Persist Strategy (UPSERT behavior)
        # Ensures only ONE strategy per analysis
        # --------------------------------------------------

        result = self.db.execute(
            select(SalesStrategy)
            .where(SalesStrategy.analysis_id == analysis_id)
        )

        existing_strategy = result.scalar_one_or_none()

        if existing_strategy:
            # UPDATE existing strategy
            existing_strategy.status = "generated"
            existing_strategy.account_strategic_overview = llm_response.get("account_strategic_overview")
            existing_strategy.priority_initiatives = json.dumps(
                llm_response.get("priority_initiatives", [])
            )
            existing_strategy.financial_positioning = llm_response.get("financial_positioning")
            existing_strategy.technical_enablement_summary = llm_response.get("technical_enablement_summary")
            existing_strategy.objection_handling = json.dumps(
                llm_response.get("objection_handling", [])
            )
            existing_strategy.executive_conversation_version = llm_response.get(
                "executive_conversation_version"
            )
            existing_strategy.email_version = llm_response.get("email_version")
            existing_strategy.generated_by_llm = True

            strategy = existing_strategy

        else:
            # CREATE new strategy
            strategy = SalesStrategy(
                analysis_id=analysis_id,
                status="generated",
                account_strategic_overview=llm_response.get("account_strategic_overview"),
                priority_initiatives=json.dumps(
                    llm_response.get("priority_initiatives", [])
                ),
                financial_positioning=llm_response.get("financial_positioning"),
                technical_enablement_summary=llm_response.get("technical_enablement_summary"),
                objection_handling=json.dumps(
                    llm_response.get("objection_handling", [])
                ),
                executive_conversation_version=llm_response.get(
                    "executive_conversation_version"
                ),
                email_version=llm_response.get("email_version"),
                generated_by_llm=True
            )

            self.db.add(strategy)

        self.db.commit()

        logger.info(f"[SalesStrategy] Completed for analysis_id={analysis_id}")

        return strategy