import { motion, AnimatePresence } from 'framer-motion';
import type { Restaurant } from '../types';

interface ResultCardProps {
  restaurant: Restaurant | null;
}

export function ResultCard({ restaurant }: ResultCardProps) {
  return (
    <AnimatePresence>
      {restaurant && (
        <motion.div
          key={restaurant.id}
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
          className="relative rounded-xl overflow-hidden result-glow"
          style={{
            background: 'linear-gradient(135deg, #0d1520, #111d2b)',
            border: '1px solid rgba(0,212,255,0.5)',
          }}
        >
          {/* HUD corners */}
          <div className="hud-corner hud-corner-tl" />
          <div className="hud-corner hud-corner-tr" />
          <div className="hud-corner hud-corner-bl" />
          <div className="hud-corner hud-corner-br" />

          {/* Header */}
          <div
            className="px-4 pt-3 pb-2 font-mono-tech text-[10px] tracking-widest flex items-center justify-between"
            style={{
              borderBottom: '1px solid rgba(0,212,255,0.15)',
              color: 'var(--color-accent)',
            }}
          >
            <span>◉ SELECTION CONFIRMED</span>
            <motion.span
              animate={{ opacity: [1, 0.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              ●
            </motion.span>
          </div>

          {/* Main result */}
          <div className="px-5 py-4">
            <div
              className="font-mono-tech text-[9px] tracking-widest mb-2"
              style={{ color: 'var(--color-text-dim)' }}
            >
              RECOMMENDED RESTAURANT
            </div>
            <motion.div
              className="font-orbitron font-bold text-xl leading-tight mb-1"
              style={{ color: 'var(--color-text-primary)' }}
              initial={{ clipPath: 'inset(0 100% 0 0)' }}
              animate={{ clipPath: 'inset(0 0% 0 0)' }}
              transition={{ duration: 0.6, delay: 0.2, ease: 'easeOut' }}
            >
              {restaurant.name}
            </motion.div>

            {/* Tags */}
            <div className="flex items-center gap-3 mt-2">
              {restaurant.cuisine && (
                <span
                  className="font-mono-tech text-[9px] tracking-wider px-2 py-0.5 rounded"
                  style={{
                    background: 'rgba(0,212,255,0.08)',
                    border: '1px solid rgba(0,212,255,0.2)',
                    color: 'var(--color-accent)',
                  }}
                >
                  {restaurant.cuisine.toUpperCase()}
                </span>
              )}
              {restaurant.distance && (
                <span
                  className="font-mono-tech text-[9px] tracking-wider"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  📍 {restaurant.distance}
                </span>
              )}
              {restaurant.rating && (
                <span
                  className="font-mono-tech text-[9px] tracking-wider"
                  style={{ color: 'var(--color-accent2)' }}
                >
                  ★ {restaurant.rating.toFixed(1)}
                </span>
              )}
            </div>

            {/* Map navigation link */}
            <MapLink restaurant={restaurant} />
          </div>

          {/* Scan animation overlay */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            style={{
              background: 'linear-gradient(180deg, rgba(0,212,255,0.05) 0%, transparent 30%, transparent 70%, rgba(0,212,255,0.05) 100%)',
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── 地图跳转链接 ──────────────────────────────────────────────────────────
function buildMapUrl(restaurant: Restaurant): string {
  const name = encodeURIComponent(restaurant.name);

  if (restaurant.location) {
    // 有精确坐标（GCJ-02，格式 "lng,lat"）→ 用高德 URI scheme
    // 手机端会尝试唤起高德 App，fallback 到高德网页
    const [lng, lat] = restaurant.location.split(',');
    return `https://uri.amap.com/marker?position=${lng},${lat}&name=${name}&src=what2eat&coordinate=gaode&callnative=1`;
  }

  // 无坐标 → 按名称搜索
  return `https://uri.amap.com/search?keyword=${name}&src=what2eat&callnative=1`;
}

function MapLink({ restaurant }: { restaurant: Restaurant }) {
  const url = buildMapUrl(restaurant);

  return (
    <motion.a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      id={`map-link-${restaurant.id}`}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.5 }}
      whileHover={{ scale: 1.03 }}
      whileTap={{ scale: 0.97 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '6px',
        marginTop: '14px',
        padding: '6px 14px',
        borderRadius: '6px',
        background: 'linear-gradient(90deg, rgba(0,212,255,0.12), rgba(0,212,255,0.06))',
        border: '1px solid rgba(0,212,255,0.35)',
        color: 'var(--color-accent)',
        fontSize: '10px',
        fontFamily: 'var(--font-mono-tech, monospace)',
        letterSpacing: '0.08em',
        textDecoration: 'none',
        cursor: 'pointer',
        transition: 'border-color 0.2s, background 0.2s',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = 'rgba(0,212,255,0.7)';
        el.style.background = 'linear-gradient(90deg, rgba(0,212,255,0.2), rgba(0,212,255,0.1))';
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLAnchorElement;
        el.style.borderColor = 'rgba(0,212,255,0.35)';
        el.style.background = 'linear-gradient(90deg, rgba(0,212,255,0.12), rgba(0,212,255,0.06))';
      }}
    >
      <svg
        width="11"
        height="11"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
        <circle cx="12" cy="9" r="2.5" />
      </svg>
      在地图中查看
    </motion.a>
  );
}
