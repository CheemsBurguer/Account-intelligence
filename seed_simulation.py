import asyncio
import os
import sys
from datetime import datetime, timezone

sys.path.append("/app")

async def seed_full_data():
    from app.db.database import sessionLocal
    from app.models.user import User
    from app.models.company import Company
    from app.models.analysis import Analysis
    from app.models.insight import Insight
    from app.models.recommendation import Recommendation
    from app.models.industry import Industry
    from app.models.hpe_product import HPEProduct
    from app.models.enums import AnalysisStatus
    from sqlalchemy import select

    async with sessionLocal() as db:
        # 1. Get User
        user_res = await db.execute(select(User).where(User.email == "test@hpe.com"))
        user = user_res.scalar_one_or_none()
        if not user:
            print("User test@hpe.com not found. Please run the other script first.")
            return

        # 2. Get or Create Industry
        ind_res = await db.execute(select(Industry).where(Industry.name == "Healthcare"))
        industry = ind_res.scalar_one_or_none()
        if not industry:
            industry = Industry(name="Healthcare", description="Healthcare industry")
            db.add(industry)
            await db.flush()

        # 3. Create Company
        company = Company(
            name="Healthcare Solutions",
            industry_id=industry.id,
            website_url="healthtech.com",
            is_simulated=True
        )
        db.add(company)
        await db.flush()

        # 4. Create Analysis
        analysis = Analysis(
            user_id=user.id,
            company_id=company.id,
            status=AnalysisStatus.COMPLETED,
            strategic_score=95,
            propensity_score=88,
            score_breakdown={"technical": 90, "business": 85},
            summary_financial="Strong financial position with 15% YoY growth.",
            summary_tech_stack="Moving towards hybrid cloud architecture.",
            summary_strategy="Expansion into telemedicine services."
        )
        db.add(analysis)
        await db.flush()

        # 5. Create Insights
        insights_data = [
            {
                "title": "Migración Crítica a la Nube",
                "description": "La infraestructura heredada está llegando al final de su vida útil, lo que requiere una transición urgente.",
                "category": "Infraestructura",
                "severity": "critica",
                "card_size": "large"
            },
            {
                "title": "Expansión de Ciberseguridad",
                "description": "Nuevas regulaciones de datos exigen una arquitectura de seguridad más robusta.",
                "category": "Seguridad",
                "severity": "alta",
                "card_size": "medium"
            },
            {
                "title": "Optimización de Costos IT",
                "description": "Oportunidad para consolidar centros de datos y reducir gastos operativos.",
                "category": "Finanzas",
                "severity": "media",
                "card_size": "small"
            }
        ]

        for ins_data in insights_data:
            insight = Insight(
                analysis_id=analysis.id,
                **ins_data
            )
            db.add(insight)
            await db.flush()

            # Optional: Add a recommendation for each insight if products exist
            prod_res = await db.execute(select(HPEProduct).limit(1))
            product = prod_res.scalar_one_or_none()
            if product:
                rec = Recommendation(
                    insight_id=insight.id,
                    product_id=product.id,
                    match_percentage=90,
                    confidence_score=0.95,
                    is_accepted=False
                )
                db.add(rec)

        await db.commit()
        print(f"Full simulation data seeded for test@hpe.com (Company: {company.name})")

if __name__ == "__main__":
    asyncio.run(seed_full_data())
