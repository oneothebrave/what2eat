import { useState, useEffect, useCallback } from 'react';
import type { LocationStatus } from '../types';

export interface ExtendedLocationStatus extends LocationStatus {
  setManualLocation?: (lat: number, lng: number, addressName?: string) => void;
  addressName?: string; // 记录手写的地名，以在 UI 上友好展示
}

export function useGeolocation() {
  const [location, setLocation] = useState<ExtendedLocationStatus>({ status: 'pending' });

  const setManualLocation = useCallback((lat: number, lng: number, addressName?: string) => {
    setLocation({
      status: 'granted',
      lat,
      lng,
      addressName,
    });
  }, []);

  useEffect(() => {
    // 首次加载将 setManualLocation 注入状态，保证即使未授权，外部也能通过回调强行授权
    setLocation(prev => ({ ...prev, setManualLocation }));

    if (!navigator.geolocation) {
      setLocation(prev => ({ ...prev, status: 'unavailable' }));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({
          status: 'granted',
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          setManualLocation,
        });
      },
      (_err) => {
        // 拒绝授权或定位失败，真实返回 denied 状态，交由前端引导手动输入
        setLocation({
          status: 'denied',
          setManualLocation,
        });
      },
      { timeout: 8000, enableHighAccuracy: false }
    );
  }, [setManualLocation]);

  return location;
}
