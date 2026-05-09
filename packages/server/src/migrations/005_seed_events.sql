-- ============================================================
-- Migration 005: Seed Events
-- ShowUp2Move — preset events for testing
-- ============================================================

DO $$
DECLARE
  captain_id UUID;
  football_id UUID;
  basketball_id UUID;
  tennis_id UUID;
BEGIN
  -- 1. Create a dummy captain user
  INSERT INTO users (email, password_hash)
  VALUES ('preset-captain@example.com', 'fakehash')
  ON CONFLICT (email) DO UPDATE SET email = EXCLUDED.email
  RETURNING id INTO captain_id;

  INSERT INTO profiles (user_id, display_name, bio, is_complete)
  VALUES (captain_id, 'Coach John', 'Event organizer', TRUE)
  ON CONFLICT (user_id) DO NOTHING;

  -- 2. Get sport IDs
  SELECT id INTO football_id FROM sports WHERE name = 'Football';
  SELECT id INTO basketball_id FROM sports WHERE name = 'Basketball';
  SELECT id INTO tennis_id FROM sports WHERE name = 'Tennis';

  -- 3. Insert Preset Events
  INSERT INTO events (
    sport_id, captain_user_id, title, description, venue_name, venue_address,
    venue_lat, venue_lng, start_time, end_time, min_participants, max_participants, is_public, state
  ) VALUES
  (
    football_id, captain_id, 'Saturday Morning Soccer', 'Casual 5v5 soccer match. All skill levels welcome!',
    'Central Park Great Lawn', 'Central Park, NY', 40.7812, -73.9665,
    NOW() + INTERVAL '2 days', NOW() + INTERVAL '2 days' + INTERVAL '2 hours',
    10, 14, TRUE, 'Active'
  ),
  (
    basketball_id, captain_id, 'Downtown Hoops', 'Competitive pickup game.',
    'West 4th Street Courts', 'W 4th St, New York, NY', 40.7310, -74.0010,
    NOW() + INTERVAL '1 day', NOW() + INTERVAL '1 day' + INTERVAL '2 hours',
    6, 10, TRUE, 'Active'
  ),
  (
    tennis_id, captain_id, 'Evening Doubles', 'Looking for two more players for some fun doubles.',
    'Riverside Park Tennis Courts', 'Riverside Park, NY', 40.8143, -73.9620,
    NOW() + INTERVAL '3 days', NOW() + INTERVAL '3 days' + INTERVAL '2 hours',
    4, 4, TRUE, 'Active'
  );

END $$;
