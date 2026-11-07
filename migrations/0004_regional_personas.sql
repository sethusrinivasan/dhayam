-- Migration 0004: Durable Regional Personas Table for Leaderboard Fallbacks & Regionally Aligned Personas
-- Frugal D1 Storage: stores regionally appropriate personas so the system is self-contained with zero 3rd party APIs.

CREATE TABLE IF NOT EXISTS regional_personas (
  id TEXT PRIMARY KEY,
  region TEXT NOT NULL,
  alias TEXT NOT NULL,
  avatar_url TEXT NOT NULL,
  archetype TEXT NOT NULL,
  gender TEXT NOT NULL,
  total_score INTEGER NOT NULL,
  games_won INTEGER NOT NULL,
  games_played INTEGER NOT NULL,
  total_captures INTEGER NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_regional_personas_region ON regional_personas(region, total_score DESC);

-- Seed regional personas across regions (North America, South Asia, Southeast Asia, Global)
INSERT OR IGNORE INTO regional_personas (id, region, alias, avatar_url, archetype, gender, total_score, games_won, games_played, total_captures)
VALUES
  -- North America
  ('na_liam', 'northAmerica', 'Liam', '🪔', 'Aggressive', 'M', 524, 5, 7, 9),
  ('na_emma', 'northAmerica', 'Emma', '🪷', 'Balanced', 'F', 462, 4, 6, 8),
  ('na_noah', 'northAmerica', 'Noah', '🦅', 'Tactical', 'M', 415, 4, 5, 6),
  ('na_olivia', 'northAmerica', 'Olivia', '🌺', 'Cautious', 'F', 358, 3, 5, 5),
  ('na_ethan', 'northAmerica', 'Ethan', '⚡', 'Aggressive', 'M', 312, 3, 4, 4),
  ('na_sophia', 'northAmerica', 'Sophia', '🌾', 'Balanced', 'F', 276, 2, 4, 4),
  ('na_mason', 'northAmerica', 'Mason', '🏹', 'Tactical', 'M', 228, 2, 3, 3),
  ('na_maya', 'northAmerica', 'Maya', '🦚', 'Cautious', 'F', 184, 1, 3, 2),
  ('na_logan', 'northAmerica', 'Logan', '🐅', 'Aggressive', 'M', 142, 1, 2, 2),
  ('na_harper', 'northAmerica', 'Harper', '🐆', 'Balanced', 'F', 95, 1, 2, 1),

  -- South Asia
  ('sa_kavitha', 'southAsia', 'Kavitha', '🪷', 'Aggressive', 'F', 524, 5, 7, 9),
  ('sa_murugan', 'southAsia', 'Murugan', '🪔', 'Balanced', 'M', 462, 4, 6, 8),
  ('sa_ananya', 'southAsia', 'Ananya', '🌺', 'Tactical', 'F', 415, 4, 5, 6),
  ('sa_kavin', 'southAsia', 'Kavin', '⚡', 'Cautious', 'M', 358, 3, 5, 5),
  ('sa_rani', 'southAsia', 'Rani', '🐆', 'Aggressive', 'F', 312, 3, 4, 4),
  ('sa_arjun', 'southAsia', 'Arjun', '🏹', 'Balanced', 'M', 276, 2, 4, 4),
  ('sa_meera', 'southAsia', 'Meera', '🦚', 'Tactical', 'F', 228, 2, 3, 3),
  ('sa_mani', 'southAsia', 'Mani', '🐅', 'Cautious', 'M', 184, 1, 3, 2),
  ('sa_selvi', 'southAsia', 'Selvi', '🌾', 'Aggressive', 'F', 142, 1, 2, 2),
  ('sa_vikram', 'southAsia', 'Vikram', '🦅', 'Balanced', 'M', 95, 1, 2, 1),

  -- Southeast Asia
  ('sea_siva', 'southeastAsia', 'Siva', '🪔', 'Aggressive', 'M', 524, 5, 7, 9),
  ('sea_geetha', 'southeastAsia', 'Geetha', '🪷', 'Balanced', 'F', 462, 4, 6, 8),
  ('sea_wei', 'southeastAsia', 'Wei', '🦅', 'Tactical', 'M', 415, 4, 5, 6),
  ('sea_malar', 'southeastAsia', 'Malar', '🌺', 'Cautious', 'F', 358, 3, 5, 5),
  ('sea_kavi', 'southeastAsia', 'Kavi', '⚡', 'Aggressive', 'M', 312, 3, 4, 4),
  ('sea_nur', 'southeastAsia', 'Nur', '🌾', 'Balanced', 'F', 276, 2, 4, 4),
  ('sea_dinesh', 'southeastAsia', 'Dinesh', '🏹', 'Tactical', 'M', 228, 2, 3, 3),
  ('sea_mei', 'southeastAsia', 'Mei', '🦚', 'Cautious', 'F', 184, 1, 3, 2),
  ('sea_kumaran', 'southeastAsia', 'Kumaran', '🐅', 'Aggressive', 'M', 142, 1, 2, 2),
  ('sea_malaya', 'southeastAsia', 'Malaya', '🐆', 'Balanced', 'F', 95, 1, 2, 1),

  -- Global
  ('gl_kai', 'global', 'Kai', '🪔', 'Aggressive', 'M', 524, 5, 7, 9),
  ('gl_chloe', 'global', 'Chloe', '🪷', 'Balanced', 'F', 462, 4, 6, 8),
  ('gl_gabriel', 'global', 'Gabriel', '🦅', 'Tactical', 'M', 415, 4, 5, 6),
  ('gl_elena', 'global', 'Elena', '🌺', 'Cautious', 'F', 358, 3, 5, 5),
  ('gl_lucas', 'global', 'Lucas', '⚡', 'Aggressive', 'M', 312, 3, 4, 4),
  ('gl_amara', 'global', 'Amara', '🌾', 'Balanced', 'F', 276, 2, 4, 4),
  ('gl_leo', 'global', 'Leo', '🏹', 'Tactical', 'M', 228, 2, 3, 3),
  ('gl_maya', 'global', 'Maya', '🦚', 'Cautious', 'F', 184, 1, 3, 2),
  ('gl_felix', 'global', 'Felix', '🐅', 'Aggressive', 'M', 142, 1, 2, 2),
  ('gl_zara', 'global', 'Zara', '🐆', 'Balanced', 'F', 95, 1, 2, 1);
