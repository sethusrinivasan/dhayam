-- Migration 0005: Seed European / French Personas into regional_personas table
-- Provides authentic Francophone / Western European common names for French visitors and VPNs.

INSERT OR IGNORE INTO regional_personas (id, region, alias, avatar_url, archetype, gender, total_score, games_won, games_played, total_captures)
VALUES
  ('eu_antoine', 'europe', 'Antoine', '🪔', 'Aggressive', 'M', 524, 5, 7, 9),
  ('eu_camille', 'europe', 'Camille', '🪷', 'Balanced', 'F', 462, 4, 6, 8),
  ('eu_louis', 'europe', 'Louis', '🦅', 'Tactical', 'M', 415, 4, 5, 6),
  ('eu_manon', 'europe', 'Manon', '🌺', 'Cautious', 'F', 358, 3, 5, 5),
  ('eu_julien', 'europe', 'Julien', '⚡', 'Aggressive', 'M', 312, 3, 4, 4),
  ('eu_elodie', 'europe', 'Elodie', '🌾', 'Balanced', 'F', 276, 2, 4, 4),
  ('eu_theo', 'europe', 'Theo', '🏹', 'Tactical', 'M', 228, 2, 3, 3),
  ('eu_ines', 'europe', 'Ines', '🦚', 'Cautious', 'F', 184, 1, 3, 2),
  ('eu_maxime', 'europe', 'Maxime', '🐅', 'Aggressive', 'M', 142, 1, 2, 2),
  ('eu_clara', 'europe', 'Clara', '🐆', 'Balanced', 'F', 95, 1, 2, 1);
