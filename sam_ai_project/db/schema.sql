-- Sam AI Voice Assistant — Optional PostgreSQL Database Schema
-- Designed for Serverless Postgres (e.g., Neon, Supabase, AWS RDS Aurora)
--
-- PRIVACY NOTICE:
-- This database is STRICTLY OPTIONAL and disabled by default.
-- Data is only stored when DATABASE_URL is configured AND the user opts in
-- via the "Help improve Sam" consent toggle in the client settings.
-- No PII (names, IP addresses, emails) is ever collected.

CREATE TABLE IF NOT EXISTS conversations (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64),
    role VARCHAR(16) NOT NULL CHECK (role IN ('user', 'assistant')),
    text TEXT NOT NULL,
    intent VARCHAR(32) CHECK (intent IN ('time', 'open_site', 'search', 'chat')),
    confidence REAL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS feedback (
    id BIGSERIAL PRIMARY KEY,
    session_id VARCHAR(64),
    text TEXT NOT NULL,
    predicted_intent VARCHAR(32) NOT NULL CHECK (predicted_intent IN ('time', 'open_site', 'search', 'chat')),
    correct_intent VARCHAR(32) CHECK (correct_intent IS NULL OR correct_intent IN ('time', 'open_site', 'search', 'chat')),
    helpful BOOLEAN NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Performance indexes for analytics and export queries
CREATE INDEX IF NOT EXISTS idx_conversations_session ON conversations (session_id);
CREATE INDEX IF NOT EXISTS idx_conversations_created_at ON conversations (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_feedback_helpful ON feedback (helpful);
