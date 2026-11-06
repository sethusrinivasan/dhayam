-- Migration 0002: Add is_computer column to users table and index for leaderboard filtering
ALTER TABLE users ADD COLUMN is_computer INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS idx_users_is_computer ON users(is_computer);
