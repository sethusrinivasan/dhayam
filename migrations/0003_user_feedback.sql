-- Migration 0003: Durable User Feedback Table
-- Captures user feedback text, timestamp, user details, IP address, user agent, category, rating, and metadata.

CREATE TABLE IF NOT EXISTS user_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_alias TEXT,
  user_email TEXT,
  ip_address TEXT NOT NULL,
  user_agent TEXT,
  feedback_text TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  rating INTEGER,
  metadata TEXT,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_user_feedback_created ON user_feedback(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_feedback_user ON user_feedback(user_id);
