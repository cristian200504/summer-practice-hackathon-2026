import { useState, useEffect, useCallback } from 'react';

export interface GeoPosition {
  lat: number;
  lng: number;
}

export type GeoStatus = 'idle' | 'requesting' | 'granted' | 'denied' | 'unavailable';

const STORAGE_KEY = 'showup2move_last_location';

/**
 * Hook for browser geolocation with permission handling.
 *
 * - Requests permission with a user-facing explanation.
 * - Persists last known location to localStorage for proximity matching
 *   when the user is not active (Req 12.5).
 * - Returns the current position and permission status.
 *
 * Requirements: 12.3, 12.4, 12.5
 */
export function useGeolocation() {
  const [position, setPosition] = useState<GeoPosition | null>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      return stored ? (JSON.parse(stored) as GeoPosition) : null;
    } catch {
      return null;
    }
  });
  const [status, setStatus] = useState<GeoStatus>('idle');

  const requestLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus('unavailable');
      return;
    }

    setStatus('requesting');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: GeoPosition = {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        };
        setPosition(coords);
        setStatus('granted');
        // Persist for offline proximity matching (Req 12.5)
        localStorage.setItem(STORAGE_KEY, JSON.stringify(coords));
      },
      (err) => {
        if (err.code === GeolocationPositionError.PERMISSION_DENIED) {
          setStatus('denied');
        } else {
          setStatus('unavailable');
        }
      },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 5 * 60 * 1000 },
    );
  }, []);

  // Auto-request on mount if we don't have a stored position
  useEffect(() => {
    if (!position) requestLocation();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return { position, status, requestLocation };
}
