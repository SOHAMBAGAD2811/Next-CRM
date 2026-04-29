"""
NexCRM — Celery Tasks
----------------------
All background AI processing tasks.
Imported by celery_config.py and app.py.
"""

from celery_config import celery_app
from datetime import datetime, timedelta
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart


# ──────────────────────────────────────────
# TASK: Refresh all lead AI scores
# ──────────────────────────────────────────

@celery_app.task(name='tasks.refresh_lead_scores', bind=True, max_retries=3)
def refresh_lead_scores(self):
    """Recalculate AI score for every lead using the ML model."""
    try:
        from app import app, db, Lead, compute_lead_score
        from ml_model import predict_score

        with app.app_context():
            leads = Lead.query.all()
            updated = 0
            for lead in leads:
                lead_dict = lead.to_dict()
                lead_dict['interaction_count'] = len(lead.interactions)
                new_score = predict_score(lead_dict)
                if new_score != lead.ai_score:
                    lead.ai_score = new_score
                    updated += 1
            db.session.commit()

        return {'status': 'ok', 'total': len(leads), 'updated': updated}

    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)


# ──────────────────────────────────────────
# TASK: Refresh churn risk flags
# ──────────────────────────────────────────

@celery_app.task(name='tasks.refresh_churn_risk', bind=True, max_retries=3)
def refresh_churn_risk(self):
    """Recalculate churn risk for all active leads."""
    try:
        from app import app, db, Lead, compute_churn_risk

        with app.app_context():
            leads = Lead.query.filter(Lead.stage != 'Closed').all()
            newly_at_risk = []
            for lead in leads:
                old_risk = lead.churn_risk
                lead.churn_risk, lead.churn_risk_pct = compute_churn_risk(lead)
                if lead.churn_risk and not old_risk:
                    newly_at_risk.append(lead.name)
            db.session.commit()

        return {'status': 'ok', 'checked': len(leads), 'newly_at_risk': newly_at_risk}

    except Exception as exc:
        raise self.retry(exc=exc, countdown=120)


# ──────────────────────────────────────────
# TASK: Re-engagement emails for dormant leads
# ──────────────────────────────────────────

@celery_app.task(name='tasks.send_reengagement_emails', bind=True, max_retries=2)
def send_reengagement_emails(self):
    """
    Find leads with no contact in 30+ days and send re-engagement email.
    Configure SMTP credentials in .env to enable real sending.
    """
    try:
        from app import app, db, Lead

        with app.app_context():
            cutoff = datetime.utcnow() - timedelta(days=30)
            dormant = Lead.query.filter(
                Lead.last_contacted < cutoff,
                Lead.stage.in_(['Lead', 'Qualified'])
            ).all()

            sent = []
            for lead in dormant:
                success = _send_email(
                    to_name=lead.name,
                    to_email=lead.email,
                    subject=f"We'd love to reconnect, {lead.name.split()[0]}",
                    body=_reengagement_template(lead.name, lead.company)
                )
                if success:
                    # Mark contacted so we don't re-email them immediately
                    lead.last_contacted = datetime.utcnow()
                    sent.append(lead.email)

            db.session.commit()

        return {'status': 'ok', 'sent': len(sent), 'emails': sent}

    except Exception as exc:
        raise self.retry(exc=exc, countdown=300)


# ──────────────────────────────────────────
# TASK: Aggregate sentiment trends for charts
# ──────────────────────────────────────────

@celery_app.task(name='tasks.aggregate_sentiment_trends')
def aggregate_sentiment_trends():
    """
    Aggregate sentiment distribution over time and cache in Redis.
    The dashboard /api/dashboard endpoint reads this cached value.
    """
    try:
        import redis, json
        from app import app, db, Lead, Interaction

        with app.app_context():
            # Last 30 days, grouped by week
            trends = []
            for week_offset in range(4, -1, -1):
                week_start = datetime.utcnow() - timedelta(weeks=week_offset + 1)
                week_end   = datetime.utcnow() - timedelta(weeks=week_offset)

                pos = Interaction.query.filter(
                    Interaction.created_at.between(week_start, week_end),
                    Interaction.sentiment == 'Positive'
                ).count()
                neg = Interaction.query.filter(
                    Interaction.created_at.between(week_start, week_end),
                    Interaction.sentiment == 'Negative'
                ).count()
                neu = Interaction.query.filter(
                    Interaction.created_at.between(week_start, week_end),
                    Interaction.sentiment == 'Neutral'
                ).count()

                trends.append({
                    'week': week_start.strftime('%b %d'),
                    'positive': pos, 'neutral': neu, 'negative': neg
                })

        # Cache in Redis for 2 hours
        r = redis.from_url(os.getenv('REDIS_URL', 'redis://localhost:6379/0'))
        r.setex('sentiment_trends', 7200, json.dumps(trends))

        return {'status': 'ok', 'weeks': len(trends)}

    except Exception as e:
        return {'status': 'error', 'error': str(e)}


# ──────────────────────────────────────────
# EMAIL HELPERS
# ──────────────────────────────────────────

def _send_email(to_name: str, to_email: str, subject: str, body: str) -> bool:
    """
    Send email via SMTP. Configure in .env:
      SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM
    Returns True on success, False on failure.
    """
    smtp_host = os.getenv('SMTP_HOST')
    smtp_port = int(os.getenv('SMTP_PORT', 587))
    smtp_user = os.getenv('SMTP_USER')
    smtp_pass = os.getenv('SMTP_PASS')
    smtp_from = os.getenv('SMTP_FROM', smtp_user)

    if not all([smtp_host, smtp_user, smtp_pass]):
        # SMTP not configured — log and skip
        print(f"[EMAIL SKIPPED — configure SMTP in .env] To: {to_email} | Subject: {subject}")
        return False

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From']    = f"NexCRM <{smtp_from}>"
        msg['To']      = f"{to_name} <{to_email}>"

        html_part = MIMEText(body, 'html')
        msg.attach(html_part)

        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_pass)
            server.sendmail(smtp_from, [to_email], msg.as_string())

        print(f"[EMAIL SENT] → {to_email}")
        return True

    except Exception as e:
        print(f"[EMAIL FAILED] {to_email}: {e}")
        return False


def _reengagement_template(name: str, company: str) -> str:
    """HTML email template for dormant lead re-engagement."""
    first = name.split()[0]
    return f"""
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <style>
    body {{ font-family: 'Segoe UI', Arial, sans-serif; background: #f5f2eb; margin: 0; padding: 0; }}
    .container {{ max-width: 560px; margin: 40px auto; background: #fff; border: 2px solid #0a0a0a; }}
    .header {{ background: #0a0a0a; color: #f5f2eb; padding: 28px 32px; }}
    .logo {{ font-size: 22px; font-weight: 700; letter-spacing: -0.5px; }}
    .logo span {{ color: #ff4d00; }}
    .body {{ padding: 32px; }}
    h2 {{ font-size: 20px; margin: 0 0 16px; }}
    p {{ color: #444; line-height: 1.7; margin: 0 0 16px; font-size: 15px; }}
    .cta {{ display: inline-block; background: #ff4d00; color: white; padding: 14px 28px;
            font-weight: 700; font-size: 14px; border: 2px solid #0a0a0a; text-decoration: none;
            letter-spacing: 0.3px; margin-top: 8px; }}
    .footer {{ padding: 20px 32px; border-top: 2px solid #e0ddd6; font-size: 12px; color: #888; }}
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="logo">Nex<span>CRM</span></div>
    </div>
    <div class="body">
      <h2>Hey {first}, it's been a while 👋</h2>
      <p>We noticed it's been over 30 days since we last connected regarding {company or 'your account'}. 
         We wanted to check in and see if there's anything we can help with.</p>
      <p>A lot has changed — we'd love to share some updates that might be relevant to what you were 
         exploring. Even a quick 15-minute catch-up call could be valuable.</p>
      <a href="https://nexcrm.app/book" class="cta">Book a 15-min call →</a>
    </div>
    <div class="footer">
      You're receiving this because you're a contact in NexCRM. 
      <a href="#">Unsubscribe</a>
    </div>
  </div>
</body>
</html>
"""
