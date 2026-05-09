import { env } from '../config/env';

/**
 * Weather Service — OpenWeatherMap integration.
 *
 * Requirements: 9.7, 14.1, 14.2, 14.3, 14.4
 */

export interface WeatherForecast {
  datetime: string;
  description: string;
  tempCelsius: number;
  windSpeedKmh: number;
  isRaining: boolean;
  advisory: string | null;
}

// ── Advisory logic ────────────────────────────────────────────────────────────

function buildAdvisory(forecast: {
  isRaining: boolean;
  tempCelsius: number;
  windSpeedKmh: number;
}): string | null {
  const advisories: string[] = [];
  if (forecast.isRaining) advisories.push('Rain expected');
  if (forecast.tempCelsius > 35) advisories.push(`Extreme heat (${Math.round(forecast.tempCelsius)}°C)`);
  if (forecast.windSpeedKmh > 50) advisories.push(`High winds (${Math.round(forecast.windSpeedKmh)} km/h)`);
  return advisories.length > 0 ? advisories.join(', ') : null;
}

// ── OpenWeatherMap API ────────────────────────────────────────────────────────

interface OWMForecastItem {
  dt: number;
  main: { temp: number };
  wind: { speed: number };
  weather: Array<{ main: string; description: string }>;
}

async function fetchFromOWM(lat: number, lng: number): Promise<OWMForecastItem[]> {
  const url =
    `https://api.openweathermap.org/data/2.5/forecast` +
    `?lat=${lat}&lon=${lng}&units=metric&appid=${env.OPENWEATHERMAP_API_KEY}`;

  const res = await fetch(url);
  if (!res.ok) throw new Error(`OpenWeatherMap API error: ${res.status}`);

  const data = await res.json() as { list: OWMForecastItem[] };
  return data.list;
}

function findClosestForecast(items: OWMForecastItem[], targetDatetime: Date): OWMForecastItem | null {
  const targetTs = targetDatetime.getTime() / 1000;
  let closest: OWMForecastItem | null = null;
  let minDiff = Infinity;

  for (const item of items) {
    const diff = Math.abs(item.dt - targetTs);
    if (diff < minDiff) {
      minDiff = diff;
      closest = item;
    }
  }
  return closest;
}

function getMockForecast(datetime: Date): WeatherForecast {
  return {
    datetime: datetime.toISOString(),
    description: 'Partly cloudy',
    tempCelsius: 22,
    windSpeedKmh: 15,
    isRaining: false,
    advisory: null,
  };
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Get weather forecast for a location and datetime.
 * Falls back to a mock forecast if the API key is not configured.
 *
 * Requirements: 9.7, 14.1
 */
export async function getForecast(
  lat: number,
  lng: number,
  datetime: Date,
): Promise<WeatherForecast> {
  if (!env.OPENWEATHERMAP_API_KEY) {
    return getMockForecast(datetime);
  }

  try {
    const items = await fetchFromOWM(lat, lng);
    const item = findClosestForecast(items, datetime);

    if (!item) return getMockForecast(datetime);

    const tempCelsius = item.main.temp;
    const windSpeedKmh = item.wind.speed * 3.6; // m/s → km/h
    const weatherMain = item.weather[0]?.main ?? '';
    const isRaining = ['Rain', 'Drizzle', 'Thunderstorm'].includes(weatherMain);

    const forecast: WeatherForecast = {
      datetime: new Date(item.dt * 1000).toISOString(),
      description: item.weather[0]?.description ?? '',
      tempCelsius,
      windSpeedKmh,
      isRaining,
      advisory: buildAdvisory({ isRaining, tempCelsius, windSpeedKmh }),
    };

    return forecast;
  } catch (err) {
    console.error('[weatherService] Forecast fetch failed:', err);
    return getMockForecast(datetime);
  }
}

/**
 * Check if a forecast has a weather advisory (rain, extreme heat, high wind).
 * Requirements: 14.2
 */
export function hasAdvisory(forecast: WeatherForecast): boolean {
  return forecast.advisory !== null;
}
