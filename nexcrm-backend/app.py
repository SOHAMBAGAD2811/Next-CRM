"""
NexCRM — AI-Powered CRM Backend
Flask + SQLAlchemy + MySQL
"""

from flask import Flask, jsonify, request
from flask_cors import CORS
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime, timedelta, timezone
import os
from dotenv import load_dotenv
from sqlalchemy import text

# AI/NLP imports
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer
from celery import Celery
import redis
from werkzeug.security import generate_password_hash, check_password_hash

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

class User(db.Model):
    __tablename__ = 'users'

    id            = db.Column(db.Integer, primary_key=True)
    name          = db.Column(db.String(120), nullable=False)
    email         = db.Column(db.String(200), unique=True, nullable=False)
    password_hash = db.Column(db.String(256), nullable=False)
    role          = db.Column(db.String(50), default='Sales Rep')

    def set_password(self, password):
        self.password_hash = generate_password_hash(password)

    def check_password(self, password):
        return check_password_hash(self.password_hash, password)

    def to_dict(self):
        return {'id': self.id, 'name': self.name, 'email': self.email, 'role': self.role}

class Lead(db.Model):
    __tablename__ = 'leads'

    id             = db.Column(db.Integer, primary_key=True)
    user_id        = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)
    name           = db.Column(db.String(120), nullable=False)
    email          = db.Column(db.String(200), unique=True, nullable=False)
    company        = db.Column(db.String(150))
    phone          = db.Column(db.String(20))
    stage          = db.Column(db.Enum('Lead', 'Qualified', 'Proposal', 'Closed'), default='Lead')
    deal_value     = db.Column(db.Numeric(12, 2), default=0)
    win_probability= db.Column(db.Integer, default=0)
    tags           = db.Column(db.String(255), default='')
    next_action    = db.Column(db.String(255), default='')

    # AI-computed fields
    ai_score       = db.Column(db.Integer, default=0)       # 0–100
    sentiment      = db.Column(db.Enum('Positive', 'Neutral', 'Negative'), default='Neutral')
    churn_risk     = db.Column(db.Boolean, default=False)
    churn_risk_pct = db.Column(db.Integer, default=0)       # 0–100

    last_contacted = db.Column(db.DateTime, default=datetime.utcnow)
    created_at     = db.Column(db.DateTime, default=datetime.utcnow)

    interactions   = db.relationship('Interaction', backref='lead', lazy=True, cascade='all, delete-orphan')
    files          = db.relationship('FileAttachment', backref='lead', lazy=True, cascade='all, delete-orphan')

    def to_dict(self):
        days_since = (datetime.now(timezone.utc).replace(tzinfo=None) - self.last_contacted).days if self.last_contacted else None
        
        # Simple rule-based Next-Best-Action
        next_action = "Reach out to introduce services"
        if self.stage == 'Qualified' and self.sentiment == 'Negative':
            next_action = "Schedule checking-in call to address concerns"
        elif self.stage == 'Qualified':
            next_action = "Draft and send proposal"
        elif self.stage == 'Proposal':
            next_action = "Follow up on proposal feedback"
        elif self.stage == 'Closed':
            next_action = "Check in on satisfaction (Post-sale)"

        return {
            'id':             self.id,
            'name':           self.name,
            'email':          self.email,
            'company':        self.company,
            'phone':          self.phone,
            'stage':          self.stage,
            'deal_value':     float(self.deal_value or 0),
            'win_probability':self.win_probability,
            'tags':           self.tags,
            'next_action':    self.next_action if self.next_action else next_action,
            'ai_score':       self.ai_score,
            'sentiment':      self.sentiment,
            'churn_risk':     self.churn_risk,
            'churn_risk_pct': self.churn_risk_pct,
            'last_contacted': self.last_contacted.isoformat() if self.last_contacted else None,
            'days_since_contact': days_since,
            'created_at':     self.created_at.isoformat(),
            'created_date':   self.created_at.strftime('%Y-%m-%d') if self.created_at else None,
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


class FileAttachment(db.Model):
    __tablename__ = 'file_attachments'

    id         = db.Column(db.Integer, primary_key=True)
    lead_id    = db.Column(db.Integer, db.ForeignKey('leads.id', ondelete='CASCADE'), nullable=False)
    filename   = db.Column(db.String(255), nullable=False)
    file_url   = db.Column(db.String(512), nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'lead_id': self.lead_id,
            'filename': self.filename,
            'file_url': self.file_url,
            'created_at': self.created_at.isoformat()
        }


class Segment(db.Model):
    __tablename__ = 'segments'

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    name       = db.Column(db.String(150), nullable=False)
    rules_json = db.Column(db.Text, nullable=False) # JSON defining the segment filters
    created_at = db.Column(db.DateTime, default=datetime.utcnow)
    
    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'rules_json': self.rules_json,
            'created_at': self.created_at.isoformat()
        }


class Campaign(db.Model):
    __tablename__ = 'campaigns'

    id         = db.Column(db.Integer, primary_key=True)
    user_id    = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    name       = db.Column(db.String(150), nullable=False)
    subject    = db.Column(db.String(255))
    body_html  = db.Column(db.Text)
    segment_id = db.Column(db.Integer, db.ForeignKey('segments.id', ondelete='SET NULL'), nullable=True)
    status     = db.Column(db.Enum('Draft', 'Scheduled', 'Sent'), default='Draft')
    type       = db.Column(db.Enum('email', 'sms'), default='email')
    created_at = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'subject': self.subject,
            'body_html': self.body_html,
            'segment_id': self.segment_id,
            'status': self.status,
            'type': self.type,
            'created_at': self.created_at.isoformat()
        }


class Workflow(db.Model):
    __tablename__ = 'workflows'

    id          = db.Column(db.Integer, primary_key=True)
    user_id     = db.Column(db.Integer, db.ForeignKey('users.id', ondelete='CASCADE'), nullable=False)
    name        = db.Column(db.String(150), nullable=False)
    trigger     = db.Column(db.String(100)) # e.g., 'status_change', 'time_delay'
    actions_json = db.Column(db.Text, nullable=False)
    is_active   = db.Column(db.Boolean, default=True)
    created_at  = db.Column(db.DateTime, default=datetime.utcnow)

    def to_dict(self):
        return {
            'id': self.id,
            'user_id': self.user_id,
            'name': self.name,
            'trigger': self.trigger,
            'actions_json': self.actions_json,
            'is_active': self.is_active,
            'created_at': self.created_at.isoformat()
        }


class LeadScoreHistory(db.Model):
    __tablename__ = 'lead_score_history'

    id           = db.Column(db.Integer, primary_key=True)
    lead_id      = db.Column(db.Integer, db.ForeignKey('leads.id', ondelete='CASCADE'), nullable=False)
    score        = db.Column(db.Integer, nullable=False)
    recorded_at  = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)


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


def parse_created_at(value):
    """Parse lead date from YYYY-MM-DD or ISO datetime string."""
    if not value:
        return None

    if isinstance(value, datetime):
        return value

    raw = str(value).strip()
    try:
        return datetime.strptime(raw, '%Y-%m-%d')
    except ValueError:
        try:
            return datetime.fromisoformat(raw.replace('Z', '+00:00')).replace(tzinfo=None)
        except ValueError:
            return None


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


def update_lead_score(lead: Lead) -> int:
    """Recompute a lead score and persist a history row when needed."""
    score = compute_lead_score(lead)
    now = datetime.utcnow()

    last_record = (
        LeadScoreHistory.query.filter_by(lead_id=lead.id)
        .order_by(LeadScoreHistory.recorded_at.desc())
        .first()
    )

    if not last_record or last_record.score != score or last_record.recorded_at.date() != now.date():
        db.session.add(LeadScoreHistory(lead_id=lead.id, score=score, recorded_at=now))

    lead.ai_score = score
    return score


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
            update_lead_score(lead)
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


@app.route('/api/public/leads', methods=['POST'])
def public_create_lead():
    """Endpoint for the public Customer Portal to submit a lead/inquiry."""
    body = request.get_json()
    
    # Assign to first user/admin by default
    first_user = User.query.first()
    owner_id = first_user.id if first_user else None

    lead = Lead(
        user_id    = owner_id,
        name       = body['name'],
        email      = body['email'],
        company    = body.get('company', ''),
        phone      = body.get('phone', ''),
        stage      = 'Lead',
        deal_value = float(body.get('deal_value', 0)),
        created_at = datetime.utcnow(),
        last_contacted = datetime.utcnow(),
    )
    db.session.add(lead)
    db.session.flush()
    update_lead_score(lead)
    lead.churn_risk, lead.churn_risk_pct = compute_churn_risk(lead)

    # Automatically log their message as an interaction if provided
    message = body.get('message', '').strip()
    if message:
        interaction = Interaction(
            lead_id=lead.id,
            channel='note',
            body=message,
            sentiment=analyze_sentiment(message)
        )
        db.session.add(interaction)
        lead.sentiment = interaction.sentiment

    db.session.commit()
    return jsonify({'success': True, 'lead_id': lead.id}), 201


@app.route('/api/public/feedback', methods=['POST'])
def public_feedback():
    """Endpoint for public CSAT and feedback."""
    body = request.get_json()
    
    # Try to find a lead by email to attach the feedback.
    # We take the most recently created lead matching this email.
    email = body.get('email', '').strip()
    lead = Lead.query.filter_by(email=email).order_by(Lead.created_at.desc()).first()
    
    message = f"CSAT Score: {body.get('rating')}/5\nFeedback: {body.get('comments')}"
    sentiment = analyze_sentiment(body.get('comments', ''))

    if lead:
        interaction = Interaction(
            lead_id=lead.id,
            channel='note',
            body=message,
            sentiment=sentiment
        )
        db.session.add(interaction)
        lead.sentiment = sentiment
        update_lead_score(lead)
        db.session.commit()
        return jsonify({'success': True, 'attached_to_lead': lead.id})
    else:
        # If lead wasn't found, we can create a 'Closed' or 'Lead' record for them
        first_user = User.query.first()
        new_lead = Lead(
            user_id = first_user.id if first_user else None,
            name = body.get('name', 'Anonymous Feedback'),
            email = email,
            stage = 'Lead',
            sentiment = sentiment
        )
        db.session.add(new_lead)
        db.session.flush()
        interaction = Interaction(
            lead_id=new_lead.id,
            channel='note',
            body=message,
            sentiment=sentiment
        )
        db.session.add(interaction)
        db.session.commit()
        return jsonify({'success': True, 'created_new_lead': new_lead.id}), 201

# ──────────────────────────────────────────
# ROUTES — LEADS
# ──────────────────────────────────────────

def get_user_id():
    """Helper to extract the logged-in user from frontend headers"""
    user_id = request.headers.get('X-User-Id')
    return int(user_id) if user_id and user_id.isdigit() else None

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.get_json()
    email = data.get('email', '').strip()
    user = User.query.filter_by(email=email).first()
    if user and user.check_password(data.get('password')):
        return jsonify({'user': user.to_dict()}), 200
    return jsonify({'error': 'Invalid email or password'}), 401

@app.route('/api/auth/register', methods=['POST'])
def register():
    data = request.get_json()
    email = data.get('email', '').strip()
    if User.query.filter_by(email=email).first():
        return jsonify({'error': 'Email is already registered'}), 400
        
    user = User(name=data.get('name', '').strip(), email=email, role='Sales Rep')
    user.set_password(data.get('password'))
    db.session.add(user)
    db.session.commit()
    return jsonify({'user': user.to_dict()}), 201

@app.route('/')
def index():
    return "NexCRM API is running! 🚀 Please open http://localhost:3000 in your browser to view the application."


@app.route('/api/leads', methods=['GET'])
def get_leads():
    stage     = request.args.get('stage')
    sentiment = request.args.get('sentiment')
    tags      = request.args.get('tags')
    sort_by   = request.args.get('sort', 'ai_score')   # ai_score | created_at | deal_value
    order     = request.args.get('order', 'desc')

    query = Lead.query.filter_by(user_id=get_user_id())

    if stage:
        query = query.filter_by(stage=stage)
    if sentiment:
        query = query.filter_by(sentiment=sentiment)
    if tags:
        query = query.filter(Lead.tags.like(f"%{tags}%"))

    sort_col = getattr(Lead, sort_by, Lead.ai_score)
    query = query.order_by(sort_col.desc() if order == 'desc' else sort_col.asc())

    leads = query.all()
    return jsonify([l.to_dict() for l in leads])


@app.route('/api/leads/<int:lead_id>', methods=['GET'])
def get_lead(lead_id):
    lead = Lead.query.filter_by(id=lead_id, user_id=get_user_id()).first_or_404()
    data = lead.to_dict()
    data['interactions'] = [i.to_dict() for i in lead.interactions]
    return jsonify(data)


@app.route('/api/leads', methods=['POST'])
def create_lead():
    body = request.get_json()
    created_at = parse_created_at(body.get('created_at'))
    if body.get('created_at') and created_at is None:
        return jsonify({'error': 'created_at must be in YYYY-MM-DD or ISO datetime format'}), 400

    lead = Lead(
        user_id    = get_user_id(),
        name       = body['name'],
        email      = body['email'],
        company    = body.get('company', ''),
        phone      = body.get('phone', ''),
        stage      = body.get('stage', 'Lead'),
        deal_value = body.get('deal_value', 0),
        win_probability = body.get('win_probability', 0),
        tags       = body.get('tags', ''),
        next_action= body.get('next_action', ''),
        created_at = created_at or datetime.utcnow(),
        last_contacted = created_at or datetime.utcnow(),
    )
    db.session.add(lead)
    db.session.flush()   # get lead.id before score computation
    update_lead_score(lead)
    lead.churn_risk, lead.churn_risk_pct = compute_churn_risk(lead)
    db.session.commit()
    return jsonify(lead.to_dict()), 201


@app.route('/api/leads/<int:lead_id>', methods=['PUT'])
def update_lead(lead_id):
    lead = Lead.query.filter_by(id=lead_id, user_id=get_user_id()).first_or_404()
    body = request.get_json()

    for field in ['name', 'email', 'company', 'phone', 'stage', 'deal_value', 'win_probability', 'tags', 'next_action']:
        if field in body:
            setattr(lead, field, body[field])

    if 'created_at' in body:
        parsed_created_at = parse_created_at(body.get('created_at'))
        if body.get('created_at') and parsed_created_at is None:
            return jsonify({'error': 'created_at must be in YYYY-MM-DD or ISO datetime format'}), 400
        if parsed_created_at:
            lead.created_at = parsed_created_at
            lead.last_contacted = parsed_created_at

    # Recalculate AI fields on update
    update_lead_score(lead)
    lead.churn_risk, lead.churn_risk_pct = compute_churn_risk(lead)
    db.session.commit()
    return jsonify(lead.to_dict())


@app.route('/api/leads/<int:lead_id>', methods=['DELETE'])
def delete_lead(lead_id):
    lead = Lead.query.filter_by(id=lead_id, user_id=get_user_id()).first_or_404()
    db.session.delete(lead)
    db.session.commit()
    return jsonify({'message': f'Lead {lead_id} deleted'}), 200


# ──────────────────────────────────────────
# ROUTES — INTERACTIONS
# ──────────────────────────────────────────

@app.route('/api/leads/<int:lead_id>/interactions', methods=['POST'])
def add_interaction(lead_id):
    lead = Lead.query.filter_by(id=lead_id, user_id=get_user_id()).first_or_404()
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
    update_lead_score(lead)
    lead.churn_risk, lead.churn_risk_pct = compute_churn_risk(lead)

    db.session.commit()
    return jsonify(interaction.to_dict()), 201


# ──────────────────────────────────────────
# ROUTES — DASHBOARD & ANALYTICS
# ──────────────────────────────────────────

@app.route('/api/dashboard', methods=['GET'])
def get_dashboard():
    all_leads = Lead.query.filter_by(user_id=get_user_id()).all()

    total_leads     = len(all_leads)
    pipeline_value  = sum(float(l.deal_value or 0) for l in all_leads if l.stage != 'Closed')
    forecasted_value = sum(float(l.deal_value or 0) * (float(l.win_probability or 0) / 100.0) for l in all_leads if l.stage != 'Closed')
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
            'forecasted_value': forecasted_value,
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
        leads = Lead.query.filter_by(stage=stage, user_id=get_user_id()).order_by(Lead.ai_score.desc()).all()
        pipeline[stage] = {
            'leads': [l.to_dict() for l in leads],
            'total_value': sum(float(l.deal_value or 0) for l in leads),
            'count': len(leads),
        }
    return jsonify(pipeline)


@app.route('/api/pipeline/move', methods=['POST'])
def move_pipeline_lead():
    body = request.get_json()
    lead_id = body.get('lead_id')
    new_stage = body.get('new_stage')

    if not lead_id or not new_stage:
        return jsonify({'error': 'Missing lead_id or new_stage'}), 400

    lead = Lead.query.filter_by(id=lead_id, user_id=get_user_id()).first_or_404()
    lead.stage = new_stage
    lead.ai_score = compute_lead_score(lead)
    lead.churn_risk, lead.churn_risk_pct = compute_churn_risk(lead)
    
    db.session.commit()
    return jsonify(lead.to_dict()), 200


@app.route('/api/churn-risk', methods=['GET'])
def get_churn_risk():
    at_risk = Lead.query.filter_by(churn_risk=True, user_id=get_user_id())\
                  .order_by(Lead.churn_risk_pct.desc()).all()
    return jsonify([l.to_dict() for l in at_risk])


@app.route('/api/leads/<int:lead_id>/score-history', methods=['GET'])
def get_score_history(lead_id):
    lead = Lead.query.filter_by(id=lead_id, user_id=get_user_id()).first_or_404()
    history = (
        LeadScoreHistory.query.filter_by(lead_id=lead.id)
        .order_by(LeadScoreHistory.recorded_at.asc())
        .all()
    )
    return jsonify([
        {
            'score': entry.score,
            'date': entry.recorded_at.strftime('%Y-%m-%d'),
            'recorded_at': entry.recorded_at.isoformat(),
        }
        for entry in history
    ])


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
    all_leads = Lead.query.filter_by(user_id=get_user_id()).order_by(Lead.ai_score.desc()).limit(20).all()
    at_risk   = Lead.query.filter_by(churn_risk=True, user_id=get_user_id()).all()

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

    # ── Option C: Gemini ──
    import google.generativeai as genai
    genai.configure(api_key=os.getenv("GEMINI_API_KEY"))
    model = genai.GenerativeModel('gemini-2.5-flash', system_instruction=system_prompt)
    
    gemini_history = []
    for msg in history:
        role = "model" if msg.get("role") == "assistant" else "user"
        gemini_history.append({"role": role, "parts": [msg.get("content", "")]})
        
    chat = model.start_chat(history=gemini_history)
    resp = chat.send_message(user_msg)
    reply = resp.text

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
        update_lead_score(lead)
        lead.churn_risk, lead.churn_risk_pct = compute_churn_risk(lead)

    db.session.commit()
    return jsonify({'message': f'Seeded {len(demo_leads)} demo leads'}), 201


@app.route('/api/leads/<int:lead_id>/files', methods=['GET'])
def get_files(lead_id):
    lead = Lead.query.filter_by(id=lead_id, user_id=get_user_id()).first_or_404()
    return jsonify([f.to_dict() for f in lead.files])

@app.route('/api/leads/<int:lead_id>/files', methods=['POST'])
def add_file(lead_id):
    lead = Lead.query.filter_by(id=lead_id, user_id=get_user_id()).first_or_404()
    body = request.get_json()
    new_file = FileAttachment(
        lead_id=lead_id,
        filename=body.get('filename', 'untitled.txt'),
        file_url=body.get('file_url', 'http://example.com/file.txt')
    )
    db.session.add(new_file)
    db.session.commit()
    return jsonify(new_file.to_dict()), 201

@app.route('/api/segments', methods=['GET', 'POST'])
def handle_segments():
    user_id = get_user_id()
    if request.method == 'GET':
        segments = Segment.query.filter_by(user_id=user_id).all()
        return jsonify([s.to_dict() for s in segments])
    else:
        body = request.get_json()
        seg = Segment(
            user_id=user_id,
            name=body.get('name', 'New Segment'),
            rules_json=body.get('rules_json', '{}')
        )
        db.session.add(seg)
        db.session.commit()
        return jsonify(seg.to_dict()), 201

@app.route('/api/campaigns', methods=['GET', 'POST'])
def handle_campaigns():
    user_id = get_user_id()
    if request.method == 'GET':
        campaigns = Campaign.query.filter_by(user_id=user_id).all()
        return jsonify([c.to_dict() for c in campaigns])
    else:
        body = request.get_json()
        camp = Campaign(
            user_id=user_id,
            name=body.get('name', 'New Campaign'),
            subject=body.get('subject', ''),
            body_html=body.get('body_html', ''),
            segment_id=body.get('segment_id'),
            status='Draft',
            type=body.get('type', 'email')
        )
        db.session.add(camp)
        db.session.commit()
        return jsonify(camp.to_dict()), 201
@app.route('/api/workflows', methods=['GET', 'POST'])
def handle_workflows():
    user_id = get_user_id()
    if request.method == 'GET':
        workflows = Workflow.query.filter_by(user_id=user_id).all()
        return jsonify([w.to_dict() for w in workflows])
    else:
        body = request.get_json()
        wf = Workflow(
            user_id=user_id,
            name=body.get('name', 'New Workflow'),
            trigger=body.get('trigger', 'status_change'),
            actions_json=body.get('actions_json', '{}'),
            is_active=body.get('is_active', True)
        )
        db.session.add(wf)
        db.session.commit()
        return jsonify(wf.to_dict()), 201

@app.route('/api/segments/<int:id>', methods=['PUT', 'DELETE'])
def update_segment(id):
    user_id = get_user_id()
    seg = Segment.query.filter_by(id=id, user_id=user_id).first_or_404()
    if request.method == 'PUT':
        body = request.get_json()
        if 'name' in body: seg.name = body['name']
        if 'rules_json' in body: seg.rules_json = body['rules_json']
        db.session.commit()
        return jsonify(seg.to_dict())
    elif request.method == 'DELETE':
        db.session.delete(seg)
        db.session.commit()
        return jsonify({'success': True}), 200

@app.route('/api/campaigns/<int:id>', methods=['PUT', 'DELETE'])
def update_campaign(id):
    user_id = get_user_id()
    camp = Campaign.query.filter_by(id=id, user_id=user_id).first_or_404()
    if request.method == 'PUT':
        body = request.get_json()
        if 'name' in body: camp.name = body['name']
        if 'subject' in body: camp.subject = body['subject']
        if 'body_html' in body: camp.body_html = body['body_html']
        if 'status' in body: camp.status = body['status']
        if 'segment_id' in body: camp.segment_id = body['segment_id']
        db.session.commit()
        return jsonify(camp.to_dict())
    elif request.method == 'DELETE':
        db.session.delete(camp)
        db.session.commit()
        return jsonify({'success': True}), 200

@app.route('/api/workflows/<int:id>', methods=['PUT', 'DELETE'])
def update_workflow(id):
    user_id = get_user_id()
    wf = Workflow.query.filter_by(id=id, user_id=user_id).first_or_404()
    if request.method == 'PUT':
        body = request.get_json()
        if 'name' in body: wf.name = body['name']
        if 'trigger' in body: wf.trigger = body['trigger']
        if 'actions_json' in body: wf.actions_json = body['actions_json']
        if 'is_active' in body: wf.is_active = body['is_active']
        db.session.commit()
        return jsonify(wf.to_dict())
    elif request.method == 'DELETE':
        db.session.delete(wf)
        db.session.commit()
        return jsonify({'success': True}), 200

if __name__ == '__main__':
    with app.app_context():
        db.create_all()

        # Safely add the new user_id column to the existing leads table
        try:
            db.session.execute(text("ALTER TABLE leads ADD COLUMN user_id INTEGER"))
            db.session.execute(text("ALTER TABLE leads ADD CONSTRAINT fk_lead_user FOREIGN KEY (user_id) REFERENCES users(id)"))
            db.session.commit()
        except Exception:
            db.session.rollback()

        # Ensure the admin user exists so you can log in
        try:
            admin = User.query.filter_by(email='admin@nexcrm.com').first()
            if not admin:
                admin = User(name='Soham', email='admin@nexcrm.com', role='Sales Director')
                db.session.add(admin)
            admin.set_password('password123')
            db.session.commit()

            # Give any unassigned/orphaned leads to the admin account
            Lead.query.filter_by(user_id=None).update({'user_id': admin.id})
            db.session.commit()
        except Exception as e:
            print(f"Startup warning: {e}")

    app.run(debug=True, port=5000)
