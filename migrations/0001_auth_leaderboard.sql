-- Cloudflare D1 Database Schema: Auth, Player Profiles, Stats & Leaderboard
-- Free Tier Optimization: Uses native SQLite B-Tree indexing and window functions.

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  oauth_provider TEXT NOT NULL,              -- 'google' or 'github'
  oauth_sub TEXT NOT NULL,                   -- Provider unique user ID
  alias TEXT NOT NULL,                       -- Player chosen alias (<= 8 chars)
  avatar_url TEXT NOT NULL,                  -- Avatar URL or preset identifier
  email TEXT,                                -- Never exposed publicly
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  last_login INTEGER NOT NULL DEFAULT (unixepoch()),
  UNIQUE(oauth_provider, oauth_sub)
);

CREATE TABLE IF NOT EXISTS player_stats (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  games_played INTEGER NOT NULL DEFAULT 0,
  games_won INTEGER NOT NULL DEFAULT 0,
  total_captures INTEGER NOT NULL DEFAULT 0,
  bonus_finishes INTEGER NOT NULL DEFAULT 0,
  total_score INTEGER NOT NULL DEFAULT 0,
  rating INTEGER NOT NULL DEFAULT 1200,      -- Optional Elo baseline
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

-- Index for instant Top 10 leaderboard ordering
CREATE INDEX IF NOT EXISTS idx_player_stats_score 
ON player_stats(total_score DESC, games_won DESC);

-- Match submissions log to enforce idempotent score submission and prevent replay/tampering
CREATE TABLE IF NOT EXISTS match_submissions (
  match_id TEXT PRIMARY KEY,
  winner_id TEXT REFERENCES users(id),
  player_count INTEGER NOT NULL,
  turns_count INTEGER NOT NULL,
  score_awarded INTEGER NOT NULL,
  submitted_at INTEGER NOT NULL DEFAULT (unixepoch()),
  audit_hash TEXT NOT NULL
);
