import { env } from '../config/env';

/**
 * Location Service — venue search via Google Places API.
 *
 * Requirements: 9.1, 9.2, 9.8
 */

export interface Venue {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  distanceKm: number;
  pricing?: string;
}

// ── Haversine distance ────────────────────────────────────────────────────────

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ── Google Places API ─────────────────────────────────────────────────────────

const SPORT_TYPE_MAP: Record<string, string> = {
  Football: 'stadium',
  Basketball: 'stadium',
  Tennis: 'tennis_court',
  Volleyball: 'stadium',
  Badminton: 'stadium',
  Running: 'park',
  Cycling: 'park',
  Swimming: 'swimming_pool',
  'Table Tennis': 'stadium',
  Rugby: 'stadium',
};

async function fetchPlaces(
  sportName: string,
  lat: number,
  lng: number,
  radiusMeters: number,
): Promise<Venue[]> {
  if (!env.GOOGLE_PLACES_API_KEY) {
    // Return mock venues when API key is not configured
    return getMockVenues(lat, lng, radiusMeters / 1000);
  }

  const type = SPORT_TYPE_MAP[sportName] ?? 'stadium';
  const url =
    `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
    `?location=${lat},${lng}&radius=${radiusMeters}&type=${type}` +
    `&key=${env.GOOGLE_PLACES_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`Google Places API error: ${res.status}`);

  const data = await res.json() as {
    results: Array<{
      place_id: string;
      name: string;
      vicinity: string;
      geometry: { location: { lat: number; lng: number } };
      price_level?: number;
    }>;
  };

  return data.results.map((place) => ({
    id: place.place_id,
    name: place.name,
    address: place.vicinity,
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng,
    distanceKm: haversineKm(lat, lng, place.geometry.location.lat, place.geometry.location.lng),
    pricing: place.price_level !== undefined
      ? ['Free', 'Inexpensive', 'Moderate', 'Expensive', 'Very Expensive'][place.price_level]
      : undefined,
  }));
}

/** Mock venues for development/testing when no API key is configured. */
function getMockVenues(lat: number, lng: number, radiusKm: number): Venue[] {
  return [
    {
      id: 'mock-venue-1',
      name: 'City Sports Complex',
      address: '123 Main St',
      lat: lat + 0.01,
      lng: lng + 0.01,
      distanceKm: haversineKm(lat, lng, lat + 0.01, lng + 0.01),
      pricing: 'Moderate',
    },
    {
      id: 'mock-venue-2',
      name: 'Community Recreation Center',
      address: '456 Park Ave',
      lat: lat - 0.008,
      lng: lng + 0.015,
      distanceKm: haversineKm(lat, lng, lat - 0.008, lng + 0.015),
      pricing: 'Inexpensive',
    },
    {
      id: 'mock-venue-3',
      name: 'Riverside Sports Ground',
      address: '789 River Rd',
      lat: lat + 0.02,
      lng: lng - 0.01,
      distanceKm: haversineKm(lat, lng, lat + 0.02, lng - 0.01),
      pricing: 'Free',
    },
  ].filter((v) => v.distanceKm <= radiusKm);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Search for venues near a location for a given sport.
 * Expands search radius by 5 km increments up to 3 times if no results found.
 *
 * Requirements: 9.1, 9.2, 9.8
 */
export async function getNearbyVenues(
  sportName: string,
  lat: number,
  lng: number,
  radiusKm: number = env.DEFAULT_PROXIMITY_KM,
): Promise<{ venues: Venue[]; expandedRadius: number | null }> {
  const MAX_EXPANSIONS = 3;
  const EXPANSION_KM = 5;

  let currentRadius = radiusKm;
  let expansions = 0;

  while (expansions <= MAX_EXPANSIONS) {
    try {
      const venues = await fetchPlaces(sportName, lat, lng, currentRadius * 1000);
      if (venues.length >= 3 || expansions === MAX_EXPANSIONS) {
        return {
          venues: venues.slice(0, 10).sort((a, b) => a.distanceKm - b.distanceKm),
          expandedRadius: expansions > 0 ? currentRadius : null,
        };
      }
    } catch (err) {
      console.error('[locationService] Places API error:', err);
      return { venues: getMockVenues(lat, lng, currentRadius), expandedRadius: null };
    }

    currentRadius += EXPANSION_KM;
    expansions++;
  }

  return { venues: [], expandedRadius: currentRadius };
}
