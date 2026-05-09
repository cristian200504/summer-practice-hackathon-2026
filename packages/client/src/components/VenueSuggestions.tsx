import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Card, Badge, Spinner } from './ui';
import { venues, weather, Venue, WeatherForecast } from '../services/api';
import './VenueSuggestions.css';

interface VenueSuggestionsProps {
  sportName: string;
  lat: number;
  lng: number;
  eventDatetime?: string;
  onAddToPoll?: (venue: Venue) => void;
}

/**
 * Venue suggestion panel for the Captain's event planning view.
 *
 * - Fetches nearby venues via GET /venues
 * - Shows weather forecast alongside venue list
 * - "Add to Poll" button for each venue
 * - "Get Directions" opens device navigation
 *
 * Requirements: 9.1, 9.2, 9.3, 9.6, 9.7, 12.1, 12.2, 12.3
 */
export default function VenueSuggestions({
  sportName,
  lat,
  lng,
  eventDatetime,
  onAddToPoll,
}: VenueSuggestionsProps) {
  const { t } = useTranslation();
  const [venueList, setVenueList] = useState<Venue[]>([]);
  const [expandedRadius, setExpandedRadius] = useState<number | null>(null);
  const [forecast, setForecast] = useState<WeatherForecast | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      try {
        const [venueResult, forecastResult] = await Promise.all([
          venues.search(sportName, lat, lng),
          eventDatetime ? weather.getForecast(lat, lng, eventDatetime) : Promise.resolve(null),
        ]);
        if (cancelled) return;
        setVenueList(venueResult.venues);
        setExpandedRadius(venueResult.expandedRadius);
        setForecast(forecastResult);
      } catch {
        if (!cancelled) setError(t('errors.generic'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, [sportName, lat, lng, eventDatetime, t]);

  function handleGetDirections(venue: Venue) {
    const query = encodeURIComponent(venue.address);
    window.open(`https://www.google.com/maps/dir/?api=1&destination=${query}`, '_blank', 'noopener');
  }

  if (loading) return <Spinner centered />;
  if (error) return <p className="venue-suggestions__error" role="alert">{error}</p>;

  return (
    <div className="venue-suggestions">
      {/* Weather widget */}
      {forecast && (
        <Card className="venue-suggestions__weather" padding="sm">
          <div className="venue-suggestions__weather-row">
            <span className="venue-suggestions__weather-icon" aria-hidden="true">
              {forecast.isRaining ? '🌧️' : forecast.tempCelsius > 30 ? '☀️' : '⛅'}
            </span>
            <div>
              <p className="venue-suggestions__weather-desc">{forecast.description}</p>
              <p className="venue-suggestions__weather-meta">
                {Math.round(forecast.tempCelsius)}°C · {Math.round(forecast.windSpeedKmh)} km/h wind
              </p>
            </div>
          </div>
          {forecast.advisory && (
            <div className="venue-suggestions__advisory" role="alert">
              <Badge variant="warning">⚠️ {forecast.advisory}</Badge>
            </div>
          )}
        </Card>
      )}

      {/* Expanded radius notice */}
      {expandedRadius && (
        <p className="venue-suggestions__radius-notice" role="status">
          No venues found nearby — showing results within {expandedRadius} km.
        </p>
      )}

      {/* Venue list */}
      {venueList.length === 0 ? (
        <p className="venue-suggestions__empty">{t('events.noEvents')}</p>
      ) : (
        <ul className="venue-suggestions__list" role="list">
          {venueList.map((venue) => (
            <li key={venue.id}>
              <Card className="venue-suggestions__card" padding="sm">
                <div className="venue-suggestions__card-header">
                  <div>
                    <h3 className="venue-suggestions__name">{venue.name}</h3>
                    <p className="venue-suggestions__address">{venue.address}</p>
                    <div className="venue-suggestions__meta">
                      <Badge variant="default">{venue.distanceKm.toFixed(1)} km</Badge>
                      {venue.pricing && <Badge variant="default">{venue.pricing}</Badge>}
                    </div>
                  </div>
                </div>
                <div className="venue-suggestions__actions">
                  {onAddToPoll && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => onAddToPoll(venue)}
                      aria-label={`Add ${venue.name} to poll`}
                    >
                      📊 {t('captain.initiatePoll', 'Add to Poll')}
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleGetDirections(venue)}
                    aria-label={`Get directions to ${venue.name}`}
                  >
                    🗺️ {t('events.detail.getDirections')}
                  </Button>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
