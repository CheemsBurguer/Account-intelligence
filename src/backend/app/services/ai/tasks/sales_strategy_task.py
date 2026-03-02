from ....core.celery_app import celery
from ....db.database import SyncSessionLocal
from ..sales_strategy_service import SalesStrategyService
from ....models.analysis import Analysis
from ....models.enums import AnalysisStatus

@celery.task(bind=True)
def run_sales_strategy(self, analysis_id: int):

    db = SyncSessionLocal()

    try:
        service = SalesStrategyService(db)

        service.generate_for_analysis(analysis_id)

        analysis = db.get(Analysis, analysis_id)
        analysis.status = AnalysisStatus.COMPLETED

        db.commit()

    except Exception as e:
        analysis = db.get(Analysis, analysis_id)
        if analysis:
            analysis.status = AnalysisStatus.FAILED
            analysis.error_message = str(e)
            analysis.error_stage = "sales_strategy_generation"
            db.commit()
        raise e

    finally:
        db.close()