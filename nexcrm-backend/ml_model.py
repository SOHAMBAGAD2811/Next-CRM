"""
NexCRM — scikit-learn Lead Scoring Model
-----------------------------------------
Train once, then the Flask app loads the pickled model for inference.

Usage:
  python ml_model.py --train          # Train + save model
  python ml_model.py --evaluate       # Evaluate on test split
  python ml_model.py --predict 85 1 3 2  # Quick CLI prediction
"""

import argparse
import pickle
import os
import numpy as np
from datetime import datetime, timedelta

from sklearn.ensemble import GradientBoostingClassifier
from sklearn.preprocessing import LabelEncoder
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report, mean_absolute_error
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler

MODEL_PATH = os.path.join(os.path.dirname(__file__), 'lead_score_model.pkl')

# ──────────────────────────────────────────
# FEATURE ENGINEERING
# ──────────────────────────────────────────

STAGE_MAP     = {'Lead': 0, 'Qualified': 1, 'Proposal': 2, 'Closed': 3}
SENTIMENT_MAP = {'Negative': 0, 'Neutral': 1, 'Positive': 2}

def build_feature_vector(lead_dict: dict) -> list:
    """
    Convert a lead dict (from DB) into a numeric feature vector.
    Features:
      [0] stage_encoded        (0-3)
      [1] sentiment_encoded    (0-2)
      [2] days_since_contact   (int)
      [3] interaction_count    (int)
      [4] deal_value_norm      (float, log-scaled)
      [5] has_phone            (0/1)
      [6] has_company          (0/1)
    """
    stage     = STAGE_MAP.get(lead_dict.get('stage', 'Lead'), 0)
    sentiment = SENTIMENT_MAP.get(lead_dict.get('sentiment', 'Neutral'), 1)
    days      = lead_dict.get('days_since_contact', 30) or 30
    icount    = lead_dict.get('interaction_count', 0) or 0
    value     = float(lead_dict.get('deal_value', 0) or 0)
    value_log = np.log1p(value)
    has_phone   = 1 if lead_dict.get('phone') else 0
    has_company = 1 if lead_dict.get('company') else 0

    return [stage, sentiment, days, icount, value_log, has_phone, has_company]


# ──────────────────────────────────────────
# SYNTHETIC TRAINING DATA GENERATOR
# (Replace with real historical data from your DB)
# ──────────────────────────────────────────

def generate_training_data(n_samples: int = 2000):
    """
    Generate synthetic labeled training data.

    In production: replace this with a SQL query that pulls historical leads
    with their known final ai_score or conversion outcome.

    Example real query:
        SELECT stage, sentiment, DATEDIFF(NOW(), last_contacted) as days_since,
               (SELECT COUNT(*) FROM interactions WHERE lead_id=l.id) as icount,
               deal_value, phone IS NOT NULL as has_phone,
               company IS NOT NULL as has_company,
               ai_score as label
        FROM leads l
        WHERE ai_score IS NOT NULL
    """
    rng = np.random.default_rng(42)
    X, y = [], []

    for _ in range(n_samples):
        stage     = rng.integers(0, 4)
        sentiment = rng.integers(0, 3)
        days      = rng.integers(0, 90)
        icount    = rng.integers(0, 20)
        value_log = rng.uniform(0, 15)
        has_phone = rng.integers(0, 2)
        has_co    = rng.integers(0, 2)

        # Simulate realistic score distribution
        base = stage * 20
        base += sentiment * 5
        base -= min(days // 7, 15)
        base += min(icount * 2, 10)
        base += value_log * 1.5
        base += has_phone * 3 + has_co * 2
        base += rng.normal(0, 8)  # noise
        score = int(np.clip(base, 0, 100))

        X.append([stage, sentiment, days, icount, value_log, has_phone, has_co])
        y.append(score)

    return np.array(X), np.array(y)


# ──────────────────────────────────────────
# TRAIN
# ──────────────────────────────────────────

def train():
    print("Generating training data...")
    X, y = generate_training_data(n_samples=3000)

    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42
    )

    print(f"Training on {len(X_train)} samples...")
    model = Pipeline([
        ('scaler', StandardScaler()),
        ('gb', GradientBoostingClassifier(
            n_estimators=200,
            max_depth=4,
            learning_rate=0.08,
            subsample=0.8,
            random_state=42
        ))
    ])

    # Bin scores into 10-point buckets for classification, then scale back
    y_train_binned = (y_train // 10).astype(int)
    model.fit(X_train, y_train_binned)

    # Evaluate
    y_test_binned = (y_test // 10).astype(int)
    y_pred_binned = model.predict(X_test)
    y_pred_scores = np.clip(y_pred_binned * 10 + 5, 0, 100)
    mae = mean_absolute_error(y_test, y_pred_scores)
    print(f"MAE on test set: {mae:.2f} points")

    # Save model
    with open(MODEL_PATH, 'wb') as f:
        pickle.dump(model, f)
    print(f"Model saved → {MODEL_PATH}")
    return model


# ──────────────────────────────────────────
# INFERENCE (used by Flask app)
# ──────────────────────────────────────────

_model_cache = None

def load_model():
    global _model_cache
    if _model_cache is None:
        if not os.path.exists(MODEL_PATH):
            print("[ML] No model found — training now...")
            _model_cache = train()
        else:
            with open(MODEL_PATH, 'rb') as f:
                _model_cache = pickle.load(f)
    return _model_cache


def predict_score(lead_dict: dict) -> int:
    """
    Predict lead score (0–100) from a lead dict.
    Falls back to rule-based scoring if model fails.
    """
    try:
        model = load_model()
        features = np.array([build_feature_vector(lead_dict)])
        binned = model.predict(features)[0]
        score = int(np.clip(binned * 10 + 5, 0, 100))
        return score
    except Exception as e:
        print(f"[ML] Prediction failed ({e}), using rule-based fallback")
        return _rule_based_fallback(lead_dict)


def _rule_based_fallback(lead_dict: dict) -> int:
    """Simple rule-based fallback if the ML model isn't ready."""
    score = STAGE_MAP.get(lead_dict.get('stage', 'Lead'), 0) * 20
    score += SENTIMENT_MAP.get(lead_dict.get('sentiment', 'Neutral'), 1) * 5
    days = lead_dict.get('days_since_contact', 30) or 30
    score -= min(days // 7, 15)
    value = float(lead_dict.get('deal_value', 0) or 0)
    score += min(int(np.log1p(value) * 2), 20)
    return int(np.clip(score, 0, 100))


# ──────────────────────────────────────────
# CLI ENTRYPOINT
# ──────────────────────────────────────────

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='NexCRM Lead Score ML Model')
    parser.add_argument('--train',    action='store_true', help='Train and save model')
    parser.add_argument('--evaluate', action='store_true', help='Evaluate model performance')
    parser.add_argument('--predict',  nargs='+', type=float,
                        metavar=('STAGE', 'SENTIMENT', 'DAYS', 'INTERACTIONS'),
                        help='Quick prediction: stage(0-3) sentiment(0-2) days interactions')
    args = parser.parse_args()

    if args.train:
        train()

    elif args.evaluate:
        X, y = generate_training_data(n_samples=500)
        model = load_model()
        y_binned = (y // 10).astype(int)
        y_pred   = model.predict(X)
        y_pred_s = np.clip(y_pred * 10 + 5, 0, 100)
        print(f"MAE: {mean_absolute_error(y, y_pred_s):.2f}")
        print(classification_report(y_binned, y_pred, target_names=[f'{i*10}-{i*10+9}' for i in range(11)]))

    elif args.predict:
        vals = args.predict
        lead = {
            'stage':             ['Lead','Qualified','Proposal','Closed'][int(vals[0])] if len(vals) > 0 else 'Lead',
            'sentiment':         ['Negative','Neutral','Positive'][int(vals[1])] if len(vals) > 1 else 'Neutral',
            'days_since_contact': int(vals[2]) if len(vals) > 2 else 7,
            'interaction_count':  int(vals[3]) if len(vals) > 3 else 2,
            'deal_value':         float(vals[4]) if len(vals) > 4 else 100000,
        }
        score = predict_score(lead)
        print(f"Predicted AI Score: {score}/100 for lead: {lead}")

    else:
        parser.print_help()
