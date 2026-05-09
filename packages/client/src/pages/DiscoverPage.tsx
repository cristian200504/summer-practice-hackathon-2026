import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Spinner, Badge, Button } from '../components/ui';
import { events as eventsApi, EventData } from '../services/api';
import './DiscoverPage.css';

// Fix leaflet default icon issue with bundlers
import iconUrl from 'leaflet/dist/images/marker-icon.png';
import iconRetinaUrl from 'leaflet/dist/images/marker-icon-2x.png';
import shadowUrl from 'leaflet/dist/images/marker-shadow.png';

const DefaultIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
});
L.Marker.prototype.options.icon = DefaultIcon;

// Romania center (Bucharest area)
const ROMANIA_CENTER: [number, number] = [44.4268, 26.1025];
const ROMANIA_ZOOM = 7;

/**
 * Helper component that forces Leaflet to recalculate its size
 * after the container has rendered. Fixes the grey/missing tiles bug.
 */
function InvalidateSize() {
  const map = useMap();
  useEffect(() => {
    // Short delay to ensure the container is fully laid out
    const timer = setTimeout(() => {
      map.invalidateSize();
    }, 200);
    return () => clearTimeout(timer);
  }, [map]);
  return null;
}

/**
 * Discovery map screen — shows a full interactive OpenStreetMap
 * centered on Romania with all public events plotted as markers.
 *
 * Requirements: 12.6
 */
export default function DiscoverPage() {
  const { t } = useTranslation();
  const [eventList, setEventList] = useState<EventData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    eventsApi.list()
      .then(setEventList)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const mappableEvents = eventList.filter((e) => e.venueLat && e.venueLng);

  return (
    <main className="discover-page" aria-label={t('discover.title')}>
      <div className="discover-page__header">
        <div className="page-hero">
          <span className="page-hero__icon" aria-hidden="true">🗺️</span>
          <h1 className="page-hero__title">{t('discover.title')}</h1>
          <p className="page-hero__subtitle">Explore sports events across the world. Click a pin to see details.</p>
        </div>
      </div>

      {loading ? (
        <div className="discover-page__loader">
          <Spinner centered />
        </div>
      ) : (
        <div className="discover-page__map-wrapper">
          <MapContainer
            center={ROMANIA_CENTER}
            zoom={ROMANIA_ZOOM}
            className="discover-page__map"
            scrollWheelZoom={true}
          >
            <InvalidateSize />
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {mappableEvents.map((evt) => (
              <Marker key={evt.id} position={[evt.venueLat!, evt.venueLng!]}>
                <Popup>
                  <div className="discover-popup">
                    <strong className="discover-popup__title">{evt.title}</strong>
                    <span className="discover-popup__venue">
                      📍 {evt.venueName || 'No venue specified'}
                    </span>
                    <span className="discover-popup__time">
                      🕐 {new Date(evt.startTime).toLocaleString()}
                    </span>
                    <span className="discover-popup__players">
                      👥 {evt.minParticipants}–{evt.maxParticipants} players
                    </span>
                    <Badge variant={evt.state === 'Active' ? 'success' : 'default'}>
                      {evt.state}
                    </Badge>
                    <Link to={`/events/${evt.id}`} className="discover-popup__link">
                      View Details →
                    </Link>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Event sidebar list */}
          {mappableEvents.length > 0 && (
            <div className="discover-page__sidebar">
              <h2 className="discover-page__sidebar-title">
                📋 {mappableEvents.length} Event{mappableEvents.length !== 1 ? 's' : ''} Found
              </h2>
              <ul className="discover-page__event-list">
                {mappableEvents.map((evt) => (
                  <li key={evt.id} className="discover-page__event-card">
                    <div className="discover-page__event-card-header">
                      <span className="discover-page__event-card-title">{evt.title}</span>
                      <Badge variant={evt.state === 'Active' ? 'success' : 'default'}>
                        {evt.state}
                      </Badge>
                    </div>
                    <span className="discover-page__event-card-venue">📍 {evt.venueName}</span>
                    <span className="discover-page__event-card-time">
                      🕐 {new Date(evt.startTime).toLocaleString()}
                    </span>
                    <Link to={`/events/${evt.id}`}>
                      <Button variant="primary" size="sm" fullWidth>
                        View Event
                      </Button>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </main>
  );
}
