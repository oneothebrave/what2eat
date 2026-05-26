import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { AppState, Restaurant, CurationResult } from './types';
import { useGeolocation } from './hooks/useGeolocation';
import { fetchNearbyRestaurants, readCache, curateCandidates, searchAddressCoordinate } from './data/restaurants';
import { BillCounter } from './components/BillCounter';
import { ResultTicket } from './components/ResultTicket';
import { ControlButton } from './components/ControlButton';
import { ProfileDrawer } from './components/ProfileDrawer';
import jackyCheungGif from './assets/jacky-cheung-eat-shit.gif';

// ─── 候选池模式 ───────────────────────────────────────────────────────
type PoolMode = 'curated' | 'explore';

// ─── 轻量偏好筛选 ─────────────────────────────────────────────────────
type DistancePreference = 'near' | 'farther' | 'anywhere';
type PricePreference = 'budget' | 'normal' | 'treat' | 'payday';

const MIN_PREFERRED_COUNT = 24;

const DISTANCE_OPTIONS: { key: DistancePreference; label: string; maxMeters: number }[] = [
  { key: 'near', label: '1km', maxMeters: 1000 },
  { key: 'farther', label: '3km', maxMeters: 3000 },
  { key: 'anywhere', label: '5km', maxMeters: 5000 },
];

const PRICE_OPTIONS: { key: PricePreference; label: string }[] = [
  { key: 'budget', label: '省钱' },
  { key: 'normal', label: '正常' },
  { key: 'treat', label: '吃好点' },
  { key: 'payday', label: '发工资' },
];

function parseCostValue(cost?: string): number | null {
  if (!cost) return null;
  const value = Number(cost.replace(/[^\d.]/g, ''));
  return Number.isFinite(value) ? value : null;
}

function matchesPrice(cost: number | null, preference: PricePreference): boolean {
  if (cost == null) return false;
  if (preference === 'budget') return cost < 30;
  if (preference === 'normal') return cost >= 30 && cost <= 50;
  if (preference === 'treat') return cost > 50 && cost <= 100;
  return cost > 100;
}

function relaxedDistancePreferences(preference: DistancePreference): DistancePreference[] {
  if (preference === 'near') return ['near', 'farther'];
  if (preference === 'farther') return ['farther', 'near', 'anywhere'];
  return ['anywhere'];
}

function relaxedPricePreferences(preference: PricePreference): PricePreference[] {
  if (preference === 'budget') return ['budget', 'normal'];
  if (preference === 'normal') return ['normal', 'budget', 'treat'];
  if (preference === 'treat') return ['treat', 'normal', 'payday'];
  return ['payday', 'treat'];
}

function matchesDistance(distance: number, preference: DistancePreference): boolean {
  const option = DISTANCE_OPTIONS.find(item => item.key === preference);
  if (!option) return distance <= 5000;
  return distance <= option.maxMeters;
}

function filterByPreferences(
  restaurants: Restaurant[],
  distancePreference: DistancePreference,
  pricePreference: PricePreference,
): { restaurants: Restaurant[]; relaxed: boolean } {
  const preferred = restaurants.filter(restaurant => {
    const distance = restaurant.distanceMeters ?? Number.POSITIVE_INFINITY;
    return matchesDistance(distance, distancePreference) && matchesPrice(parseCostValue(restaurant.cost), pricePreference);
  });

  if (preferred.length >= MIN_PREFERRED_COUNT) {
    return { restaurants: preferred, relaxed: false };
  }

  const relaxedDistances = relaxedDistancePreferences(distancePreference);
  const relaxedPrices = relaxedPricePreferences(pricePreference);
  const seen = new Set<number>();
  const expanded: Restaurant[] = [];

  const addMatches = (predicate: (restaurant: Restaurant) => boolean, stopAtMinimum = true) => {
    for (const restaurant of restaurants) {
      if (stopAtMinimum && expanded.length >= MIN_PREFERRED_COUNT) return;
      if (seen.has(restaurant.id) || !predicate(restaurant)) continue;
      seen.add(restaurant.id);
      expanded.push(restaurant);
    }
  };

  addMatches(restaurant => {
    const distance = restaurant.distanceMeters ?? Number.POSITIVE_INFINITY;
    return matchesDistance(distance, distancePreference) && matchesPrice(parseCostValue(restaurant.cost), pricePreference);
  });
  addMatches(restaurant => {
    const distance = restaurant.distanceMeters ?? Number.POSITIVE_INFINITY;
    return relaxedDistances.some(preference => matchesDistance(distance, preference))
      && matchesPrice(parseCostValue(restaurant.cost), pricePreference);
  });
  addMatches(restaurant => {
    const distance = restaurant.distanceMeters ?? Number.POSITIVE_INFINITY;
    const cost = parseCostValue(restaurant.cost);
    return relaxedDistances.some(preference => matchesDistance(distance, preference))
      && relaxedPrices.some(preference => matchesPrice(cost, preference));
  });
  addMatches(restaurant => {
    const distance = restaurant.distanceMeters ?? Number.POSITIVE_INFINITY;
    return relaxedDistances.some(preference => matchesDistance(distance, preference))
      && parseCostValue(restaurant.cost) == null;
  });
  if (expanded.length < MIN_PREFERRED_COUNT) {
    addMatches(restaurant => (restaurant.distanceMeters ?? Number.POSITIVE_INFINITY) <= 5000, false);
  }

  return { restaurants: expanded, relaxed: true };
}

// ─── 餐厅类型过滤 ─────────────────────────────────────────────────────
type MealType = 'all' | 'meal' | 'teatime';

const MEAL_CUISINES = new Set([
  '中餐厅', '中餐', '川菜', '四川菜', '粤菜', '广东菜', '湘菜', '湖南菜',
  '东北菜', '北京菜', '京菜', '上海菜', '沪菜', '江浙菜', '浙菜', '苏菜',
  '云贵菜', '闽台菜', '闽菜', '徽菜', '豫菜', '客家菜', '西北菜', '新疆菜',
  '清真菜', '清真', '清真餐厅', '家常菜',
  '外国餐厅', '日本料理', '日料', '日式', '韩国料理', '韩餐', '韩式',
  '西餐', '欧式西餐', '东南亚菜', '泰国菜', '泰餐', '越南菜',
  '印度菜', '印度料理', '中东餐厅', '美国餐厅', '美式', '法国餐厅', '法式',
  '意大利菜', '意式', '墨西哥菜', '地中海菜',
  '快餐厅', '快餐', '汉堡', '披萨', '比萨', '肯德基', '麦当劳',
  '面馆', '面食', '拉面', '米线', '米粉店', '米粉', '包子铺', '包子',
  '饺子馆', '饺子', '煎饼', '煎饼果子', '炸鸡', '寿司', '盖浇饭', '盖饭', '米饭',
  '火锅', '涮锅', '串串香',
  '自助餐',
  '烧烤', '串串', '炭烤',
  '海鲜', '烤鸭', '炖菜', '素食', '素食餐厅',
]);

const TEATIME_CUISINES = new Set([
  '休闲餐饮', '甜点', '甜品', '糕点', '蛋糕', '冰淇淋', '冰激凌',
  '糖水', '冷饮', '奶茶', '珍珠奶茶', '果汁', '沙拉', '三明治',
  '咖啡厅', '咖啡',
  '茶馆', '茶', '茶室',
  '小吃', '小吃店',
]);

function getMealType(cuisine?: string): MealType {
  if (!cuisine) return 'meal';
  if (MEAL_CUISINES.has(cuisine)) return 'meal';
  if (TEATIME_CUISINES.has(cuisine)) return 'teatime';
  return 'meal';
}

const MEAL_TABS: { key: MealType; label: string; emoji: string }[] = [
  { key: 'all', label: '全部', emoji: '🍽️' },
  { key: 'meal', label: '正餐', emoji: '🥢' },
  { key: 'teatime', label: '下午茶', emoji: '☕' },
];

function MealFilter({
  value, onChange, disabled, counts,
}: {
  value: MealType;
  onChange: (k: MealType) => void;
  disabled: boolean;
  counts: Record<MealType, number>;
}) {
  return (
    <div style={{ display: 'flex', background: 'var(--surface-2)', borderRadius: 10, padding: 3, gap: 2 }}>
      {MEAL_TABS.map(tab => (
        <button
          key={tab.key}
          id={`meal-tab-${tab.key}`}
          onClick={() => onChange(tab.key)}
          disabled={disabled}
          style={{
            flex: 1, padding: '6px 4px', borderRadius: 8,
            border: 'none', fontSize: 12,
            fontWeight: value === tab.key ? 600 : 400,
            background: value === tab.key ? 'white' : 'transparent',
            color: value === tab.key ? 'var(--text-primary)' : 'var(--text-secondary)',
            boxShadow: value === tab.key ? '0 1px 4px rgba(0,0,0,0.12)' : 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            transition: 'all 0.18s ease',
            opacity: disabled ? 0.5 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3,
          }}
        >
          <span>{tab.emoji}</span>
          <span style={{ whiteSpace: 'nowrap' }}>{tab.label}</span>
          {counts[tab.key] > 0 && (
            <span style={{
              fontSize: 10,
              color: value === tab.key ? 'var(--accent)' : 'var(--text-tertiary)',
              fontWeight: 500,
            }}>
              {counts[tab.key]}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

// ─── Apple Style SegmentedControl ──────────────────────────────────────────
function SegmentedControl<T extends string>({
  id,
  value,
  options,
  onChange,
  disabled,
}: {
  id: string;
  value: T;
  options: { key: T; label: string }[];
  onChange: (value: T) => void;
  disabled: boolean;
}) {
  return (
    <div
      style={{
        position: 'relative',
        display: 'grid',
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
        gap: 2,
        padding: 3,
        borderRadius: 10,
        background: 'rgba(120, 120, 128, 0.12)',
        boxShadow: 'inset 0 0 0 0.5px rgba(0,0,0,0.04)',
        width: '100%',
      }}
    >
      {options.map(option => {
        const selected = value === option.key;
        return (
          <button
            key={option.key}
            id={`${id}-${option.key}`}
            onClick={() => onChange(option.key)}
            disabled={disabled}
            style={{
              position: 'relative',
              height: 38,
              padding: '0 4px',
              border: 'none',
              outline: 'none',
              borderRadius: 8,
              background: 'transparent',
              color: selected ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: disabled ? 'not-allowed' : 'pointer',
              fontSize: 13.5,
              fontWeight: selected ? 600 : 500,
              fontFamily: 'inherit',
              whiteSpace: 'nowrap',
              transition: 'color 0.15s ease',
              opacity: disabled ? 0.45 : 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {selected && (
              <motion.span
                layoutId={`${id}-thumb`}
                transition={{ type: 'spring', stiffness: 350, damping: 28 }}
                style={{
                  position: 'absolute',
                  inset: 0,
                  borderRadius: 8,
                  background: '#ffffff',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.1), 0 1px 1px rgba(0,0,0,0.06)',
                  zIndex: 0,
                }}
              />
            )}
            <span style={{ position: 'relative', zIndex: 1 }}>{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PreferencePanel({
  distancePreference,
  pricePreference,
  onDistanceChange,
  onPriceChange,
  disabled,
  relaxed,
}: {
  distancePreference: DistancePreference;
  pricePreference: PricePreference;
  onDistanceChange: (value: DistancePreference) => void;
  onPriceChange: (value: PricePreference) => void;
  disabled: boolean;
  relaxed: boolean;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12, flexShrink: 0 }}>
      <div className="ios-settings-card">
        {/* 搜寻范围 */}
        <div className="ios-settings-row">
          <div className="ios-settings-row-left">
            <div className="ios-icon-box" style={{ background: 'var(--accent)' }}>
              <PinIconWhite />
            </div>
            <span className="ios-row-title">搜寻范围</span>
          </div>
          <div className="ios-segmented-container distance-selector-width">
            <SegmentedControl
              id="distance-filter"
              value={distancePreference}
              options={DISTANCE_OPTIONS}
              onChange={onDistanceChange}
              disabled={disabled}
            />
          </div>
        </div>

        {/* 细线分割线 */}
        <div className="ios-row-divider" />

        {/* 人均预算 */}
        <div className="ios-settings-row">
          <div className="ios-settings-row-left">
            <div className="ios-icon-box" style={{ background: '#34C759' }}>
              <YenIconWhite />
            </div>
            <span className="ios-row-title">人均预算</span>
          </div>
          <div className="ios-segmented-container price-selector-width">
            <SegmentedControl
              id="price-filter"
              value={pricePreference}
              options={PRICE_OPTIONS}
              onChange={onPriceChange}
              disabled={disabled}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {relaxed && (
          <motion.div
            key="preference-relaxed"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.2 }}
            style={{
              alignSelf: 'center',
              color: 'var(--text-secondary)',
              fontSize: 11,
              fontWeight: 500,
              opacity: 0.7,
            }}
          >
            已为您补充更多可选餐厅
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── 候选池模式切换胶囊 ──────────────────────────────────────────────
function PoolModeButton({
  poolMode,
  onModeToggle,
}: {
  poolMode: PoolMode;
  onModeToggle: () => void;
}) {
  const isExplore = poolMode === 'explore';
  const modeLabel = isExplore ? '探索模式' : '精选模式';

  return (
    <button
      id="pool-mode-btn"
      onClick={onModeToggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '2px 8px',
        background: 'var(--accent)',
        color: 'white',
        border: 'none',
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 700,
        cursor: 'pointer',
        lineHeight: 1.4,
        transition: 'opacity 0.15s',
        whiteSpace: 'nowrap',
      }}
      onMouseEnter={e => (e.currentTarget.style.opacity = '0.8')}
      onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
    >
      {modeLabel}
    </button>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────
export default function App() {
  const [appState, setAppState] = useState<AppState>('idle');
  const [curation, setCuration] = useState<CurationResult>({ all: [], curated: [] });
  const [winner, setWinner] = useState<Restaurant | null>(null);
  const [mealType, setMealType] = useState<MealType>('all');
  const [retryNonce, setRetryNonce] = useState(0);
  const [distancePreference, setDistancePreference] = useState<DistancePreference>('near');
  const [pricePreference, setPricePreference] = useState<PricePreference>('normal');

  // 候选池模式
  const [poolMode, setPoolMode] = useState<PoolMode>('curated');
  const [poolVersion, setPoolVersion] = useState(0); // key for BillCounter remount

  // 黑名单与最爱本地存储状态
  const [blacklist, setBlacklist] = useState<Record<string, Restaurant>>(() => {
    try {
      const raw = localStorage.getItem('w2e_blacklist');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });
  const [favorites, setFavorites] = useState<Record<string, Restaurant>>(() => {
    try {
      const raw = localStorage.getItem('w2e_favorites');
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  const [onlyFavorites, setOnlyFavorites] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);

  // 手动指定位置状态
  const [manualAddressInput, setManualAddressInput] = useState('');
  const [isSearchingGeo, setIsSearchingGeo] = useState(false);
  const [showAddressPopup, setShowAddressPopup] = useState(false);
  const [popupAddressInput, setPopupAddressInput] = useState('');

  // 偏好面板折叠状态
  const [isPreferenceCollapsed, setIsPreferenceCollapsed] = useState(true);

  const location = useGeolocation();

  // 动态拼装折叠时的快捷偏好描述文案
  const collapsedText = useMemo(() => {
    if (onlyFavorites) {
      return "❤️ 专属最爱保底决策池";
    }
    const distText = DISTANCE_OPTIONS.find(o => o.key === distancePreference)?.label ?? '附近';
    const priceText = PRICE_OPTIONS.find(o => o.key === pricePreference)?.label ?? '预算';
    const mealText = MEAL_TABS.find(o => o.key === mealType)?.label ?? '全部';
    return `📍 范围:${distText} · 预算:${priceText} · 品类:${mealText}`;
  }, [onlyFavorites, distancePreference, pricePreference, mealType]);

  const handleManualSearch = async (address: string) => {
    if (!address.trim()) return;
    setIsSearchingGeo(true);
    const coords = await searchAddressCoordinate(address);
    setIsSearchingGeo(false);
    if (coords && location.setManualLocation) {
      const [lat, lng] = coords;
      location.setManualLocation(lat, lng, address);
      setWinner(null);
      if (appState === 'result') setAppState('idle');
      setPoolVersion(v => v + 1);
      setShowAddressPopup(false);
      setManualAddressInput('');
      setPopupAddressInput('');
    } else {
      alert('找不到该地址，请尝试输入更具体的写字楼、地铁站或商圈（例如：静安寺、中关村、科兴科学园）');
    }
  };

  // 彩蛋
  const [punchEgg, setPunchEgg] = useState(false);
  const [showKO, setShowKO] = useState(false);         // 吃我一拳被打晕黑屏
  const [showEasterEgg, setShowEasterEgg] = useState(false);
  const [eggCountdown, setEggCountdown] = useState(10);
  const clickCountRef = useRef(0);
  const EASTER_EGG_THRESHOLD = 5;

  // 彩蛋倒计时
  useEffect(() => {
    if (!showEasterEgg) return;
    setEggCountdown(10);
    const interval = setInterval(() => {
      setEggCountdown(prev => {
        if (prev <= 1) { clearInterval(interval); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [showEasterEgg]);

  useEffect(() => {
    if (location.status !== 'granted' || !location.lat || !location.lng) return;
    const { lat, lng } = location;
    let cancelled = false;

    // ── 命中缓存：直接展示，0 等待 ──
    const cached = readCache(lat, lng);
    if (cached) {
      setCuration(cached);
      setAppState('idle');
      return;
    }

    // ── 无缓存：两段式加载 ──
    setAppState('scanning');
    setCuration({ all: [], curated: [] });
    setWinner(null);
    setMealType('all');
    setPoolMode('curated');
    setDistancePreference('near');
    setPricePreference('normal');

    fetchNearbyRestaurants(
      lat, lng,
      { radius: 5000 },
      (phase1) => {
        if (cancelled) return;
        setCuration(phase1);
        setAppState('idle');
      },
    ).then((fullResult) => {
      if (cancelled) return;
      setCuration(fullResult);
      setAppState('idle');
    });

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.status, location.lat, location.lng, retryNonce]);

  // ── T（API 总数）和 activePool ──────────────────────────────────────
  const T = curation.all.length;

  const preferenceResult = useMemo(
    () => {
      // 剔除黑名单商户
      const cleanedAll = curation.all.filter(r => r.amapId ? !blacklist[r.amapId] : true);
      return filterByPreferences(cleanedAll, distancePreference, pricePreference);
    },
    [curation.all, distancePreference, pricePreference, blacklist],
  );

  const effectiveTarget = useMemo(() => {
    if (poolMode === 'explore') return Math.min(preferenceResult.restaurants.length, 100);
    return 24;
  }, [poolMode, preferenceResult.restaurants.length]);

  const activePool = useMemo(
    () => {
      if (onlyFavorites) {
        return Object.values(favorites);
      }
      return curateCandidates(preferenceResult.restaurants, effectiveTarget);
    },
    [onlyFavorites, favorites, preferenceResult.restaurants, effectiveTarget],
  );

  // 菜系过滤
  const restaurants = mealType === 'all'
    ? activePool
    : activePool.filter(r => getMealType(r.cuisine) === mealType);

  // 探索模式隐藏 Tab 数字，避免把模式切换变成参数阅读
  const mealCounts: Record<MealType, number> = poolMode === 'explore' || onlyFavorites
    ? { all: 0, meal: 0, teatime: 0 }
    : {
        all: activePool.length,
        meal: activePool.filter(r => getMealType(r.cuisine) === 'meal').length,
        teatime: activePool.filter(r => getMealType(r.cuisine) === 'teatime').length,
      };

  // ── 个人收藏 & 避雷数据交互 ─────────────────────────────────────────
  const handleToggleFavorite = useCallback((restaurant: Restaurant) => {
    if (!restaurant.amapId) return;
    setFavorites(prev => {
      const next = { ...prev };
      if (next[restaurant.amapId!]) {
        delete next[restaurant.amapId!];
      } else {
        next[restaurant.amapId!] = restaurant;
      }
      localStorage.setItem('w2e_favorites', JSON.stringify(next));
      return next;
    });
  }, []);

  const handleBlacklist = useCallback((restaurant: Restaurant) => {
    if (!restaurant.amapId) return;
    setBlacklist(prev => {
      const next = { ...prev };
      next[restaurant.amapId!] = restaurant;
      localStorage.setItem('w2e_blacklist', JSON.stringify(next));
      return next;
    });
    setWinner(null);
    setAppState('idle');
    setPoolVersion(v => v + 1); // 刷新轮盘
  }, []);

  const handleRemoveFavorite = useCallback((amapId: string) => {
    setFavorites(prev => {
      const next = { ...prev };
      delete next[amapId];
      localStorage.setItem('w2e_favorites', JSON.stringify(next));
      if (Object.keys(next).length === 0) {
        setOnlyFavorites(false);
      }
      return next;
    });
    setPoolVersion(v => v + 1);
  }, []);

  const handleRemoveBlacklist = useCallback((amapId: string) => {
    setBlacklist(prev => {
      const next = { ...prev };
      delete next[amapId];
      localStorage.setItem('w2e_blacklist', JSON.stringify(next));
      return next;
    });
    setPoolVersion(v => v + 1);
  }, []);

  // ── 候选池模式切换 ─────────────────────────────────────────────────
  const handlePoolModeToggle = () => {
    setPoolMode(mode => mode === 'curated' ? 'explore' : 'curated');
    setPoolVersion(v => v + 1); // 触发 BillCounter 重排
  };

  const handleDistancePreferenceChange = (value: DistancePreference) => {
    setDistancePreference(value);
    setWinner(null);
    if (appState === 'result') setAppState('idle');
    setPoolVersion(v => v + 1);
  };

  const handlePricePreferenceChange = (value: PricePreference) => {
    setPricePreference(value);
    setWinner(null);
    if (appState === 'result') setAppState('idle');
    setPoolVersion(v => v + 1);
  };

  // ── 彩蛋 5% 概率：吃我一拳 ────────────────────────────────────────
  const PUNCH_RESTAURANT: Restaurant = {
    id: -1,
    name: '吃我一拳 🥊',
    cuisine: '神秘菜系',
  };

  const rollingList = punchEgg && restaurants.length > 0
    ? (() => {
        const arr = [...restaurants];
        const pos = Math.floor(Math.random() * (arr.length + 1));
        arr.splice(pos, 0, PUNCH_RESTAURANT);
        return arr;
      })()
    : restaurants;

  // ── 事件处理 ──────────────────────────────────────────────────────
  const trackClick = () => {
    clickCountRef.current += 1;
    if (clickCountRef.current > EASTER_EGG_THRESHOLD) {
      setShowEasterEgg(true);
      return true;
    }
    return false;
  };

  const handleStart = useCallback(() => {
    if (restaurants.length === 0) return;
    if (trackClick()) return;
    const egg = Math.random() < 0.05;
    setPunchEgg(egg);
    setWinner(null);
    setIsPreferenceCollapsed(true); // 开始摇号时自动收缩，释放最大视口空间
    setAppState('rolling');
  }, [restaurants]);

  const handleComplete = useCallback((restaurant: Restaurant) => {
    setPunchEgg(false);
    if (restaurant.id === -1) {
      setAppState('result');
      setTimeout(() => setShowKO(true), 2000);
      return;
    }
    setWinner(restaurant);
    setAppState('result');
  }, []);

  const handleReset = useCallback(() => {
    if (trackClick()) return;
    setPunchEgg(false);
    setWinner(null);
    setAppState('idle');
  }, []);

  const handleRetry = useCallback(() => {
    setRetryNonce(n => n + 1);
  }, []);

  const isRolling = appState === 'rolling';
  const isLoading = appState === 'scanning' || location.status === 'pending';

  return (
    <>
      {/* ── KO 黑屏：吃我一拳被打晕，无退出方式 ── */}
      <AnimatePresence>
        {showKO && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            style={{
              position: 'fixed', inset: 0, zIndex: 99999,
              background: 'black',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: 20,
              userSelect: 'none',
            }}
          >
            <motion.div
              animate={{ x: [0, -12, 14, -10, 8, -6, 4, 0] }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}
            >
              <span style={{ fontSize: 64 }}>🥊</span>
              <div style={{
                fontSize: 28, fontWeight: 800,
                color: 'white',
                letterSpacing: '-0.02em',
              }}>
                你被打晕了
              </div>
              <div style={{
                fontSize: 13, color: 'rgba(255,255,255,0.4)',
                fontWeight: 400,
              }}>
                （关闭并重新打开以继续）
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── 彩蛋：全屏 GIF 覆盖层 ── */}
      <AnimatePresence>
        {showEasterEgg && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => {
              if (eggCountdown > 0) return;
              setShowEasterEgg(false);
              clickCountRef.current = 0;
            }}
            style={{
              position: 'fixed', inset: 0, zIndex: 9999,
              background: 'black',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: eggCountdown > 0 ? 'default' : 'pointer',
            }}
          >
            <img
              src={jackyCheungGif}
              alt="张学友"
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            <div style={{
              position: 'absolute', bottom: 40, left: 0, right: 0,
              textAlign: 'center',
              fontSize: eggCountdown > 0 ? 14 : 16,
              color: 'rgba(255,255,255,0.7)',
              fontWeight: 500, letterSpacing: '0.02em',
              pointerEvents: 'none',
            }}>
              {eggCountdown > 0 ? `${eggCountdown} 秒后可关闭` : '点击任意位置关闭'}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div style={{
        height: '100dvh',
        maxWidth: 430,
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
        overflow: 'hidden',
        padding: '0 16px',
      }}>

        {/* ── Header ── */}
        <motion.div
          style={{ paddingTop: 40, paddingBottom: 10, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.25, 1, 0.5, 1] }}
        >
          <h1 style={{
            fontSize: 28, fontWeight: 800, letterSpacing: '-0.03em',
            color: 'var(--text-primary)', margin: 0, lineHeight: 1.1,
          }}>
            今天吃什么
          </h1>
          <button
            onClick={() => setIsProfileOpen(true)}
            id="profile-trigger-btn"
            style={{
              background: 'rgba(255,255,255,0.7)',
              backdropFilter: 'blur(10px)',
              borderRadius: '50%',
              width: 38,
              height: 38,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
              border: '1px solid rgba(0,0,0,0.04)',
              fontSize: 16,
              transition: 'all 0.15s',
            }}
          >
            ❤️
          </button>
        </motion.div>

        {/* ── Status row ── */}
        <motion.div
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            marginBottom: 8, flexShrink: 0,
            fontSize: 12, color: 'var(--text-secondary)',
            height: 24,
            position: 'relative',
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.15 }}
        >
          {onlyFavorites ? (
            <>
              <span style={{ color: '#FF3B30', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
                <span>❤️</span> 已开启保底池 (只摇最爱)
              </span>
              <button
                onClick={() => {
                  setOnlyFavorites(false);
                  setPoolVersion(v => v + 1);
                }}
                id="disable-only-fav-btn"
                style={{
                  marginLeft: 'auto',
                  border: 'none',
                  background: 'none',
                  color: 'var(--accent)',
                  cursor: 'pointer',
                  fontSize: 12,
                  fontWeight: 600,
                  padding: 0,
                }}
              >
                切回附近
              </button>
            </>
          ) : (
            <>
              <div
                className={`led ${location.status === 'granted' ? 'led-green' : location.status === 'pending' ? 'led-yellow' : ''}`}
                style={location.status !== 'granted' && location.status !== 'pending' ? {
                  background: 'var(--text-tertiary)', width: 7, height: 7,
                  borderRadius: '50%', display: 'inline-block',
                } : undefined}
              />
              <span
                onClick={() => !isRolling && setShowAddressPopup(prev => !prev)}
                id="status-text-trigger"
                style={{ 
                  cursor: isRolling ? 'default' : 'pointer', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: 3,
                  textDecorationLine: isRolling ? 'none' : 'underline',
                  textDecorationStyle: 'dotted',
                  fontWeight: location.addressName ? 600 : 400,
                  color: location.addressName ? 'var(--text-primary)' : 'var(--text-secondary)'
                }}
              >
                {location.status === 'pending' ? '正在定位…'
                  : location.status === 'granted' 
                    ? (location.addressName ? `📍 ${location.addressName}` : '定位成功 (手动修改)')
                    : '定位未授权 (点击输入)'}
              </span>

              {/* 手动修改地址弹出浮窗 */}
              <AnimatePresence>
                {showAddressPopup && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 5 }}
                    style={{
                      position: 'absolute',
                      left: 0,
                      top: 28,
                      zIndex: 900,
                      background: 'rgba(255, 255, 255, 0.95)',
                      backdropFilter: 'blur(20px)',
                      WebkitBackdropFilter: 'blur(20px)',
                      border: '1px solid rgba(0,0,0,0.08)',
                      borderRadius: 12,
                      padding: 10,
                      boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
                      display: 'flex',
                      gap: 6,
                      alignItems: 'center',
                      width: 280,
                    }}
                  >
                    <input
                      type="text"
                      placeholder="输入新商圈/写字楼名..."
                      value={popupAddressInput}
                      onChange={e => setPopupAddressInput(e.target.value)}
                      disabled={isSearchingGeo}
                      onKeyDown={e => e.key === 'Enter' && handleManualSearch(popupAddressInput)}
                      style={{
                        flex: 1,
                        height: 30,
                        borderRadius: 6,
                        border: '1px solid rgba(0,0,0,0.1)',
                        padding: '0 8px',
                        fontSize: 12,
                        outline: 'none',
                        background: 'white',
                        color: 'var(--text-primary)',
                      }}
                    />
                    <button
                      onClick={() => handleManualSearch(popupAddressInput)}
                      disabled={isSearchingGeo || !popupAddressInput.trim()}
                      style={{
                        height: 30,
                        padding: '0 12px',
                        borderRadius: 6,
                        background: 'var(--accent)',
                        color: 'white',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: 'pointer',
                        opacity: (isSearchingGeo || !popupAddressInput.trim()) ? 0.5 : 1,
                      }}
                    >
                      {isSearchingGeo ? '搜索中' : '确定'}
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {Object.keys(favorites).length > 0 && (
                <button
                  onClick={() => {
                    setOnlyFavorites(true);
                    setWinner(null);
                    if (appState === 'result') setAppState('idle');
                    setPoolVersion(v => v + 1);
                  }}
                  id="enable-only-fav-btn"
                  style={{
                    marginLeft: 'auto',
                    border: '1px solid rgba(255, 59, 48, 0.2)',
                    background: 'rgba(255, 59, 48, 0.05)',
                    color: '#FF3B30',
                    padding: '2px 8px',
                    borderRadius: 12,
                    cursor: 'pointer',
                    fontSize: 11,
                    fontWeight: 600,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 3,
                  }}
                >
                  <span>❤️</span> 只摇最爱
                </button>
              )}

              {T > 0 && location.status === 'granted' && Object.keys(favorites).length === 0 && (
                <span style={{ marginLeft: 'auto' }}>
                  <PoolModeButton
                    poolMode={poolMode}
                    onModeToggle={handlePoolModeToggle}
                  />
                </span>
              )}
            </>
          )}
        </motion.div>

        {/* ── Preference & Category Controls (Collapsible) ── */}
        <AnimatePresence initial={false}>
          {isPreferenceCollapsed ? (
            /* 折叠时的极简药丸条 */
            <motion.div
              key="collapsed-bar"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              onClick={() => !isRolling && setIsPreferenceCollapsed(false)}
              className="ios-collapsed-bar"
              style={{ marginBottom: 12, flexShrink: 0 }}
            >
              <span className="ios-collapsed-text">
                {collapsedText}
              </span>
              <span className="ios-collapsed-arrow">▼</span>
            </motion.div>
          ) : (
            /* 展开时的完整大面板 */
            <motion.div
              key="expanded-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 28 }}
              style={{ overflow: 'hidden', flexShrink: 0 }}
            >
              <PreferencePanel
                distancePreference={distancePreference}
                pricePreference={pricePreference}
                onDistanceChange={handleDistancePreferenceChange}
                onPriceChange={handlePricePreferenceChange}
                disabled={isRolling || onlyFavorites}
                relaxed={T > 0 && preferenceResult.relaxed && !onlyFavorites}
              />

              <div style={{ marginBottom: 10 }}>
                <MealFilter
                  value={mealType}
                  onChange={(k) => { setMealType(k); setWinner(null); if (appState === 'result') setAppState('idle'); }}
                  disabled={isRolling || onlyFavorites}
                  counts={mealCounts}
                />
              </div>

              {/* 收起面板的把手按钮 */}
              <div
                onClick={() => setIsPreferenceCollapsed(true)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 18,
                  marginBottom: 8,
                  cursor: 'pointer',
                  fontSize: 11,
                  color: 'var(--text-tertiary)',
                  fontWeight: 700,
                  gap: 3,
                }}
              >
                <span>▲</span> 收起筛选参数
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Machine area ── */}
        <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
          {(onlyFavorites || (location.lat !== undefined && location.lng !== undefined)) ? (
            restaurants.length > 0 || isLoading ? (
              <BillCounter
                key={poolVersion}
                restaurants={rollingList}
                isRolling={isRolling}
                onComplete={handleComplete}
              />
            ) : (
              <div className="machine-body" style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 32 }}>🍽️</span>
                <div style={{ fontSize: 15, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  {onlyFavorites ? '最爱列表已空' : T > 0 ? '该分类暂无餐厅' : '该区域暂无商户推荐'}
                </div>
                {T > 0 && !onlyFavorites && (
                  <button
                    onClick={() => setMealType('all')}
                    style={{
                      marginTop: 4, fontSize: 13, color: 'var(--accent)',
                      background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    查看全部餐厅
                  </button>
                )}
                {onlyFavorites && (
                  <button
                    onClick={() => setOnlyFavorites(false)}
                    style={{
                      marginTop: 4, fontSize: 13, color: 'var(--accent)',
                      background: 'none', border: 'none', cursor: 'pointer', fontWeight: 500,
                    }}
                  >
                    返回搜寻附近
                  </button>
                )}
                {T === 0 && location.status === 'granted' && !onlyFavorites && (
                  <button
                    onClick={handleRetry}
                    style={{
                      marginTop: 4,
                      padding: '8px 16px',
                      borderRadius: 999,
                      border: '1px solid var(--accent)',
                      background: 'rgba(0, 113, 227, 0.08)',
                      color: 'var(--accent)',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: 600,
                    }}
                  >
                    重试
                  </button>
                )}
              </div>
            )
          ) : (
            location.status === 'pending' ? (
              <div className="machine-body" style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 12,
              }}>
                <motion.div
                  style={{
                    width: 32, height: 32, borderRadius: '50%',
                    border: '3px solid var(--border-strong)',
                    borderTopColor: 'var(--accent)',
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}
                />
                <div style={{ fontSize: 14, color: 'var(--text-secondary)', fontWeight: 500 }}>
                  正在搜寻您的坐标…
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-tertiary)' }}>请在弹出的提示中允许位置访问</div>
              </div>
            ) : (
              <div className="machine-body" style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 14,
                padding: '24px 20px',
                textAlign: 'center',
              }}>
                <span style={{ fontSize: 40 }}>📡</span>
                <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                  定位服务不可用
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-secondary)', lineHeight: 1.5, maxWidth: 280 }}>
                  我们无法获取您的位置。请输入当前的写字楼、地铁站或商圈开始搜寻美食：
                </div>

                {/* 搜索输入框 */}
                <div style={{ display: 'flex', gap: 6, width: '100%', maxWidth: 280, marginTop: 4 }}>
                  <input
                    type="text"
                    placeholder="例如：静安寺、科兴科学园..."
                    value={manualAddressInput}
                    onChange={e => setManualAddressInput(e.target.value)}
                    disabled={isSearchingGeo}
                    onKeyDown={e => e.key === 'Enter' && handleManualSearch(manualAddressInput)}
                    style={{
                      flex: 1,
                      height: 38,
                      borderRadius: 8,
                      border: '1px solid rgba(0,0,0,0.1)',
                      padding: '0 12px',
                      fontSize: 13,
                      outline: 'none',
                      background: 'white',
                      color: 'var(--text-primary)',
                    }}
                  />
                  <button
                    onClick={() => handleManualSearch(manualAddressInput)}
                    disabled={isSearchingGeo || !manualAddressInput.trim()}
                    style={{
                      height: 38,
                      padding: '0 16px',
                      borderRadius: 8,
                      background: 'var(--accent)',
                      color: 'white',
                      border: 'none',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                      opacity: (isSearchingGeo || !manualAddressInput.trim()) ? 0.5 : 1,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    {isSearchingGeo ? '搜索' : '确定'}
                  </button>
                </div>

                {/* 快捷商圈 */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>一键体验推荐商圈：</span>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'center' }}>
                    {['陆家嘴', '静安寺', '科兴科学园', '中关村'].map(name => (
                      <button
                        key={name}
                        onClick={() => handleManualSearch(name)}
                        disabled={isSearchingGeo}
                        style={{
                          padding: '4px 10px',
                          borderRadius: 12,
                          border: '1px solid rgba(255, 107, 53, 0.15)',
                          background: 'rgba(255, 107, 53, 0.05)',
                          color: 'var(--accent)',
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        {name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )
          )}

          {/* Result ticket */}
          <AnimatePresence>
            {winner && (
              <motion.div
                style={{ marginTop: 8, flexShrink: 0 }}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25 }}
              >
                <ResultTicket
                  restaurant={winner}
                  isFavorite={winner?.amapId ? !!favorites[winner.amapId] : false}
                  onToggleFavorite={() => winner && handleToggleFavorite(winner)}
                  onBlacklist={() => winner && handleBlacklist(winner)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* ── Bottom button area ── */}
        <div className="ios-safe-bottom">
          <ControlButton
            appState={appState}
            restaurantCount={restaurants.length}
            onStart={handleStart}
            onReset={handleReset}
          />
        </div>
      </div>

      {/* 美食档案抽屉 */}
      <ProfileDrawer
        isOpen={isProfileOpen}
        onClose={() => setIsProfileOpen(false)}
        favorites={favorites}
        blacklist={blacklist}
        onRemoveFavorite={handleRemoveFavorite}
        onRemoveBlacklist={handleRemoveBlacklist}
      />
    </>
  );
}

// ─── 内联微型白图标 ──────────────────────────────────────────────────────
function PinIconWhite() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7z" />
      <circle cx="12" cy="9" r="2.5" />
    </svg>
  );
}

function YenIconWhite() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ffffff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 12h12" />
      <path d="M6 16h12" />
      <path d="M12 12v8" />
      <path d="M19 4l-7 8-7-8" />
    </svg>
  );
}
