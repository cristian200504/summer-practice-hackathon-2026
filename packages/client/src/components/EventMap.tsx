import React from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Link } from 'react-router-dom';
import { EventData } from '../services/api';
import L from 'leaflet';

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
  tooltipAnchor: [16, -28],
});

L.Marker.prototype.options.icon = DefaultIcon;

interface EventMapProps {
  events: EventData[];
  centerLat?: number;
  centerLng?: number;
}

export default function EventMap({ events, centerLat = 40.7812, centerLng = -73.9665 }: EventMapProps) {
  return (
    <MapContainer 
      center={[centerLat, centerLng]} 
      zoom={12} 
      style={{ height: '500px', width: '100%', borderRadius: 'var(--radius-lg)', zIndex: 1 }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {events.map((evt) => {
        if (!evt.venueLat || !evt.venueLng) return null;
        return (
          <Marker key={evt.id} position={[evt.venueLat, evt.venueLng]}>
            <Popup>
              <div style={{ padding: '4px' }}>
                <strong style={{ fontSize: '1.1rem', color: 'var(--color-gray-900)' }}>{evt.title}</strong>
                <br/>
                <span style={{ color: 'var(--color-gray-600)', fontSize: '0.9rem' }}>{evt.venueName || 'No venue specified'}</span>
                <br/>
                <Link 
                  to={`/events/${evt.id}`} 
                  style={{ display: 'inline-block', marginTop: '8px', color: 'var(--color-primary)', fontWeight: 'bold', textDecoration: 'none' }}
                >
                  View Details &rarr;
                </Link>
              </div>
            </Popup>
          </Marker>
        );
      })}
    </MapContainer>
  );
}
