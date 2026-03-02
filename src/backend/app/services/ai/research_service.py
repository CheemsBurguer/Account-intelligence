from ...db.database import SyncSessionLocal
from ...models.analysis import Analysis


class ResearchService:

    def __init__(self, task=None):
        self.task = task  # Celery task (optional for progress updates)

    def execute(self, analysis_id: int):

        db = SyncSessionLocal()

        try:
            # ─────────────────────────────────────────────
            # Load analysis and mark as researching
            # ─────────────────────────────────────────────

            analysis = db.get(Analysis, analysis_id)

            if not analysis:
                raise ValueError("Analysis not found")

            analysis.status = "researching"
            db.commit()

            if self.task:
                self.task.update_state(
                    state="PROGRESS",
                    meta={"progress": 25}
                )

            # ─────────────────────────────────────────────
            # --- Tavily call ---
            # External research data retrieval
            # ─────────────────────────────────────────────

            if self.task:
                self.task.update_state(
                    state="PROGRESS",
                    meta={"progress": 50}
                )

            # ─────────────────────────────────────────────
            # --- Embeddings ---
            # Generate vector representations and store in Pinecone
            # ─────────────────────────────────────────────

            if self.task:
                self.task.update_state(
                    state="PROGRESS",
                    meta={"progress": 80}
                )

            # ─────────────────────────────────────────────
            # Mark research completed
            # ─────────────────────────────────────────────

            analysis.status = "research_completed"
            db.commit()

            if self.task:
                self.task.update_state(
                    state="SUCCESS",
                    meta={"progress": 100}
                )

        except Exception as e:
            # ─────────────────────────────────────────────
            # Error handling
            # ─────────────────────────────────────────────

            analysis = db.get(Analysis, analysis_id)

            if analysis:
                analysis.status = "failed"
                analysis.error_message = str(e)
                analysis.error_stage = "research"
                db.commit()

            raise e

        finally:
            db.close()