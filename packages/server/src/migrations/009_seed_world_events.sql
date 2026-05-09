-- ============================================================
-- Migration 009: Seed World Events
-- 50 events across 6 continents using the fake users as captains.
-- ============================================================

DO $$
DECLARE
  -- Sport IDs
  football_id    UUID;
  basketball_id  UUID;
  tennis_id      UUID;
  volleyball_id  UUID;
  badminton_id   UUID;
  running_id     UUID;
  cycling_id     UUID;
  swimming_id    UUID;
  tabletennis_id UUID;
  rugby_id       UUID;

  -- Captain IDs (from migration 008)
  u01 UUID := 'a1000001-0000-0000-0000-000000000001';
  u02 UUID := 'a1000001-0000-0000-0000-000000000002';
  u03 UUID := 'a1000001-0000-0000-0000-000000000003';
  u04 UUID := 'a1000001-0000-0000-0000-000000000004';
  u05 UUID := 'a1000001-0000-0000-0000-000000000005';
  u06 UUID := 'a1000001-0000-0000-0000-000000000006';
  u07 UUID := 'a1000001-0000-0000-0000-000000000007';
  u08 UUID := 'a1000001-0000-0000-0000-000000000008';
  u09 UUID := 'a1000001-0000-0000-0000-000000000009';
  u10 UUID := 'a1000001-0000-0000-0000-000000000010';
  u11 UUID := 'a1000001-0000-0000-0000-000000000011';
  u12 UUID := 'a1000001-0000-0000-0000-000000000012';
  u13 UUID := 'a1000001-0000-0000-0000-000000000013';
  u14 UUID := 'a1000001-0000-0000-0000-000000000014';
  u15 UUID := 'a1000001-0000-0000-0000-000000000015';
  u16 UUID := 'a1000001-0000-0000-0000-000000000016';
  u17 UUID := 'a1000001-0000-0000-0000-000000000017';
  u18 UUID := 'a1000001-0000-0000-0000-000000000018';
  u19 UUID := 'a1000001-0000-0000-0000-000000000019';
  u20 UUID := 'a1000001-0000-0000-0000-000000000020';

BEGIN
  SELECT id INTO football_id    FROM sports WHERE name = 'Football';
  SELECT id INTO basketball_id  FROM sports WHERE name = 'Basketball';
  SELECT id INTO tennis_id      FROM sports WHERE name = 'Tennis';
  SELECT id INTO volleyball_id  FROM sports WHERE name = 'Volleyball';
  SELECT id INTO badminton_id   FROM sports WHERE name = 'Badminton';
  SELECT id INTO running_id     FROM sports WHERE name = 'Running';
  SELECT id INTO cycling_id     FROM sports WHERE name = 'Cycling';
  SELECT id INTO swimming_id    FROM sports WHERE name = 'Swimming';
  SELECT id INTO tabletennis_id FROM sports WHERE name = 'Table Tennis';
  SELECT id INTO rugby_id       FROM sports WHERE name = 'Rugby';

  INSERT INTO events (
    sport_id, captain_user_id, title, description,
    venue_name, venue_address, venue_lat, venue_lng,
    start_time, end_time,
    min_participants, max_participants, is_public, state
  ) VALUES

  -- ── EUROPE ────────────────────────────────────────────────────────────────

  (football_id, u01,
   'Hyde Park Sunday Football', 'Casual 11-a-side on the grass. All levels welcome.',
   'Hyde Park', 'London, United Kingdom', 51.5074, -0.1657,
   NOW()+INTERVAL '1 day', NOW()+INTERVAL '1 day 2 hours', 10, 14, TRUE, 'Active'),

  (cycling_id, u04,
   'Paris Morning Ride', 'Group ride along the Seine — 40 km, moderate pace.',
   'Pont de Bir-Hakeim', 'Paris, France', 48.8534, 2.2895,
   NOW()+INTERVAL '2 days', NOW()+INTERVAL '2 days 3 hours', 4, 20, TRUE, 'Active'),

  (tennis_id, u03,
   'Berlin Doubles Afternoon', 'Looking for two more for a friendly doubles set.',
   'Volkspark Friedrichshain', 'Berlin, Germany', 52.5244, 13.4305,
   NOW()+INTERVAL '3 days', NOW()+INTERVAL '3 days 2 hours', 2, 4, TRUE, 'Active'),

  (running_id, u06,
   'Amsterdam Canal Run', '10 km run along the historic canals. Flat and fast.',
   'Vondelpark', 'Amsterdam, Netherlands', 52.3579, 4.8686,
   NOW()+INTERVAL '4 days', NOW()+INTERVAL '4 days 1 hour', 5, 20, TRUE, 'Active'),

  (basketball_id, u02,
   'Barcelona Street Hoops', 'Pickup 3v3 on the outdoor courts. Bring your A-game.',
   'Parc de la Ciutadella', 'Barcelona, Spain', 41.3888, 2.1860,
   NOW()+INTERVAL '2 days', NOW()+INTERVAL '2 days 2 hours', 6, 10, TRUE, 'Active'),

  (volleyball_id, u05,
   'Rome Beach Volleyball', 'Sand volleyball at the Lido. Sunscreen recommended.',
   'Lido di Ostia', 'Rome, Italy', 41.7333, 12.2333,
   NOW()+INTERVAL '5 days', NOW()+INTERVAL '5 days 2 hours', 6, 12, TRUE, 'Active'),

  (swimming_id, u10,
   'Vienna Open Water Swim', '2 km open water swim in the Alte Donau.',
   'Alte Donau', 'Vienna, Austria', 48.2400, 16.4300,
   NOW()+INTERVAL '6 days', NOW()+INTERVAL '6 days 1 hour', 4, 10, TRUE, 'Active'),

  (rugby_id, u08,
   'Dublin Saturday Rugby', 'Full contact 15-a-side. Experienced players only.',
   'Lansdowne Road Park', 'Dublin, Ireland', 53.3344, -6.2286,
   NOW()+INTERVAL '3 days', NOW()+INTERVAL '3 days 2 hours', 10, 16, TRUE, 'Active'),

  (badminton_id, u11,
   'Stockholm Badminton Night', 'Indoor doubles at the community centre.',
   'Eriksdalsbadet', 'Stockholm, Sweden', 59.3100, 18.0700,
   NOW()+INTERVAL '1 day', NOW()+INTERVAL '1 day 2 hours', 2, 4, TRUE, 'Active'),

  (tabletennis_id, u07,
   'Warsaw Table Tennis League', 'Round-robin tournament, 8 players max.',
   'Centrum Sportu Varsovia', 'Warsaw, Poland', 52.2297, 21.0122,
   NOW()+INTERVAL '4 days', NOW()+INTERVAL '4 days 3 hours', 4, 8, TRUE, 'Active'),

  -- ── NORTH AMERICA ─────────────────────────────────────────────────────────

  (basketball_id, u13,
   'NYC Central Park Hoops', 'Competitive pickup game. Winners stay on.',
   'Central Park Courts', 'New York, USA', 40.7851, -73.9683,
   NOW()+INTERVAL '1 day', NOW()+INTERVAL '1 day 2 hours', 6, 10, TRUE, 'Active'),

  (running_id, u14,
   'LA Griffith Park Trail Run', '8 km trail run with city views. Moderate difficulty.',
   'Griffith Park', 'Los Angeles, USA', 34.1341, -118.3215,
   NOW()+INTERVAL '2 days', NOW()+INTERVAL '2 days 1 hour 30 minutes', 5, 20, TRUE, 'Active'),

  (football_id, u09,
   'Chicago Lakefront Soccer', 'Friendly 7-a-side on the lakefront grass.',
   'Montrose Beach', 'Chicago, USA', 41.9650, -87.6380,
   NOW()+INTERVAL '3 days', NOW()+INTERVAL '3 days 2 hours', 10, 14, TRUE, 'Active'),

  (cycling_id, u12,
   'San Francisco Bay Trail Ride', '50 km coastal ride. Bring lights — starts at dawn.',
   'Embarcadero', 'San Francisco, USA', 37.7955, -122.3937,
   NOW()+INTERVAL '5 days', NOW()+INTERVAL '5 days 4 hours', 4, 20, TRUE, 'Active'),

  (tennis_id, u20,
   'Miami Singles Tournament', 'Round-robin singles. Intermediate to advanced.',
   'Flamingo Park Tennis', 'Miami, USA', 25.7825, -80.1394,
   NOW()+INTERVAL '6 days', NOW()+INTERVAL '6 days 3 hours', 4, 8, TRUE, 'Active'),

  (volleyball_id, u17,
   'Toronto Beach Volleyball', 'Casual 6v6 on the sand. Beginners welcome.',
   'Woodbine Beach', 'Toronto, Canada', 43.6614, -79.3070,
   NOW()+INTERVAL '2 days', NOW()+INTERVAL '2 days 2 hours', 6, 12, TRUE, 'Active'),

  (swimming_id, u10,
   'Vancouver Outdoor Pool Swim', 'Lane swimming session — 1500 m target.',
   'Second Beach Pool', 'Vancouver, Canada', 49.2988, -123.1500,
   NOW()+INTERVAL '1 day', NOW()+INTERVAL '1 day 1 hour', 4, 10, TRUE, 'Active'),

  (rugby_id, u16,
   'Mexico City Rugby Sevens', 'Sevens tournament — 4 teams of 7.',
   'Parque Bicentenario', 'Mexico City, Mexico', 19.4326, -99.1332,
   NOW()+INTERVAL '7 days', NOW()+INTERVAL '7 days 4 hours', 14, 28, TRUE, 'Active'),

  -- ── SOUTH AMERICA ─────────────────────────────────────────────────────────

  (football_id, u18,
   'Rio de Janeiro Beach Football', 'Footvolley-style football on Copacabana.',
   'Copacabana Beach', 'Rio de Janeiro, Brazil', -22.9711, -43.1822,
   NOW()+INTERVAL '1 day', NOW()+INTERVAL '1 day 2 hours', 10, 14, TRUE, 'Active'),

  (running_id, u19,
   'Buenos Aires Park Run', '5 km fun run in Palermo. All paces welcome.',
   'Parque Tres de Febrero', 'Buenos Aires, Argentina', -34.5755, -58.4159,
   NOW()+INTERVAL '3 days', NOW()+INTERVAL '3 days 1 hour', 5, 20, TRUE, 'Active'),

  (cycling_id, u04,
   'Bogotá Ciclovía Ride', 'Join the famous Sunday ciclovía — 120 km of car-free roads.',
   'Carrera 7', 'Bogotá, Colombia', 4.7110, -74.0721,
   NOW()+INTERVAL '4 days', NOW()+INTERVAL '4 days 3 hours', 4, 20, TRUE, 'Active'),

  (volleyball_id, u05,
   'Lima Beach Volleyball', 'Sunset volleyball on Miraflores beach.',
   'Playa Makaha', 'Lima, Peru', -12.1328, -77.0306,
   NOW()+INTERVAL '2 days', NOW()+INTERVAL '2 days 2 hours', 6, 12, TRUE, 'Active'),

  (basketball_id, u13,
   'Santiago Pickup Basketball', 'Outdoor 5v5 in the park. Competitive level.',
   'Parque O''Higgins', 'Santiago, Chile', -33.4569, -70.6483,
   NOW()+INTERVAL '5 days', NOW()+INTERVAL '5 days 2 hours', 6, 10, TRUE, 'Active'),

  -- ── AFRICA ────────────────────────────────────────────────────────────────

  (football_id, u01,
   'Cape Town Football Sunday', 'Friendly 11-a-side with Table Mountain views.',
   'Green Point Urban Park', 'Cape Town, South Africa', -33.9025, 18.4097,
   NOW()+INTERVAL '2 days', NOW()+INTERVAL '2 days 2 hours', 10, 14, TRUE, 'Active'),

  (running_id, u06,
   'Nairobi Morning Run', '10 km run through Karura Forest. Cool and scenic.',
   'Karura Forest', 'Nairobi, Kenya', -1.2291, 36.8219,
   NOW()+INTERVAL '1 day', NOW()+INTERVAL '1 day 1 hour 30 minutes', 5, 20, TRUE, 'Active'),

  (basketball_id, u02,
   'Lagos Hoops Session', 'Pickup basketball at the community court.',
   'National Stadium', 'Lagos, Nigeria', 6.4698, 3.3852,
   NOW()+INTERVAL '3 days', NOW()+INTERVAL '3 days 2 hours', 6, 10, TRUE, 'Active'),

  (tennis_id, u03,
   'Cairo Tennis Doubles', 'Doubles on clay courts at the Gezira Club.',
   'Gezira Sporting Club', 'Cairo, Egypt', 30.0626, 31.2197,
   NOW()+INTERVAL '4 days', NOW()+INTERVAL '4 days 2 hours', 2, 4, TRUE, 'Active'),

  (cycling_id, u12,
   'Casablanca Coastal Ride', '30 km ride along the Atlantic corniche.',
   'Corniche Ain Diab', 'Casablanca, Morocco', 33.5731, -7.6298,
   NOW()+INTERVAL '6 days', NOW()+INTERVAL '6 days 3 hours', 4, 20, TRUE, 'Active'),

  (volleyball_id, u17,
   'Accra Beach Volleyball', 'Sunset volleyball on Labadi Beach.',
   'Labadi Beach', 'Accra, Ghana', 5.5600, -0.1769,
   NOW()+INTERVAL '5 days', NOW()+INTERVAL '5 days 2 hours', 6, 12, TRUE, 'Active'),

  -- ── ASIA ──────────────────────────────────────────────────────────────────

  (badminton_id, u15,
   'Tokyo Badminton Club', 'Doubles round-robin at the community gym.',
   'Yoyogi National Gymnasium', 'Tokyo, Japan', 35.6684, 139.6950,
   NOW()+INTERVAL '1 day', NOW()+INTERVAL '1 day 2 hours', 4, 8, TRUE, 'Active'),

  (tabletennis_id, u07,
   'Shanghai Table Tennis Open', 'Competitive singles. Bring your own paddle.',
   'Jing''an Sports Centre', 'Shanghai, China', 31.2304, 121.4737,
   NOW()+INTERVAL '2 days', NOW()+INTERVAL '2 days 3 hours', 4, 16, TRUE, 'Active'),

  (football_id, u09,
   'Mumbai Marine Drive Football', 'Evening 7-a-side on the reclaimed ground.',
   'Marine Drive', 'Mumbai, India', 18.9438, 72.8231,
   NOW()+INTERVAL '3 days', NOW()+INTERVAL '3 days 2 hours', 10, 14, TRUE, 'Active'),

  (running_id, u14,
   'Singapore Botanic Gardens Run', '5 km easy run through the UNESCO gardens.',
   'Singapore Botanic Gardens', 'Singapore', 1.3138, 103.8159,
   NOW()+INTERVAL '1 day', NOW()+INTERVAL '1 day 1 hour', 5, 20, TRUE, 'Active'),

  (basketball_id, u13,
   'Seoul Outdoor Basketball', 'Pickup 3v3 at the Han River park courts.',
   'Yeouido Han River Park', 'Seoul, South Korea', 37.5285, 126.9326,
   NOW()+INTERVAL '2 days', NOW()+INTERVAL '2 days 2 hours', 6, 10, TRUE, 'Active'),

  (swimming_id, u10,
   'Bangkok Pool Swim Session', 'Lane swimming — 2 km target. Outdoor 50 m pool.',
   'Hua Mak Sports Complex', 'Bangkok, Thailand', 13.7563, 100.5018,
   NOW()+INTERVAL '4 days', NOW()+INTERVAL '4 days 1 hour', 4, 10, TRUE, 'Active'),

  (cycling_id, u19,
   'Hanoi Old Quarter Ride', '25 km city tour by bike. Guided route.',
   'Hoan Kiem Lake', 'Hanoi, Vietnam', 21.0285, 105.8542,
   NOW()+INTERVAL '5 days', NOW()+INTERVAL '5 days 3 hours', 4, 20, TRUE, 'Active'),

  (volleyball_id, u05,
   'Bali Beach Volleyball', 'Sunset volleyball on Seminyak Beach.',
   'Seminyak Beach', 'Bali, Indonesia', -8.6905, 115.1609,
   NOW()+INTERVAL '3 days', NOW()+INTERVAL '3 days 2 hours', 6, 12, TRUE, 'Active'),

  (tennis_id, u20,
   'Dubai Tennis Evening', 'Floodlit singles on hard courts.',
   'Dubai Tennis Stadium', 'Dubai, UAE', 25.1972, 55.2744,
   NOW()+INTERVAL '6 days', NOW()+INTERVAL '6 days 2 hours', 2, 4, TRUE, 'Active'),

  (rugby_id, u08,
   'Hong Kong Rugby Sevens Practice', 'Sevens training session — all positions needed.',
   'Happy Valley Recreation Ground', 'Hong Kong', 22.2783, 114.1747,
   NOW()+INTERVAL '7 days', NOW()+INTERVAL '7 days 2 hours', 10, 16, TRUE, 'Active'),

  (badminton_id, u11,
   'Kuala Lumpur Badminton Night', 'Competitive doubles at the national sports complex.',
   'Putra Indoor Stadium', 'Kuala Lumpur, Malaysia', 3.1390, 101.6869,
   NOW()+INTERVAL '2 days', NOW()+INTERVAL '2 days 2 hours', 4, 8, TRUE, 'Active'),

  -- ── OCEANIA ───────────────────────────────────────────────────────────────

  (football_id, u01,
   'Sydney Centennial Park Football', 'Friendly 11-a-side on the oval.',
   'Centennial Park', 'Sydney, Australia', -33.8915, 151.2325,
   NOW()+INTERVAL '1 day', NOW()+INTERVAL '1 day 2 hours', 10, 14, TRUE, 'Active'),

  (running_id, u06,
   'Melbourne Tan Track Run', '3.8 km loop around the Botanical Gardens.',
   'The Tan Track', 'Melbourne, Australia', -37.8302, 144.9800,
   NOW()+INTERVAL '2 days', NOW()+INTERVAL '2 days 1 hour', 5, 20, TRUE, 'Active'),

  (swimming_id, u10,
   'Brisbane River Swim', 'Open water 1 km swim in the Brisbane River.',
   'South Bank Parklands', 'Brisbane, Australia', -27.4698, 153.0251,
   NOW()+INTERVAL '3 days', NOW()+INTERVAL '3 days 1 hour', 4, 10, TRUE, 'Active'),

  (rugby_id, u16,
   'Auckland Rugby Training', 'Full contact training session. Experienced players.',
   'Eden Park', 'Auckland, New Zealand', -36.8753, 174.7435,
   NOW()+INTERVAL '4 days', NOW()+INTERVAL '4 days 2 hours', 10, 16, TRUE, 'Active'),

  (cycling_id, u12,
   'Perth Coastal Cycle', '45 km ride along the Indian Ocean coast.',
   'Cottesloe Beach', 'Perth, Australia', -31.9935, 115.7527,
   NOW()+INTERVAL '5 days', NOW()+INTERVAL '5 days 3 hours', 4, 20, TRUE, 'Active'),

  (volleyball_id, u17,
   'Gold Coast Beach Volleyball', 'Competitive 2v2 on Surfers Paradise beach.',
   'Surfers Paradise Beach', 'Gold Coast, Australia', -28.0023, 153.4145,
   NOW()+INTERVAL '6 days', NOW()+INTERVAL '6 days 2 hours', 4, 8, TRUE, 'Active'),

  -- ── MIDDLE EAST ───────────────────────────────────────────────────────────

  (basketball_id, u02,
   'Tel Aviv Outdoor Basketball', 'Pickup 5v5 at the beachfront courts.',
   'Gordon Beach', 'Tel Aviv, Israel', 32.0853, 34.7818,
   NOW()+INTERVAL '2 days', NOW()+INTERVAL '2 days 2 hours', 6, 10, TRUE, 'Active'),

  (running_id, u14,
   'Istanbul Bosphorus Run', '8 km run along the European shore of the Bosphorus.',
   'Dolmabahce Palace', 'Istanbul, Turkey', 41.0390, 29.0010,
   NOW()+INTERVAL '3 days', NOW()+INTERVAL '3 days 1 hour 30 minutes', 5, 20, TRUE, 'Active'),

  (tennis_id, u03,
   'Riyadh Tennis Club Session', 'Mixed doubles on indoor courts.',
   'Prince Faisal bin Fahd Sports City', 'Riyadh, Saudi Arabia', 24.7136, 46.6753,
   NOW()+INTERVAL '4 days', NOW()+INTERVAL '4 days 2 hours', 2, 4, TRUE, 'Active'),

  (football_id, u18,
   'Doha Evening Football', '7-a-side under the lights at the sports city.',
   'Aspire Zone', 'Doha, Qatar', 25.2631, 51.4390,
   NOW()+INTERVAL '1 day', NOW()+INTERVAL '1 day 2 hours', 10, 14, TRUE, 'Active');

END $$;
