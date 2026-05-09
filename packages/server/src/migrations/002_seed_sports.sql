-- ============================================================
-- Migration 002: Seed Sports
-- ShowUp2Move — predefined sports with group-size constraints
-- ============================================================

INSERT INTO sports (name, min_group_size, max_group_size, is_team_sport)
VALUES
  ('Football',     10,  14, TRUE),
  ('Basketball',    6,  10, TRUE),
  ('Tennis',        2,   4, FALSE),
  ('Volleyball',    6,  12, TRUE),
  ('Badminton',     2,   4, FALSE),
  ('Running',       2,  20, FALSE),
  ('Cycling',       2,  20, FALSE),
  ('Swimming',      2,  10, FALSE),
  ('Table Tennis',  2,   4, FALSE),
  ('Rugby',        10,  16, TRUE)
ON CONFLICT (name) DO NOTHING;
