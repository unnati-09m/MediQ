"""
celery_tasks.py – Background tasks using Celery + Redis broker
"""
from celery import Celery
from celery.schedules import crontab

from config import settings

celery_app = Celery(
    "mediq",
    broker=settings.CELERY_BROKER_URL,
    backend=settings.CELERY_RESULT_BACKEND,
    include=["backend.celery_tasks"],
)

celery_app.conf.update(
    task_serializer="json",
    result_serializer="json",
    accept_content=["json"],
    timezone="Asia/Kolkata",
    enable_utc=True,
    beat_schedule={
        # Recalculate queue priority scores every 60 seconds so wait times are fresh
        "recalculate-queue-every-minute": {
            "task": "backend.celery_tasks.recalculate_queue_task",
            "schedule": 60.0,
        },
        # Reset daily counters at midnight IST
        "reset-daily-counters-midnight": {
            "task": "backend.celery_tasks.reset_daily_counters",
            "schedule": crontab(hour=0, minute=0),
        },
    },
)


@celery_app.task(name="backend.celery_tasks.recalculate_queue_task", bind=True, max_retries=3)
def recalculate_queue_task(self):
    """
    Recalculate all waiting patient priority scores in Redis.
    Runs every 60 seconds via Celery beat.
    This is a sync task that creates its own event loop.
    """
    import asyncio
    from database import AsyncSessionLocal
    from queue_engine import recalculate_queue
    from websocket_manager import broadcast_queue_updated
    from doctor_engine import get_all_doctors, format_doctor_response
    from queue_engine import get_ordered_queue, get_queue_stats

    async def _run():
        async with AsyncSessionLocal() as db:
            try:
                await recalculate_queue(db)
                queue_data = await get_ordered_queue(db)
                stats = await get_queue_stats(db)
                doctors = await get_all_doctors(db)
                doctor_data = [await format_doctor_response(d, db) for d in doctors]
                await broadcast_queue_updated(queue_data, stats)
                print(f"[Celery] Queue recalculated — {len(queue_data)} waiting patients")
            except Exception as exc:
                print(f"[Celery] recalculate_queue_task error: {exc}")
                raise self.retry(exc=exc, countdown=15)

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(_run())


@celery_app.task(name="backend.celery_tasks.reset_daily_counters", bind=True)
def reset_daily_counters(self):
    """
    At midnight: reset token counter + doctor daily stats.
    Patients from the previous day are NOT deleted — just stats reset.
    """
    import asyncio
    from database import AsyncSessionLocal
    from redis_client import reset_token_counter, clear_queue
    from models import Doctor
    from sqlalchemy import update

    async def _run():
        async with AsyncSessionLocal() as db:
            try:
                # Reset all doctor daily counts
                await db.execute(
                    update(Doctor).values(total_consulted_today=0)
                )
                await db.commit()
                # Reset Redis token counter and clear queue
                await reset_token_counter()
                await clear_queue()
                print("[Celery] Daily counters reset successfully")
            except Exception as exc:
                print(f"[Celery] reset_daily_counters error: {exc}")
                await db.rollback()

    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    loop.run_until_complete(_run())
