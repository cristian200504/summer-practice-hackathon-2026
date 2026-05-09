-- ============================================================
-- Migration 004: Seed Achievements
-- ShowUp2Move — predefined achievement milestones
-- ============================================================

INSERT INTO achievements (key, title, description)
VALUES
  ('first_event',        'First Event Attended',    'Attended your first sports event'),
  ('five_events',        '5 Events Attended',       'Attended 5 sports events'),
  ('ten_events',         '10 Events Attended',      'Attended 10 sports events'),
  ('first_captain',      'First Captain Role',      'Served as captain for the first time'),
  ('three_sports',       'Played 3 Different Sports', 'Played 3 different sports'),
  ('invited_friend',     'Invited a Friend',        'Invited a friend to join an event')
ON CONFLICT (key) DO NOTHING;
