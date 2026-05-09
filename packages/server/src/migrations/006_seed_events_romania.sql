-- ============================================================
-- Migration 006: Seed Romania Events
-- ShowUp2Move — preset events in Romania for the Discover map
-- ============================================================

DO $$
DECLARE
  captain_id UUID;
  football_id UUID;
  basketball_id UUID;
  tennis_id UUID;
BEGIN
  -- 1. Get or Create a dummy captain user
  INSERT INTO users (email, password_hash)
  VALUES ('romania-captain@example.com', 'fakehash')
  ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
  RETURNING id INTO captain_id;

  INSERT INTO profiles (user_id, display_name, bio, is_complete)
  VALUES (captain_id, 'Captain Romania', 'Romanian Event Organizer', TRUE)
  ON CONFLICT (user_id) DO NOTHING;

  -- 2. Get sport IDs
  SELECT id INTO football_id FROM sports WHERE name = 'Football';
  SELECT id INTO basketball_id FROM sports WHERE name = 'Basketball';
  SELECT id INTO tennis_id FROM sports WHERE name = 'Tennis';

  -- 3. Insert Preset Events in Romania
  INSERT INTO events (
    sport_id, captain_user_id, title, description, venue_name, venue_address,
    venue_lat, venue_lng, start_time, end_time, min_participants, max_participants, is_public, state
  ) VALUES
  (
    football_id, captain_id, 'Bucharest Evening Soccer', 'Casual 5v5 soccer match in Bucharest.',
    'Herastrau Park Football Pitch', 'Bucharest, Romania', 44.4731, 26.0792,
    NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '2 hours',
    10, 14, TRUE, 'Active'
  ),
  (
    basketball_id, captain_id, 'Cluj Central Hoops', 'Competitive pickup game.',
    'Parcul Central', 'Cluj-Napoca, Romania', 46.7712, 23.5901,
    NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '2 hours',
    6, 10, TRUE, 'Active'
  ),
  (
    tennis_id, captain_id, 'Timisoara Doubles', 'Looking for two more players for some fun doubles.',
    'Baza Sportiva Electrica', 'Timisoara, Romania', 45.7489, 21.2087,
    NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '2 hours',
    4, 4, TRUE, 'Active'
  );

END $$;
