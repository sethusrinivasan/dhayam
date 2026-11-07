-- Migration 0002: Add index for leaderboard computer filtering
CREATE INDEX IF NOT EXISTS idx_users_is_computer ON users(is_computer);
