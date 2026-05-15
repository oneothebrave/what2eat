import { useState, useEffect } from 'react';
import type { LocationStatus } from '../types';

export function useGeolocation() {
  const [location, setLocation] = useState<LocationStatus>({ status: 'pending' });

  useEffect(() => {
    if (!navigator.geolocation) {
      setLocation({ status: 'unavailable' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          status: 'granted',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      },
      (_err) => {
        // Fallback to mock coordinates (Beijing CBD) for demo
        setLocation({
          status: 'granted',
          lat: 39.9042,
          lng: 116.4074,
        });
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, []);

  return location;
}
