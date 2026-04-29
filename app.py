"""
NexCRM — AI-Powered CRM Backend
Flask + SQLAlchemy + MySQL
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import text
from datetime import datetime, timedelta
import os
from dotenv import load_dotenv

# AI/NLP imports
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from celery import Celery
import redis

load_dotenv()

app = Flask(__name__)
CORS(app)

# ──────────────────────────────────────────
# DATABASE CONFIG
# ──────────────────────────────────────────
app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"mysql+pymysql://{os.getenv('DB_USER', 'root')}:"
    f"{os.getenv('DB_PASSWORD', '')}@"
    f"{os.getenv('DB_HOST', 'localhost')}/"
    f"{os.getenv('DB_NAME', 'nexcrm')}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False
app.config['SECRET_KEY'] = os.getenv('SECRET_KEY', 'change-me-in-production')

db = SQLAlchemy(app)

# ──────────────────────────────────────────
# CELERY CONFIG (background AI tasks)
# ──────────────────────────────────────────
app.config['CELERY_BROKER_URL'] = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
app.config['CELERY_RESULT_BACKEND'] = os.getenv('REDIS_URL', 'redis://localhost:6379/0')

celery = Celery(app.name, broker=app.config['CELERY_BROKER_URL'])
celery.conf.update(app.config)

# ──────────────────────────────────────────
# MODELS
# ──────────────────────────────────────────

class Lead(db.Model):
    __tablename__ = 'leads'

    id             = db.Column(db.Integer, primary_key=True)
    name           = db.Column(db.String(120), nullable=False)
    email          = db.Column(db.String(200), unique=True, nullable=False)
    company        = db.Column(db.String(150))
    phone          = db.Column(db.String(20))
    stage          = db.Column(db.Enum('Lead', 'Qualified', 'Proposal', 'Closed'), default='Lead')
    deal_value     = db.Column(db.Numeric(12, 2), default=0)

    # AI-computed fields
    ai_score       = db.Column(db.Integer, default=0)       # 0–100
    sentiment      = db.Column(db.Enum('Positive', 'Neutral', 'Negative'), default='Neutral')
    churn_risk     = db.Column(db.Boolean, default=False)
    churn_risk_pct = db.Column(db.Integer, default=0)       # 0–100

    last_contacted = db.Column(db.DateTime, default=datetime.utcnow)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    interactions   = db.relationship('Interaction', backref='lead', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        days_since = (datetime.utcnow() - self.last_contacted).days if self.last_contacted else None
        return {
            'id':             self.id,
            'name':           self.name,
            'email':          self.email,
            'company':        self.company,
            'phone':          self.phone,
            'stage':          self.stage,
            'deal_value':     float(self.deal_value or 0),
            'ai_score':       self.ai_score,
            'sentiment':      self.sentiment,
            'churn_risk':     self.churn_risk,
            'churn_risk_pct': self.churn_risk_pct,
            'last_contacted': self.last_contacted.isoformat() if self.last_contacted else None,
            'days_since_contact': days_since,
            'created_at':     self.created_at.isoformat(),
        }


class Interaction(db.Model):
    __tablename__ = 'interactions'

    id         = db.Column(db.Integer, primary_key=True)
    lead_id    = db.Column(db.Integer, db.ForeignKey('leads.id'), nullable=False)
    channel    = db.Column(db.Enum('email', 'chat', 'call', 'note'), default='email')
    body       = db.Column(db.Text)
    sentiment  = db.Column(db.Enum('Positive', 'Neutral', 'Negative'), default='Neutral')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id':        self.id,
            'lead_id':   self.lead_id,
            'channel':   self.channel,
            'body':      self.body,
            'sentiment': self.sentiment,
            'created_at': self.created_at.isoformat(),
        }


# ──────────────────────────────────────────
# HELPERS / AI LOGIC
# ──────────────────────────────────────────

analyzer = SentimentIntensityAnalyzer()

def analyze_sentiment(text: str) -> str:
    """Run VADER sentiment analysis and return categorical label."""
    scores = analyzer.polarity_scores(text)
    compound = scores['compound']
    if compound >= 0.05:
        return 'Positive'
    elif compound <= -0.05:
        return 'Negative'
    return 'Neutral'


def compute_lead_score(lead: Lead) -> int:
    """
    Simple rule-based lead scoring (0–100).
    Replace/augment with a trained scikit-learn model for production.
    """
    score = 0

    # Stage weight
    stage_scores = {'Lead': 10, 'Qualified': 30, 'Proposal': 55, 'Closed': 80}
    score += stage_scores.get(lead.stage, 0)

    # Deal value weight (up to 20 pts)
    value = float(lead.deal_value or 0)
    if value >= 500000:
        score += 20
    elif value >= 200000:
        score += 12
    elif value >= 50000:
        score += 6

    # Recency weight (up to 15 pts)
    if lead.last_contacted:
        days = (datetime.utcnow() - lead.last_contacted).days
        if days <= 2:
            score += 15
        elif days <= 7:
            score += 8
        elif days <= 14:
            score += 3

    # Sentiment weight (up to 10 pts)
    sentiment_scores = {'Positive': 10, 'Neutral': 5, 'Negative': 0}
    score += sentiment_scores.get(lead.sentiment, 0)

    # Interaction volume (up to 5 pts)
    interaction_count = len(lead.interactions)
    score += min(interaction_count, 5)

    return min(score, 100)


def compute_churn_risk(lead: Lead):
    """Return (is_at_risk: bool, risk_pct: int)."""
    risk = 0

    # No contact in 30+ days
    if lead.last_contacted:
        days = (datetime.utcnow() - lead.last_contacted).days
        if days >= 30:
            risk += 40
        elif days >= 14:
            risk += 20

    # Negative sentiment
    if lead.sentiment == 'Negative':
        risk += 30
    elif lead.sentiment == 'Neutral':
        risk += 10

    # Low score
    if lead.ai_score < 40:
        risk += 20
    elif lead.ai_score < 60:
        risk += 10

    risk = min(risk, 100)
    return risk >= 50, risk


# ──────────────────────────────────────────
# CELERY TASKS (background AI processing)
# ──────────────────────────────────────────

@celery.task
def refresh_lead_scores_task():
    """Recalculate AI scores + churn risk for all leads (runs nightly via beat)."""
    with app.app_context():
        leads = Lead.query.all()
        for lead in leads:
            lead.ai_score = compute_lead_score(lead)
            lead.churn_risk, lead.churn_risk_pct = compute_churn_risk(lead)
        db.session.commit()
    return f"Updated {len(leads)} leads"


@celery.task
def send_reengagement_emails_task():
    """Trigger re-engagement for dormant leads (30+ days no contact)."""
    with app.app_context():
        cutoff = datetime.utcnow() - timedelta(days=30)
        dormant = Lead.query.filter(
            Lead.last_contacted < cutoff,
            Lead.stage.in_(['Lead', 'Qualified'])
        ).all()
        # TODO: Integrate your email provider (SendGrid, Mailgun, etc.) here
        for lead in dormant:
            print(f"[EMAIL QUEUE] Re-engagement email → {lead.email}")
        return f"Queued {len(dormant)} re-engagement emails"


# ──────────────────────────────────────────
# ROUTES — LEADS
# ──────────────────────────────────────────

@app.route('/api/leads', methods=['GET'])
def get_leads():
    stage     = request.args.get('stage')
    sentiment = request.args.get('sentiment')
    sort_by   = request.args.get('sort', 'ai_score')   # ai_score | created_at | deal_value
    order     = request.args.get('order', 'desc')

    query = Lead.query

    if stage:
        query = query.filter_by(stage=stage)
    if sentiment:
        query = query.filter_by(sentiment=sentiment)

    sort_col = getattr(Lead, sort_by, Lead.ai_score)
    query = query.order_by(sort_col.desc() if order == 'desc' else sort_col.asc())

    leads = query.all()
    return jsonify([l.to_dict() for l in leads])


@app.route('/api/leads/<int:lead_id>', methods=['GET'])
def get_lead(lead_id):
    lead = Lead.query.get_or_404(lead_id)
    data = lead.to_dict()
    data['interactions'] = [i.to_dict() for i in lead.interactions]
    return jsonify(data)


@app.route('/api/leads', methods=['POST'])
def create_lead():
    body = request.get_json()
    lead = Lead(
        name       = body['name'],
        email      = body['email'],
        company    = body.get('company', ''),
        phone      = body.get('phone', ''),
        stage      = body.get('stage', 'Lead'),
        deal_value = body.get('deal_value', 0),
    )
    db.session.add(lead)
    db.session.flush()   # get lead.id before score computation
    lead.ai_score = compute_lead_score(lead)
    lead.churn_risk, lead.churn_risk_pct = compute_churn_risk(lead)
    db.session.commit()
    return jsonify(lead.to_dict()), 201


@app.route('/api/leads/<int:lead_id>', methods=['PUT'])
def update_lead(lead_id):
    lead = Lead.query.get_or_404(lead_id)
    body = request.get_json()

    for field in ['name', 'email', 'company', 'phone', 'stage', 'deal_value']:
        if field in body:
            setattr(lead, field, body[field])

    # Recalculate AI fields on update
    lead.ai_score = compute_lead_score(lead)
    lead.churn_risk, lead.churn_risk_pct = compute_churn_risk(lead)
    db.session.commit()
    return jsonify(lead.to_dict())


@app.route('/api/leads/<int:lead_id>', methods=['DELETE'])
def delete_lead(lead_id):
    lead = Lead.query.get_or_404(lead_id)
    db.session.delete(lead)
    db.session.commit()
    return jsonify({'message': f'Lead {lead_id} deleted'}), 200


# ──────────────────────────────────────────
# ROUTES — INTERACTIONS
# ──────────────────────────────────────────

@app.route('/api/leads/<int:lead_id>/interactions', methods=['POST'])
def add_interaction(lead_id):
    lead = Lead.query.get_or_404(lead_id)
    body = request.get_json()
    text = body.get('body', '')

    sentiment = analyze_sentiment(text)
    interaction = Interaction(
        lead_id   = lead_id,
        channel   = body.get('channel', 'email'),
        body      = text,
        sentiment = sentiment,
    )
    db.session.add(interaction)

    # Update lead's overall sentiment from latest interaction
    lead.sentiment = sentiment
    lead.last_contacted = datetime.utcnow()
    lead.ai_score = compute_lead_score(lead)
    lead.churn_risk, lead.churn_risk_pct = compute_churn_risk(lead)

    db.session.commit()
    return jsonify(interaction.to_dict()), 201


# ──────────────────────────────────────────
# ROUTES — DASHBOARD & ANALYTICS
# ──────────────────────────────────────────

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    all_leads = Lead.query.all()

    total_leads     = len(all_leads)
    pipeline_value  = sum(float(l.deal_value or 0) for l in all_leads if l.stage != 'Closed')
    closed_value    = sum(float(l.deal_value or 0) for l in all_leads if l.stage == 'Closed')
    at_risk_count   = sum(1 for l in all_leads if l.churn_risk)

    closed_total = len([l for l in all_leads if l.stage == 'Closed'])
    conversion_rate = round((closed_total / total_leads * 100), 1) if total_leads else 0

    sentiment_dist = {'Positive': 0, 'Neutral': 0, 'Negative': 0}
    for l in all_leads:
        sentiment_dist[l.sentiment] = sentiment_dist.get(l.sentiment, 0) + 1

    stage_dist = {'Lead': 0, 'Qualified': 0, 'Proposal': 0, 'Closed': 0}
    for l in all_leads:
        stage_dist[l.stage] = stage_dist.get(l.stage, 0) + 1

    top_leads = sorted(all_leads, key=lambda x: x.ai_score, reverse=True)[:5]
    at_risk   = sorted([l for l in all_leads if l.churn_risk], key=lambda x: x.churn_risk_pct, reverse=True)

    return jsonify({
        'kpis': {
            'total_leads':     total_leads,
            'pipeline_value':  pipeline_value,
            'closed_value':    closed_value,
            'conversion_rate': conversion_rate,
            'at_risk_count':   at_risk_count,
        },
        'sentiment_distribution': sentiment_dist,
        'stage_distribution':     stage_dist,
        'top_leads':  [l.to_dict() for l in top_leads],
        'at_risk':    [l.to_dict() for l in at_risk],
    })


@app.route('/api/pipeline', methods=['GET'])
def get_pipeline():
    stages = ['Lead', 'Qualified', 'Proposal', 'Closed']
    pipeline = {}
    for stage in stages:
        leads = Lead.query.filter_by(stage=stage).order_by(Lead.ai_score.desc()).all()
        pipeline[stage] = {
            'leads': [l.to_dict() for l in leads],
            'total_value': sum(float(l.deal_value or 0) for l in leads),
            'count': len(leads),
        }
    return jsonify(pipeline)


@app.route('/api/churn-risk', methods=['GET'])
def get_churn_risk():
    at_risk = Lead.query.filter_by(churn_risk=True)\
                  .order_by(Lead.churn_risk_pct.desc()).all()
    return jsonify([l.to_dict() for l in at_risk])


# ──────────────────────────────────────────
# ROUTES — AI ASSISTANT (LLM Chat)
# ──────────────────────────────────────────

@app.route('/api/assistant/chat', methods=['POST'])
def assistant_chat():
    """
    Proxy endpoint for AI assistant. Builds context from live DB data,
    then calls OpenAI / Ollama.
    """
    body    = request.get_json()
    user_msg = body.get('message', '')
    history  = body.get('history', [])

    # Build live CRM context from DB
    all_leads = Lead.query.order_by(Lead.ai_score.desc()).limit(20).all()
    at_risk   = Lead.query.filter_by(churn_risk=True).all()

    context_lines = [
        "You are an AI sales assistant inside NexCRM with access to live CRM data.",
        f"Total leads: {Lead.query.count()}",
        f"At-risk accounts: {len(at_risk)}",
        "Top leads by AI score:",
    ]
    for l in all_leads[:5]:
        context_lines.append(
            f"  - {l.name} ({l.company}) | Score: {l.ai_score} | Stage: {l.stage} | "
            f"Sentiment: {l.sentiment} | Value: ₹{float(l.deal_value or 0):,.0f}"
        )
    if at_risk:
        context_lines.append("At-risk accounts:")
        for l in at_risk:
            context_lines.append(f"  - {l.name} ({l.company}) | Risk: {l.churn_risk_pct}%")

    system_prompt = "\n".join(context_lines)

    # ── Option A: OpenAI ──
    # from openai import OpenAI
    # client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    # messages = [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": user_msg}]
    # resp = client.chat.completions.create(model="gpt-4o-mini", messages=messages, max_tokens=500)
    # reply = resp.choices[0].message.content

    # ── Option B: Ollama (local LLM) ──
    # import requests as req
    # resp = req.post("http://localhost:11434/api/chat", json={
    #     "model": "llama3", "stream": False,
    #     "messages": [{"role": "system", "content": system_prompt}] + history + [{"role": "user", "content": user_msg}]
    # })
    # reply = resp.json()["message"]["content"]

    # ── Placeholder (remove when you connect an LLM) ──
    reply = (
        f"[AI Assistant] Based on your CRM data, here's what I found for: '{user_msg}'. "
        "Connect OpenAI or Ollama in app.py to get real AI responses."
    )

    return jsonify({'reply': reply})


# ──────────────────────────────────────────
# ROUTES — MANUAL TRIGGERS
# ──────────────────────────────────────────

@app.route('/api/admin/refresh-scores', methods=['POST'])
def trigger_score_refresh():
    task = refresh_lead_scores_task.delay()
    return jsonify({'task_id': task.id, 'status': 'queued'})


@app.route('/api/admin/trigger-reengagement', methods=['POST'])
def trigger_reengagement():
    task = send_reengagement_emails_task.delay()
    return jsonify({'task_id': task.id, 'status': 'queued'})


# ──────────────────────────────────────────
# DB INIT + SEED
# ──────────────────────────────────────────

@app.route('/api/admin/seed', methods=['POST'])
def seed_db():
    """Seed demo data. Call once after initial setup."""
    if Lead.query.count() > 0:
        return jsonify({'message': 'Database already seeded'}), 400

    demo_leads = [
        Lead(name='Riya Mehta',    email='riya@technova.in',   company='TechNova Pvt. Ltd.', stage='Qualified', deal_value=420000, sentiment='Positive', last_contacted=datetime.utcnow() - timedelta(days=5)),
        Lead(name='Ankit Sharma',  email='ankit@infrabuild.in', company='InfraBuild Co.',      stage='Proposal',  deal_value=850000, sentiment='Positive', last_contacted=datetime.utcnow() - timedelta(days=2)),
        Lead(name='Priya Nair',    email='priya@cloudspark.io', company='CloudSpark Inc.',     stage='Lead',      deal_value=280000, sentiment='Neutral',  last_contacted=datetime.utcnow() - timedelta(days=1)),
        Lead(name='Kabir Joshi',   email='kabir@datamind.in',   company='DataMind Analytics',  stage='Proposal',  deal_value=600000, sentiment='Negative', last_contacted=datetime.utcnow() - timedelta(days=12)),
        Lead(name='Sneha Patel',   email='sneha@greenbuild.in', company='GreenBuild Corp.',    stage='Qualified', deal_value=310000, sentiment='Positive', last_contacted=datetime.utcnow() - timedelta(days=3)),
        Lead(name='Dev Malhotra',  email='dev@retailnext.in',   company='RetailNext Ltd.',     stage='Lead',      deal_value=150000, sentiment='Neutral',  last_contacted=datetime.utcnow() - timedelta(days=8)),
        Lead(name='Zara Khan',     email='zara@mediawave.in',   company='MediaWave Studios',   stage='Closed',    deal_value=520000, sentiment='Positive', last_contacted=datetime.utcnow() - timedelta(days=15)),
    ]
    for lead in demo_leads:
        db.session.add(lead)
        db.session.flush()
        lead.ai_score = compute_lead_score(lead)
        lead.churn_risk, lead.churn_risk_pct = compute_churn_risk(lead)

    db.session.commit()
    return jsonify({'message': f'Seeded {len(demo_leads)} demo leads'}), 201


if __name__ == '__main__':
    with app.app_context():
        db.create_all()
    app.run(debug=True, port=5000)
