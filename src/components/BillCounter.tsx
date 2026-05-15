import { useEffect, useState, useRef } from 'react';
import { motion, useMotionValue, animate } from 'framer-motion';
import type { Restaurant } from '../types';

interface BillCounterProps {
  restaurants: Restaurant[];
  isRolling: boolean;
  onComplete: (restaurant: Restaurant) => void;
}

type Phase = 'idle' | 'fast' | 'slowing' | 'stopping' | 'done';

const CARD_H = 60;   // px per card
const VISIBLE = 5;   // must be odd

const CUISINE_EMOJI: Record<string, string> = {
  // ── 中餐厅 ──────────────────────────────────────────
  '中餐厅': '🥢', '中餐': '🥢',
  '川菜': '🌶️', '四川菜': '🌶️',
  '粤菜': '🦐', '广东菜': '🦐',
  '湘菜': '🫑', '湖南菜': '🫑',
  '东北菜': '🥘',
  '北京菜': '🦆', '京菜': '🦆',
  '上海菜': '🦀', '沪菜': '🦀',
  '江浙菜': '🌾', '浙菜': '🌾', '苏菜': '🌾',
  '云贵菜': '🌿',
  '闽台菜': '🦑', '闽菜': '🦑',
  '徽菜': '🍵',
  '豫菜': '🍲',
  '客家菜': '🍜',
  '西北菜': '🍖', '新疆菜': '🍖',
  '清真菜': '🕌', '清真': '🕌', '清真餐厅': '🕌',
  '家常菜': '🍳',
  // ── 外国餐厅 ─────────────────────────────────────────
  '外国餐厅': '🌍',
  '日本料理': '🍣', '日料': '🍣', '日式': '🍣',
  '韩国料理': '🥘', '韩餐': '🥘', '韩式': '🥘',
  '西餐': '🍽️', '欧式西餐': '🍽️',
  '东南亚菜': '🌴', '泰国菜': '🍜', '泰餐': '🍜', '越南菜': '🥗',
  '印度菜': '🍛', '印度料理': '🍛',
  '中东餐厅': '🧆',
  '美国餐厅': '🗽', '美式': '🗽',
  '法国餐厅': '🥐', '法式': '🥐',
  '意大利菜': '🍝', '意式': '🍝',
  '墨西哥菜': '🌮',
  '地中海菜': '🫒',
  // ── 快餐厅 ───────────────────────────────────────────
  '快餐厅': '🍟', '快餐': '🍟',
  '汉堡': '🍔',
  '披萨': '🍕', '比萨': '🍕',
  '肯德基': '🍗',
  '麦当劳': '🍔',
  '面馆': '🍜', '面食': '🍜', '拉面': '🍜', '米线': '🍜',
  '米粉店': '🫙', '米粉': '🫙',
  '包子铺': '🥙', '包子': '🥙', '馒头': '🥙',
  '饺子馆': '🥟', '饺子': '🥟',
  '煎饼': '🥞', '煎饼果子': '🥞',
  '炸鸡': '🍗',
  '寿司': '🍱',
  '盖浇饭': '🍚', '盖饭': '🍚', '米饭': '🍚',
  '沙拉': '🥗',
  '三明治': '🥪',
  // ── 休闲餐饮 ─────────────────────────────────────────
  '休闲餐饮': '🧁',
  '甜点': '🍰', '甜品': '🍰', '糕点': '🍰',
  '蛋糕': '🎂',
  '冰淇淋': '🍦', '冰激凌': '🍦',
  '糖水': '🍮',
  '冷饮': '🧋',
  '奶茶': '🧋', '珍珠奶茶': '🧋',
  '果汁': '🍹',
  // ── 咖啡 / 茶 / 酒 ────────────────────────────────────
  '咖啡厅': '☕', '咖啡': '☕',
  '茶馆': '🍵', '茶': '🍵', '茶室': '🍵',
  '酒吧': '🍺', '酒馆': '🍺', '清吧': '🍺',
  // ── 特色品类 ─────────────────────────────────────────
  '小吃': '🥟', '小吃店': '🥟',
  '烧烤': '🔥', '串串': '🔥', '炭烤': '🔥',
  '火锅': '🫕', '涮锅': '🫕', '串串香': '🫕',
  '自助餐': '🍱',
  '海鲜': '🦞',
  '烤鸭': '🦆',
  '炖菜': '🫕',
  '素食': '🥦', '素食餐厅': '🥦',
  '养生': '🌿',
  // ── 英文 fallback ─────────────────────────────────────
  'Chinese': '🥢', 'Japanese': '🍣', 'Korean': '🥘',
  'Western': '🍽️', 'Fast Food': '🍔', 'Cafe': '☕',
  'Hotpot': '🫕', 'BBQ': '🔥', 'Dessert': '🍰',
};
const getEmoji = (c?: string) => (c && CUISINE_EMOJI[c]) ?? '🍽️';

// Single card row — 始终只显示 emoji + 名字 + 类型，详情由底部 ResultTicket 展示
function CardRow({ restaurant, isCenter }: { restaurant: Restaurant | null; isCenter: boolean }) {
  if (!restaurant) return <div style={{ height: CARD_H }} />;
  return (
    <div style={{
      height: CARD_H,
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '0 16px',
      background: isCenter ? 'white' : 'transparent',
      borderTop: isCenter ? '1px solid rgba(0,0,0,0.07)' : '1px solid transparent',
      borderBottom: isCenter ? '1px solid rgba(0,0,0,0.07)' : '1px solid transparent',
      transition: 'background 0.15s ease',
    }}>
      <span style={{ fontSize: isCenter ? 26 : 20, opacity: isCenter ? 1 : 0.35, flexShrink: 0, transition: 'all 0.15s' }}>
        {getEmoji(restaurant.cuisine)}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: isCenter ? 15 : 13,
          fontWeight: isCenter ? 600 : 400,
          color: isCenter ? 'var(--text-primary)' : 'var(--text-tertiary)',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          transition: 'all 0.15s',
        }}>
          {restaurant.name}
        </div>
        {isCenter && restaurant.cuisine && (
          <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 1 }}>
            {restaurant.cuisine}
          </div>
        )}
      </div>
    </div>
  );
}

// Card hopper stack on top of machine
function CardStack({ remaining }: { remaining: number }) {
  const count = Math.min(5, remaining);
  return (
    <div className="card-stack" style={{ marginBottom: -2, zIndex: 2, position: 'relative' }}>
      {[...Array(Math.max(0, count))].map((_, i) => (
        <div key={i} className="card-stack-item" style={{
          bottom: i * 4, width: `${88 - i * 3}%`, height: 26,
          background: `hsl(0,0%,${98 - i * 3}%)`,
          zIndex: count - i,
          boxShadow: i === count - 1 ? '0 -4px 10px rgba(0,0,0,0.06)' : undefined,
        }} />
      ))}
      {remaining > 0 && (
        <div style={{ position: 'absolute', bottom: count * 4 + 2, fontSize: 10, color: 'var(--text-tertiary)', fontWeight: 500 }}>
          {remaining} 家
        </div>
      )}
    </div>
  );
}

export function BillCounter({ restaurants, isRolling, onComplete }: BillCounterProps) {
  const [phase, setPhase] = useState<Phase>('idle');
  const [centerIdx, setCenterIdx] = useState(0);
  const [consumed, setConsumed] = useState(0);
  const y = useMotionValue(0);
  const runningRef = useRef(false);
  const centerIdxRef = useRef(0);

  useEffect(() => { centerIdxRef.current = centerIdx; }, [centerIdx]);

  useEffect(() => {
    if (!isRolling || restaurants.length === 0) {
      runningRef.current = false;
      if (!isRolling) { setPhase('idle'); setConsumed(0); y.set(0); }
      return;
    }

    runningRef.current = true;
    setPhase('fast');
    setConsumed(0);

    // 随机起点：每次从列表中随机位置开始，破坏确定性
    const startIdx = Math.floor(Math.random() * restaurants.length);
    setCenterIdx(startIdx);
    centerIdxRef.current = startIdx;

    let step = 0;
    // 加入随机步数扰动（±4步），确保同起点也能落在不同餐厅
    const FAST = 24 + Math.floor(Math.random() * 9), SLOW = 16, n = restaurants.length;

    const doTick = async (dur: number) => {
      if (!runningRef.current) return;
      await animate(y, CARD_H, { duration: dur, ease: 'linear' });
      if (!runningRef.current) return;
      setCenterIdx(p => (p - 1 + n) % n);
      setConsumed(c => Math.min(n, c + 1));
      y.set(0);
      step++;

      if (step < FAST) {
        doTick(0.055);
      } else if (step < FAST + SLOW) {
        const t = (step - FAST) / SLOW;
        setPhase('slowing');
        doTick(0.055 + Math.pow(t, 2.2) * 0.48);
      } else {
        setPhase('stopping');
        const clunks = [0.52, 0.75, 1.0];
        let ci = 0;
        const doClunk = async () => {
          if (!runningRef.current) return;
          if (ci < clunks.length) {
            await animate(y, CARD_H, { duration: clunks[ci], ease: 'easeOut' });
            if (!runningRef.current) return;
            setCenterIdx(p => (p - 1 + n) % n);
            y.set(0);
            ci++;
            await doClunk();
          } else {
            setPhase('done');
            setTimeout(() => {
              if (runningRef.current) onComplete(restaurants[centerIdxRef.current]);
            }, 300);
          }
        };
        doClunk();
      }
    };

    doTick(0.055);
    return () => { runningRef.current = false; };
  }, [isRolling, restaurants]);

  const getAt = (offset: number) => {
    const n = restaurants.length;
    if (n === 0) return null;
    return restaurants[((centerIdx - offset) % n + n) % n];
  };

  const isFast = phase === 'fast';
  const windowH = VISIBLE * CARD_H;

  return (
    <div style={{ width: '100%', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
      <CardStack remaining={Math.max(0, restaurants.length - consumed)} />

      <div className="machine-body" style={{ padding: '12px 0 14px', flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* Top label + slot */}
        <div style={{ textAlign: 'center', marginBottom: 6 }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontWeight: 500 }}>点 餐 口</span>
        </div>
        <div className="machine-slot" style={{ marginBottom: 10 }} />

        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)' }}>
              {phase === 'idle' ? '准备开饭' : phase === 'fast' ? '系统正在替你纠结' : phase === 'slowing' ? '就快选好了' : phase === 'stopping' ? '不会错的' : '就这家了'}
            </span>
            <div className={`led ${phase === 'idle' ? '' : phase === 'done' ? 'led-green' : 'led-yellow'}`}
              style={phase === 'idle' ? { background: 'var(--text-tertiary)' } : undefined} />
          </div>
        </div>

        {/* Counting window — slot reel */}
        <div style={{
          flex: 1, minHeight: windowH, overflow: 'hidden',
          position: 'relative', background: 'rgba(245,247,255,0.9)',
          margin: '0 16px', borderRadius: 12, border: '1px solid rgba(0,0,0,0.05)',
        }}>
          {/* Top/bottom fade masks */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: CARD_H, background: 'linear-gradient(to bottom, rgba(245,247,255,1), transparent)', zIndex: 10, pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: CARD_H, background: 'linear-gradient(to top, rgba(245,247,255,1), transparent)', zIndex: 10, pointerEvents: 'none' }} />

          {/* The scrolling reel: positions -2 to +3 */}
          <motion.div
            style={{
              y,
              position: 'absolute',
              top: '50%',
              left: 0, right: 0,
              // offset so card[0] is centered: center - 0.5*CARD_H - 2*CARD_H
              marginTop: -2.5 * CARD_H,
            }}
          >
            {[-2, -1, 0, 1, 2, 3].map(offset => (
              <div key={offset} style={{ filter: isFast && offset !== 0 ? 'blur(0.5px)' : 'none' }}>
                <CardRow
                  restaurant={getAt(offset)}
                  isCenter={offset === 0}
                />
              </div>
            ))}
          </motion.div>
        </div>

        {/* Bottom slot + label */}
        <div className="machine-slot" style={{ marginTop: 10, marginBottom: 6, margin: '10px 16px 6px' }} />
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: 10, color: 'var(--text-tertiary)', letterSpacing: '0.08em', fontWeight: 500 }}>出 餐 口</span>
        </div>
      </div>
    </div>
  );
}
