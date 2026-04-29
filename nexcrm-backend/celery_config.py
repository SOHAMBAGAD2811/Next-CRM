"""
NexCRM — Celery Configuration + Beat Schedule
----------------------------------------------
Handles scheduled background AI processing tasks.

Start worker:   celery -A celery_config worker --loglevel=info
Start beat:     celery -A celery_config beat --loglevel=info
Start both:     celery -A celery_config worker --beat --loglevel=info
"""

from celery import Celery
from celery.schedules import crontab
import os
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

celery_app = Celery(
    'nexcrm',
    broker=REDIS_URL,
    backend=REDIS_URL,
    include=['tasks']   # tasks.py module (see below)
)

celery_app.conf.update(
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',
    timezone='Asia/Kolkata',   # ← Change to your timezone
    enable_utc=False,

    # ── Scheduled Tasks (Beat) ──────────────────────────────
    beat_schedule={

        # Refresh all lead AI scores every night at 2 AM
        'refresh-lead-scores-nightly': {
            'task': 'tasks.refresh_lead_scores',
            'schedule': crontab(hour=2, minute=0),
            'options': {'expires': 3600}
        },

        # Check for dormant leads and queue re-engagement emails at 9 AM
        'reengagement-emails-morning': {
            'task': 'tasks.send_reengagement_emails',
            'schedule': crontab(hour=9, minute=0),
            'options': {'expires': 3600}
        },

        # Flag churn risk accounts every 6 hours
        'churn-risk-check': {
            'task': 'tasks.refresh_churn_risk',
            'schedule': crontab(minute=0, hour='*/6'),
            'options': {'expires': 1800}
        },

        # Hourly: update sentiment aggregates for dashboard charts
        'sentiment-aggregation': {
            'task': 'tasks.aggregate_sentiment_trends',
            'schedule': crontab(minute=30),
            'options': {'expires': 600}
        },
    }
)
