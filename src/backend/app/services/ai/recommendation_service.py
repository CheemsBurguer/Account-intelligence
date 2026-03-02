import logging
from sqlalchemy import delete, select
from ...models.insight import Insight
from ...models.recommendation import Recommendation
from ...models.hpe_product import HPEProduct
from ...models.analysis import Analysis
from ...clients.embedding_client import EmbeddingClient
from ...clients.pinecone_client import PineconeClient
from ...clients.llm_client import LLMClient

# =========================
# LLM Structured Output
# =========================
from ...schemas.ranking import RankedProduct, RankingOutput

logger = logging.getLogger(__name__)


# =========================
# Recommendation Service
# =========================

class RecommendationService:

    def __init__(self, db):
        self.db = db
        self.embedding_client = EmbeddingClient()
        self.pinecone_client = PineconeClient()
        self.llm_client = LLMClient()

    # --------------------------------------------------
    # Financial Alignment (Enterprise Weighting)
    # --------------------------------------------------
    def _financial_alignment_weight(self, analysis: Analysis, product: HPEProduct):

        # Example rule: consolidation stage favors consumption models
        if hasattr(analysis, "financial_stage") and analysis.financial_stage == "consolidation":
            if "greenlake" in product.name.lower():
                return 1.1
            return 0.9

        return 1.0  # neutral

    # --------------------------------------------------
    # Strategic Fit Enterprise Formula
    # --------------------------------------------------
    def _calculate_strategic_fit(
        self,
        semantic_score: float,
        llm_score: float,
        severity: str,
        analysis: Analysis,
        product: HPEProduct,
    ) -> float:

        severity_weight_map = {
            "low": 0.4,
            "medium": 0.7,
            "high": 1.0
        }

        severity_weight = severity_weight_map.get(
            severity.lower(), 0.5
        )

        strategic_component = (analysis.strategic_score or 50) / 100

        financial_weight = self._financial_alignment_weight(
            analysis, product
        )

        # ---------------------------------------------
        # Final Enterprise Strategic Fit Formula
        # ---------------------------------------------
        final_score = (
            semantic_score * 0.4 +
            llm_score * 0.25 +
            severity_weight * 0.2 +
            strategic_component * 0.15
        )

        final_score *= financial_weight

        return min(1.0, round(final_score, 4))

    def generate_for_insight(self, insight_id: int, top_k: int = 3):

        logger.info(f"[Recommendation] Starting for insight_id={insight_id}")

        insight = self.db.get(Insight, insight_id)

        if not insight:
            logger.error(f"[Recommendation] Insight {insight_id} not found")
            raise ValueError("Insight not found")

        analysis = self.db.get(Analysis, insight.analysis_id)

        logger.info(
            f"[Recommendation] Insight title='{insight.title}' severity='{insight.severity}'"
        )

        # --------------------------------------------------
        # Delete previous recommendations (idempotent behavior)
        # --------------------------------------------------
        self.db.execute(
            delete(Recommendation).where(
                Recommendation.insight_id == insight_id
            )
        )

        logger.info("[Recommendation] Cleared previous recommendations")

        query_text = f"{insight.title}. {insight.description}"

        # --------------------------------------------------
        # Semantic Retrieval (Recall Layer)
        # --------------------------------------------------
        query_vector = self.embedding_client.embed_text(query_text)

        matches = self.pinecone_client.similarity_search(
            query_vector=query_vector,
            namespace="products",
            top_k=top_k
        )

        logger.info(f"[Recommendation] Pinecone returned {len(matches)} matches")

        candidates = []

        for match in matches:
            product_id = int(match["metadata"]["product_id"])
            semantic_score = float(match["score"])

            product = self.db.get(HPEProduct, product_id)
            if not product:
                logger.warning(
                    f"[Recommendation] Skipping product_id={product_id} (not found in DB)"
                )
                continue

            candidates.append({
                "product": product,
                "semantic_score": semantic_score
            })

        if not candidates:
            logger.warning("[Recommendation] No valid candidates found")
            return

        # --------------------------------------------------
        # LLM Re-Ranking (Decision Layer)
        # --------------------------------------------------

        products_context = "\n\n".join([
            f"""
            Product ID: {c['product'].id}
            Name: {c['product'].name}
            Category ID: {c['product'].category_id}
            Description: {c['product'].description}
            """
            for c in candidates
        ])

        prompt = f"""
        You are an enterprise AI strategist.

        Rank the following products by strategic alignment with the insight.

        Return:
        - product_id
        - strategic_score (0-100)
        - reasoning

        Insight:
        Title: {insight.title}
        Description: {insight.description}
        Severity: {insight.severity}

        Candidate products:
        {products_context}
        """

        try:
            ranking_result = self.llm_client.generate_structured_output(
                prompt=prompt,
                output_schema=RankingOutput
            )
        except Exception:
            logger.warning("LLM quota exceeded — falling back to semantic ranking")
            ranking_result = None

        # --------------------------------------------------
        # Hybrid + Enterprise Strategic Fit Scoring
        # --------------------------------------------------

        results = []

        if ranking_result:

            for rank_position, item in enumerate(ranking_result.ranked_products, start=1):

                product = self.db.get(HPEProduct, item.product_id)
                if not product:
                    continue

                semantic_score = next(
                    c["semantic_score"]
                    for c in candidates
                    if c["product"].id == item.product_id
                )

                llm_score = item.strategic_score / 100

                strategic_fit = self._calculate_strategic_fit(
                    semantic_score=semantic_score,
                    llm_score=llm_score,
                    severity=insight.severity,
                    analysis=analysis,
                    product=product
                )

                results.append({
                    "product": product,
                    "semantic_score": semantic_score,
                    "llm_score": llm_score,
                    "strategic_fit": strategic_fit,
                    "reasoning": item.reasoning,
                    "llm_rank_position": rank_position
                })

        else:
            # Fallback purely semantic
            for index, c in enumerate(sorted(candidates, key=lambda x: x["semantic_score"], reverse=True), start=1):

                strategic_fit = self._calculate_strategic_fit(
                    semantic_score=c["semantic_score"],
                    llm_score=c["semantic_score"],  # fallback
                    severity=insight.severity,
                    analysis=analysis,
                    product=c["product"]
                )

                results.append({
                    "product": c["product"],
                    "semantic_score": c["semantic_score"],
                    "llm_score": c["semantic_score"],
                    "strategic_fit": strategic_fit,
                    "reasoning": "Fallback semantic ranking.",
                    "llm_rank_position": index
                })

        # --------------------------------------------------
        # Final Sorting by Strategic Fit
        # --------------------------------------------------

        results_sorted = sorted(
            results,
            key=lambda x: x["strategic_fit"],
            reverse=True
        )

        for priority_rank, item in enumerate(results_sorted, start=1):

            final_percentage = int(item["strategic_fit"] * 100)

            recommendation = Recommendation(
                insight_id=insight_id,
                product_id=item["product"].id,
                match_percentage=final_percentage,
                reasoning=item["reasoning"],
                confidence_score=item["strategic_fit"],
                final_score=item["strategic_fit"],
                priority_rank=priority_rank,
                llm_rank_position=item["llm_rank_position"]
            )

            self.db.add(recommendation)

            logger.info(
                f"[Recommendation] Strategic Fit for product_id={item['product'].id} "
                f"= {final_percentage}% | priority_rank={priority_rank}"
            )

        self.db.commit()


        # --------------------------------------------------
        # PROPENSITY SCORE CALCULATION
        # --------------------------------------------------

        analysis = self.db.get(Analysis, insight.analysis_id)

        # Strategic component
        strategic_component = (analysis.strategic_score or 0) / 100

        # Urgency component (insight severity)
        severity_weight_map = {
            "high": 1.0,
            "medium": 0.6,
            "low": 0.3
        }

        insight_result = self.db.execute(
            select(Insight.severity)
            .where(Insight.analysis_id == analysis.id)
        )

        severities = insight_result.scalars().all()

        if severities:
            urgency_component = sum(
                severity_weight_map.get(s.lower(), 0.3)
                for s in severities
            ) / len(severities)
        else:
            urgency_component = 0

        # Product fit component
        fit_result = self.db.execute(
            select(Recommendation.final_score)
            .join(Insight)
            .where(Insight.analysis_id == analysis.id)
        )

        fit_scores = fit_result.scalars().all()

        product_fit_component = (
            sum(fit_scores) / len(fit_scores)
            if fit_scores else 0
        )

        # Confidence component
        conf_result = self.db.execute(
            select(Recommendation.confidence_score)
            .join(Insight)
            .where(Insight.analysis_id == analysis.id)
        )

        confidence_scores = conf_result.scalars().all()

        confidence_component = (
            sum(confidence_scores) / len(confidence_scores)
            if confidence_scores else 0
        )

        # Engagement component
        accepted_result = self.db.execute(
            select(Recommendation.is_accepted)
            .join(Insight)
            .where(Insight.analysis_id == analysis.id)
        )

        accepted_list = accepted_result.scalars().all()

        if accepted_list:
            engagement_component = (
                sum(1 for x in accepted_list if x) / len(accepted_list)
            )
        else:
            engagement_component = 0

        # Final weighted formula
        propensity = (
            0.35 * strategic_component +
            0.20 * urgency_component +
            0.20 * product_fit_component +
            0.15 * confidence_component +
            0.10 * engagement_component
        )

        analysis.propensity_score = round(propensity * 100, 2)

        self.db.commit()

        logger.info(
            f"[Recommendation] Updated propensity_score={analysis.propensity_score}"
        )

        logger.info(f"[Recommendation] Completed for insight_id={insight_id}")