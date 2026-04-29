# NexCRM — AI-Powered CRM

**Stack:** Next.js (frontend) · Flask + SQLAlchemy (backend) · MySQL · Redis + Celery · VADER NLP · Gemini AI

For an end-to-end explanation of the application flow, see [PROJECT_FLOW.md](PROJECT_FLOW.md).

---

## Quick Start

### 1. MySQL Setup

```bash
# Login to MySQL as root
mysql -u root -p

# Run the setup script
source setup.sql
```

Or manually:
```sql
CREATE DATABASE nexcrm CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'nexcrm_user'@'localhost' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON nexcrm.* TO 'nexcrm_user'@'localhost';
FLUSH PRIVILEGES;
```

---

### 2. Backend Setup

```bash
cd nexcrm-backend

# Create a virtual environment
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Configure environment
cp .env.example .env
# Edit .env with your DB credentials

# Start Flask (creates tables automatically)
python app.py
```

Backend runs at: **http://localhost:5000**

---

### 3. Seed Demo Data

```bash
curl -X POST http://localhost:5000/api/admin/seed
```

---

### 4. Start Celery Worker (background AI tasks)

```bash
# In a separate terminal (venv activated)
celery -A app.celery worker --loglevel=info

# Optional: Celery Beat for scheduled tasks (nightly score refresh)
celery -A app.celery beat --loglevel=info
```

---

### 5. Frontend Setup (Next.js)

```bash
cd nexcrm-frontend
npm install
npm run dev
```

Frontend runs at: **http://localhost:3000**

Update `NEXT_PUBLIC_API_URL=http://localhost:5000` in your frontend `.env.local`.

---

## API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET    | `/api/leads` | All leads (supports `?stage=`, `?sentiment=`, `?sort=`) |
| POST   | `/api/leads` | Create new lead |
| GET    | `/api/leads/:id` | Lead detail + interaction history |
| GET    | `/api/leads/:id/score-history` | Time-series score history for charts |
| PUT    | `/api/leads/:id` | Update lead (AI score auto-recalculates) |
| DELETE | `/api/leads/:id` | Delete lead |
| POST   | `/api/leads/:id/interactions` | Log interaction + run sentiment analysis |
| GET    | `/api/dashboard` | KPIs, sentiment dist, top leads, at-risk list |
| GET    | `/api/pipeline` | Kanban data grouped by stage |
| GET    | `/api/churn-risk` | At-risk accounts sorted by risk % |
| POST   | `/api/assistant/chat` | AI assistant chat (connect OpenAI/Ollama) |
| POST   | `/api/admin/seed` | Seed demo data (run once) |
| POST   | `/api/admin/refresh-scores` | Manually trigger AI score recalculation |
| POST   | `/api/admin/trigger-reengagement` | Queue re-engagement emails for dormant leads |

---

## AI Engine

### Lead Scoring (0–100)
Computed in `compute_lead_score()` using:
- Pipeline stage weight (10–50 pts)
- Deal value (up to 20 pts)
- Sentiment signal (up to 15 pts)
- Interaction volume (up to 15 pts)
- Days since last contact (up to 10 pts)

*Note: Scores are logged historically to the `lead_score_history` table to track daily momentum.*

**To use ML model instead:** Train a scikit-learn `RandomForestClassifier` or `GradientBoostingClassifier` on your historical conversion data, pickle it, and replace the rule-based function.

### Sentiment Analysis
Uses **VADER** (Valence Aware Dictionary and sEntiment Reasoner) — runs locally, no API key needed. Feed it email/chat text via `POST /api/leads/:id/interactions`.

### Churn Prediction
Rule-based (days dormant + sentiment + score). Replace with a trained model on your historical churn data.

### AI Assistant
Connect either:
- **OpenAI**: Uncomment `openai` lines in `app.py` + add `OPENAI_API_KEY` to `.env`
- **Ollama** (local/free): Run `ollama pull llama3`, uncomment Ollama lines in `app.py`

---

## Project Structure

```
nexcrm-backend/
├── app.py              ← Main Flask app (models, routes, AI logic)
├── setup.sql           ← MySQL database setup script
├── requirements.txt    ← Python dependencies
├── .env.example        ← Environment variable template
└── README.md

nexcrm-frontend/        ← Next.js 14 app (connect to API above)
├── app/
│   ├── page.tsx        ← Dashboard
│   ├── leads/          ← Lead scoring table
│   ├── pipeline/       ← Kanban board
│   ├── churn/          ← Churn risk radar
│   └── assistant/      ← AI chat interface
└── .env.local          ← NEXT_PUBLIC_API_URL=http://localhost:5000
```

---

## Roadmap (from PRD)

- [x] Phase 1: Core CRM + AI scoring + sentiment + churn + assistant
- [ ] Phase 2: WhatsApp Business API integration
- [ ] Phase 3: A/B testing for AI-generated email subject lines
- [ ] Phase 4: Google Workspace + Slack real-time alerts
