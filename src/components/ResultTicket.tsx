import { motion, AnimatePresence } from 'framer-motion';
import type { Restaurant } from '../types';

// 与 BillCounter 保持一致的完整映射
const CUISINE_EMOJI: Record<string, string> = {
  '中餐厅': '🥢', '中餐': '🥢', '川菜': '🌶️', '粤菜': '🦐', '湘菜': '🫑',
  '东北菜': '🥘', '北京菜': '🦆', '上海菜': '🦀', '江浙菜': '🌾',
  '清真菜': '🕌', '清真': '🕌', '家常菜': '🍳',
  '外国餐厅': '🌍', '日本料理': '🍣', '日料': '🍣', '韩国料理': '🥘', '韩餐': '🥘',
  '西餐': '🍽️', '泰国菜': '🍜', '泰餐': '🍜', '印度菜': '🍛',
  '法国餐厅': '🥐', '意大利菜': '🍝', '墨西哥菜': '🌮',
  '快餐厅': '🍟', '快餐': '🍟', '汉堡': '🍔', '披萨': '🍕',
  '面馆': '🍜', '面食': '🍜', '饺子馆': '🥟', '饺子': '🥟',
  '炸鸡': '🍗', '寿司': '🍱', '盖浇饭': '🍚',
  '休闲餐饮': '🧁', '甜点': '🍰', '甜品': '🍰', '蛋糕': '🎂',
  '冰淇淋': '🍦', '奶茶': '🧋', '果汁': '🍹',
  '咖啡厅': '☕', '咖啡': '☕',
  '茶馆': '🍵', '茶': '🍵',
  '酒吧': '🍺',
  '小吃': '🥟', '烧烤': '🔥', '串串': '🔥',
  '火锅': '🫕', '涮锅': '🫕',
  '自助餐': '🍱', '海鲜': '🦞', '素食': '🥦',
};

function getEmoji(cuisine?: string) {
  return cuisine ? (CUISINE_EMOJI[cuisine] ?? '🍽️') : '🍽️';
}

// ─── 地图跳转 URL ──────────────────────────────────────────────────────────
function buildMapUrl(restaurant: Restaurant): string {
  const name = encodeURIComponent(restaurant.name);
  if (restaurant.location) {
    const [lng, lat] = restaurant.location.split(',');
    return `https://uri.amap.com/marker?position=${lng},${lat}&name=${name}&src=what2eat&coordinate=gaode&callnative=1`;
  }
  return `https://uri.amap.com/search?keyword=${name}&src=what2eat&callnative=1`;
}


interface ResultTicketProps {
  restaurant: Restaurant | null;
}

export function ResultTicket({ restaurant }: ResultTicketProps) {
  return (
    <AnimatePresence>
      {restaurant && (
        <motion.div
          key={restaurant.id}
          initial={{ y: -24, opacity: 0, scaleY: 0.9 }}
          animate={{ y: 0, opacity: 1, scaleY: 1 }}
          exit={{ y: 12, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 280, damping: 24 }}
          className="result-ticket"
          style={{ transformOrigin: 'top center' }}
        >
          {/* Perforated top edge */}
          <div style={{
            height: 6,
            background: 'repeating-linear-gradient(90deg, var(--bg) 0px, var(--bg) 5px, white 5px, white 12px)',
            borderBottom: '1px solid rgba(0,0,0,0.05)',
          }} />

          {/* Content row */}
          <div style={{ display: 'flex', alignItems: 'center', padding: '12px 16px', gap: 12 }}>
            <span style={{ fontSize: 36, lineHeight: 1, flexShrink: 0 }}>{getEmoji(restaurant.cuisine)}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: 17, fontWeight: 700, color: 'var(--text-primary)',
                letterSpacing: '-0.02em', lineHeight: 1.2,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {restaurant.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {restaurant.cuisine && <span>{restaurant.cuisine}</span>}
                {restaurant.distance && <span>📍 {restaurant.distance}</span>}
                {restaurant.cost && (
                  <span style={{ color: 'var(--accent)', fontWeight: 600 }}>人均 {restaurant.cost}</span>
                )}
                {restaurant.rating && <span>★ {restaurant.rating.toFixed(1)}</span>}
              </div>

              {/* 跳转链接行 */}
              <motion.a
                href={buildMapUrl(restaurant)}
                target="_blank"
                rel="noopener noreferrer"
                id={`map-link-${restaurant.id}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
                style={linkStyle}
              >
                <PinIcon />
                在地图中查看
              </motion.a>
            </div>
            <div style={{
              fontSize: 11, color: 'var(--text-tertiary)', flexShrink: 0,
              textAlign: 'right', lineHeight: 1.3,
            }}>
              <div>已选择</div>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ─── 样式 & 图标 ───────────────────────────────────────────────────────────
const linkStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 3,
  fontSize: 11,
  color: 'var(--accent)',
  textDecoration: 'none',
  fontWeight: 500,
  padding: '2px 6px',
  borderRadius: 4,
  background: 'rgba(var(--accent-rgb, 0,122,255), 0.06)',
  border: '1px solid rgba(var(--accent-rgb, 0,122,255), 0.15)',
  whiteSpace: 'nowrap' as const,
};

function PinIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

