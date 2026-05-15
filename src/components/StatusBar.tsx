import { motion, AnimatePresence } from 'framer-motion';
import type { AppState } from '../types';
import type { LocationStatus } from '../types';

interface StatusBarProps {
  appState: AppState;
  location: LocationStatus;
  restaurantCount: number;
}

const SYSTEM_TIME = () => {
  const now = new Date();
  return now.toLocaleTimeString('en-US', { hour12: false });
};

function LiveClock() {
  const [time, setTime] = useState(SYSTEM_TIME());
  useEffect(() => {
    const id = setInterval(() => setTime(SYSTEM_TIME()), 1000);
    return () => clearInterval(id);
  }, []);
  return <span>{time}</span>;
}

import { useState, useEffect } from 'react';

export function StatusBar({ appState, location, restaurantCount }: StatusBarProps) {
  const isOnline = appState !== 'idle';
  const locationVerified = location.status === 'granted';
  const isScanning = appState === 'scanning';

  return (
    <div className="px-4 py-3 font-mono-tech text-[10px] tracking-wider border-b border-[#1a2332]">
      {/* Top row */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span
            className="status-dot"
            style={{ background: isOnline ? 'var(--color-success)' : 'var(--color-text-muted)' }}
          />
          <span style={{ color: isOnline ? 'var(--color-success)' : 'var(--color-text-muted)' }}>
            SYSTEM {isOnline ? 'ONLINE' : 'READY'}
          </span>
        </div>
        <div className="flex items-center gap-3" style={{ color: 'var(--color-text-muted)' }}>
          <span>SYS<span style={{ color: 'var(--color-accent)' }}>:</span>v2.4.1</span>
          <span style={{ color: 'var(--color-accent)' }}>
            <LiveClock />
          </span>
        </div>
      </div>

      {/* Status items */}
      <div className="flex items-center gap-4 flex-wrap">
        {/* Location */}
        <div className="flex items-center gap-1.5">
          <span
            className="status-dot"
            style={{
              background: locationVerified ? 'var(--color-success)' : 'var(--color-accent2)',
              boxShadow: locationVerified ? undefined : '0 0 4px var(--color-accent2)'
            }}
          />
          <span style={{ color: locationVerified ? 'var(--color-success)' : 'var(--color-accent2)' }}>
            {locationVerified ? 'LOCATION VERIFIED' : 'LOCATING...'}
          </span>
        </div>

        {/* Separator */}
        <span style={{ color: 'var(--color-text-dim)' }}>│</span>

        {/* Restaurant count */}
        <div className="flex items-center gap-1.5">
          <AnimatePresence mode="wait">
            {isScanning ? (
              <motion.span
                key="scanning"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0.5, 1, 0.5] }}
                transition={{ duration: 0.8, repeat: Infinity }}
                style={{ color: 'var(--color-accent)' }}
              >
                SCANNING...
              </motion.span>
            ) : (
              <motion.span
                key="count"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                style={{ color: restaurantCount > 0 ? 'var(--color-success)' : 'var(--color-text-muted)' }}
              >
                RESTAURANTS SCANNED:{' '}
                <span style={{ color: 'var(--color-accent)', fontWeight: 'bold' }}>
                  {String(restaurantCount).padStart(2, '0')}
                </span>
              </motion.span>
            )}
          </AnimatePresence>
        </div>

        {/* Separator */}
        <span style={{ color: 'var(--color-text-dim)' }}>│</span>

        {/* State indicator */}
        <div style={{ color: 'var(--color-text-muted)' }}>
          MODE:{' '}
          <span style={{ color: 'var(--color-accent)' }}>
            {appState.toUpperCase()}
          </span>
        </div>
      </div>

      {/* Animated scan bar */}
      <motion.div
        className="mt-2 h-px"
        style={{
          background: 'linear-gradient(90deg, transparent, var(--color-accent), transparent)',
          opacity: appState === 'rolling' ? 1 : 0.3,
        }}
        animate={appState === 'rolling' ? {
          scaleX: [0.3, 1, 0.3],
          opacity: [0.3, 0.8, 0.3],
        } : {}}
        transition={{ duration: 0.6, repeat: Infinity }}
      />
    </div>
  );
}
