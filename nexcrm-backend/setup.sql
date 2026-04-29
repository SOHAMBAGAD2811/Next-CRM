-- ============================================================
-- NexCRM — MySQL Database Setup
-- Run this ONCE before starting the Flask backend
-- ============================================================

-- 1. Create the database
CREATE DATABASE IF NOT EXISTS nexcrm
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE nexcrm;

-- 2. Create a dedicated user (change password!)
CREATE USER IF NOT EXISTS 'nexcrm_user'@'localhost' IDENTIFIED BY 'StrongPassword123!';
GRANT ALL PRIVILEGES ON nexcrm.* TO 'nexcrm_user'@'localhost';
FLUSH PRIVILEGES;

-- 3. Tables are auto-created by SQLAlchemy (db.create_all())
--    but you can also create them manually here:

CREATE TABLE IF NOT EXISTS users (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    name            VARCHAR(120)    NOT NULL,
    email           VARCHAR(200)    NOT NULL UNIQUE,
    password_hash   VARCHAR(256)    NOT NULL,
    role            VARCHAR(50)     DEFAULT 'Sales Rep',
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS leads (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    user_id         INT,
    name            VARCHAR(120)    NOT NULL,
    email           VARCHAR(200)    NOT NULL UNIQUE,
    company         VARCHAR(150),
    phone           VARCHAR(20),
    stage           ENUM('Lead','Qualified','Proposal','Closed') DEFAULT 'Lead',
    deal_value      DECIMAL(12,2)   DEFAULT 0,
    win_probability INT             DEFAULT 0,
    tags            VARCHAR(255)    DEFAULT '',
    next_action     VARCHAR(255)    DEFAULT '',

    -- AI computed
    ai_score        INT             DEFAULT 0,
    sentiment       ENUM('Positive','Neutral','Negative') DEFAULT 'Neutral',
    churn_risk      BOOLEAN         DEFAULT FALSE,
    churn_risk_pct  INT             DEFAULT 0,

    last_contacted  DATETIME        DEFAULT CURRENT_TIMESTAMP,
    created_at      DATETIME        DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_stage     (stage),
    INDEX idx_ai_score  (ai_score DESC),
    INDEX idx_churn     (churn_risk),
    INDEX idx_user_id   (user_id)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS interactions (
    id          INT AUTO_INCREMENT PRIMARY KEY,
    lead_id     INT         NOT NULL,
    channel     ENUM('email','chat','call','note') DEFAULT 'email',
    body        TEXT,
    sentiment   ENUM('Positive','Neutral','Negative') DEFAULT 'Neutral',
    created_at  DATETIME    DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    INDEX idx_lead_id (lead_id)
) ENGINE=InnoDB;


CREATE TABLE IF NOT EXISTS lead_score_history (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    lead_id         INT         NOT NULL,
    score           INT         NOT NULL,
    recorded_at     DATETIME     DEFAULT CURRENT_TIMESTAMP,

    FOREIGN KEY (lead_id) REFERENCES leads(id) ON DELETE CASCADE,
    INDEX idx_lead_score_history_lead_id (lead_id),
    INDEX idx_lead_score_history_recorded_at (recorded_at)
) ENGINE=InnoDB;


-- ============================================================
-- USEFUL QUERIES FOR DEBUGGING
-- ============================================================

-- View all leads sorted by AI score:
-- SELECT name, company, stage, ai_score, sentiment, churn_risk_pct FROM leads ORDER BY ai_score DESC;

-- View at-risk accounts:
-- SELECT name, company, churn_risk_pct, last_contacted FROM leads WHERE churn_risk = 1 ORDER BY churn_risk_pct DESC;

-- Pipeline value by stage:
-- SELECT stage, COUNT(*) as count, SUM(deal_value) as total_value FROM leads GROUP BY stage;

-- Dormant leads (no contact in 30+ days):
-- SELECT name, email, last_contacted, DATEDIFF(NOW(), last_contacted) AS days_dormant
--   FROM leads WHERE last_contacted < DATE_SUB(NOW(), INTERVAL 30 DAY);
