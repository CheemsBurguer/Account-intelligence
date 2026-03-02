from celery import Celery
from ..core.config import settings

celery = Celery(
    "HPE_Account_Intelligence",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
)

from ..services.ai.tasks import product_seed_task
from ..services.ai.tasks import product_index_task
from ..services.ai.tasks import research_task
from ..services.ai.tasks import insight_task
from ..services.ai.tasks import recommendation_task

celery.conf.update(
    task_track_started=True,
    task_time_limit=60 * 10,  # 10 min hard limit
    task_soft_time_limit=60 * 8,
    worker_max_tasks_per_child=50,
    broker_connection_retry_on_startup=True,
    broker_connection_retry=True,
    broker_connection_max_retries=10,
)

celery.conf.task_default_queue = "default"