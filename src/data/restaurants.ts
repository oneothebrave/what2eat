import type { Restaurant, CurationResult } from '../types';

// ─── 高德地图 API 类型 ────────────────────────────────────────────────
interface AmapPOI {
  id: string;
  name: string;
  type: string;      // 如 "餐饮服务;快餐厅;汉堡"
  distance: string;  // 单位：米
  location: string;  // GCJ-02 坐标，格式 "经度,纬度"
  biz_ext?: {
    rating?: string;
    cost?: string;
    open_time?: string;
  };
  business_area?: string;
  pname?: string;
  cityname?: string;
  adname?: string;
}

interface AmapResponse {
  status: string;
  info: string;
  count: string;
  pois: AmapPOI[];
}

// ─── localStorage 缓存 ────────────────────────────────────────────────
const CACHE_TTL_MS = 30 * 60 * 1000; // 30 分钟
const CACHE_VER = 'w2e_v3';

interface CacheEntry {
  ts: number;
  data: CurationResult;
}

/** 位置四舍五入到小数点后 3 位（精度约 110m），同一区域共用缓存 */
function cacheKey(lat: number, lng: number): string {
  const rLat = (Math.round(lat * 1000) / 1000).toFixed(3);
  const rLng = (Math.round(lng * 1000) / 1000).toFixed(3);
  return `${CACHE_VER}_${rLat}_${rLng}`;
}

export function readCache(lat: number, lng: number): CurationResult | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lng));
    if (!raw) return null;
    const entry: CacheEntry = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      localStorage.removeItem(cacheKey(lat, lng));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

function writeCache(lat: number, lng: number, data: CurationResult): void {
  try {
    const entry: CacheEntry = { ts: Date.now(), data };
    localStorage.setItem(cacheKey(lat, lng), JSON.stringify(entry));
  } catch {
    // localStorage 已满时静默忽略
  }
}

// ─── 辅助函数 ─────────────────────────────────────────────────────────
function parseCuisine(type: string): string {
  if (!type) return '餐厅';
  const parts = type.split(';').filter(Boolean);
  return parts[parts.length - 1] ?? parts[0] ?? '餐厅';
}

/** 提取品牌名：去掉括号内内容、店号、方向等词缀，保留核心品牌 */
function extractBrand(name: string): string {
  return name
    .replace(/（[^）]*）|\([^)]*\)/g, '')
    .replace(/[\d一二三四五六七八九十百]+号?(店|店铺|分店|店面|餐厅)?$/u, '')
    .replace(/(东|西|南|北|中|上|下|左|右|新|老)(店|区|馆|餐厅)$/u, '')
    .replace(/(旗舰店|直营店|加盟店|总店|网红店)$/u, '')
    .trim()
    .slice(0, 6);
}

function formatDistance(meters: number): string {
  return meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${meters}m`;
}

function poiToRestaurant(poi: AmapPOI, index: number): Restaurant {
  const distanceMeters = parseInt(poi.distance, 10) || 0;
  return {
    id: index + 1,
    name: poi.name,
    cuisine: parseCuisine(poi.type),
    distanceMeters,
    distance: formatDistance(distanceMeters),
    rating: poi.biz_ext?.rating ? parseFloat(poi.biz_ext.rating) : undefined,
    cost: poi.biz_ext?.cost ? `¥${poi.biz_ext.cost}` : undefined,
    location: poi.location,
    amapId: poi.id,
  };
}

// ─── WGS84 → GCJ-02 坐标转换 ─────────────────────────────────────────
const GCJ_A = 6378245.0;
const GCJ_EE = 0.00669342162296594323;

function _outOfChina(lat: number, lng: number): boolean {
  return lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271;
}

function _transformLat(x: number, y: number): number {
  let r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(y * Math.PI) + 40 * Math.sin(y / 3 * Math.PI)) * 2 / 3;
  r += (160 * Math.sin(y / 12 * Math.PI) + 320 * Math.sin(y * Math.PI / 30)) * 2 / 3;
  return r;
}

function _transformLng(x: number, y: number): number {
  let r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  r += (20 * Math.sin(6 * x * Math.PI) + 20 * Math.sin(2 * x * Math.PI)) * 2 / 3;
  r += (20 * Math.sin(x * Math.PI) + 40 * Math.sin(x / 3 * Math.PI)) * 2 / 3;
  r += (150 * Math.sin(x / 12 * Math.PI) + 300 * Math.sin(x / 30 * Math.PI)) * 2 / 3;
  return r;
}

function wgs84ToGcj02(lat: number, lng: number): [number, number] {
  if (_outOfChina(lat, lng)) return [lat, lng];
  let dLat = _transformLat(lng - 105, lat - 35);
  let dLng = _transformLng(lng - 105, lat - 35);
  const radLat = (lat / 180) * Math.PI;
  let magic = Math.sin(radLat);
  magic = 1 - GCJ_EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180) / ((GCJ_A * (1 - GCJ_EE)) / (magic * sqrtMagic) * Math.PI);
  dLng = (dLng * 180) / (GCJ_A / sqrtMagic * Math.cos(radLat) * Math.PI);
  return [lat + dLat, lng + dLng];
}

// ─── 精选候选池 ───────────────────────────────────────────────────────
const MIN_RATING = 3.8;
const MAX_PER_CUISINE = 3;

export function curateCandidates(restaurants: Restaurant[], targetCount: number = 24): Restaurant[] {
  if (restaurants.length === 0) return [];

  // Step 1: 评分过滤（无评分保留，视为未知）
  const rated = restaurants.filter(r => r.rating == null || r.rating >= MIN_RATING);

  // Step 2: 品牌去重 — 同品牌只保留综合得分最高的一家
  const brandMap = new Map<string, Restaurant>();
  for (const r of rated) {
    const brand = extractBrand(r.name);
    const existing = brandMap.get(brand);
    if (!existing) {
      brandMap.set(brand, r);
    } else {
      const newScore = (r.rating ?? 0) * 1000 - (r.distanceMeters ?? 9999);
      const oldScore = (existing.rating ?? 0) * 1000 - (existing.distanceMeters ?? 9999);
      if (newScore > oldScore) brandMap.set(brand, r);
    }
  }
  const deduped = Array.from(brandMap.values());

  // Step 3: 综合评分排序
  // rating × 600 − distanceKm × 100（距差 1km ≈ 评分差 0.17）
  const scored = deduped.map(r => ({
    r,
    score: (r.rating ?? 3.5) * 600 - (r.distanceMeters ?? 9999) / 1000 * 100,
  })).sort((a, b) => b.score - a.score);

  // Step 4: 菜系去重，取前 targetCount 家
  const cuisineCount = new Map<string, number>();
  const result: Restaurant[] = [];

  for (const { r } of scored) {
    if (result.length >= targetCount) break;
    const cuisine = r.cuisine ?? '其他';
    const cnt = cuisineCount.get(cuisine) ?? 0;
    if (cnt < MAX_PER_CUISINE) {
      result.push(r);
      cuisineCount.set(cuisine, cnt + 1);
    }
  }

  // 不足则从剩余中按排名补充
  if (result.length < targetCount) {
    const resultIds = new Set(result.map(r => r.id));
    for (const { r } of scored) {
      if (result.length >= targetCount) break;
      if (!resultIds.has(r.id)) {
        result.push(r);
        resultIds.add(r.id);
      }
    }
  }

  return result;
}

// ─── 单页请求封装 ─────────────────────────────────────────────────────
async function fetchOnePage(
  apiKey: string,
  gcjLng: number,
  gcjLat: number,
  radius: number,
  page: number,
): Promise<{ pois: AmapPOI[]; total: number }> {
  const PAGE_SIZE = 25;
  const params = new URLSearchParams({
    key: apiKey,
    location: `${gcjLng},${gcjLat}`,
    radius: String(radius),
    types: '050000',
    offset: String(PAGE_SIZE),
    page: String(page),
    extensions: 'all',
    output: 'json',
  });
  const resp = await fetch(`/api/amap/v3/place/around?${params}`);
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const data: AmapResponse = await resp.json();
  if (data.status !== '1') throw new Error(`高德 API 错误: ${data.info}`);
  return {
    pois: data.pois ?? [],
    total: parseInt(data.count, 10) || 0,
  };
}

// ─── 主入口 ───────────────────────────────────────────────────────────
export interface FetchOptions {
  radius: number;
}

/**
 * 获取附近餐厅，支持两段式加载 + localStorage 缓存。
 *
 * 流程：
 *   1. 命中缓存 → 立即返回，不发网络请求
 *   2. 无缓存 → 拉取第 1 页后立即调用 onPhaseOne（用户可以开始操作）
 *              → 后台继续拉取剩余页，完成后写缓存并 resolve Promise
 *
 * @param onPhaseOne  第 1 页拉取完毕时的回调，参数为初步精选结果
 */
export async function fetchNearbyRestaurants(
  lat: number,
  lng: number,
  options: FetchOptions = { radius: 5000 },
  onPhaseOne?: (result: CurationResult) => void,
): Promise<CurationResult> {
  const apiKey = import.meta.env.VITE_AMAP_KEY as string | undefined;

  if (!apiKey || apiKey === 'your_key_here') {
    console.warn('[What2Eat] 未配置 VITE_AMAP_KEY，无法获取餐厅数据');
    return { all: [], curated: [] };
  }

  // ── 缓存命中：立即返回 ──
  const cached = readCache(lat, lng);
  if (cached) {
    console.log(`[What2Eat] 缓存命中，共 ${cached.all.length} 家`);
    onPhaseOne?.(cached); // 同步通知，让调用方统一走 onPhaseOne 路径
    return cached;
  }

  const [gcjLat, gcjLng] = wgs84ToGcj02(lat, lng);
  const PAGE_SIZE = 25;

  try {
    // ── 第一阶段：拉取第 1 页，立即精选展示 ──
    const { pois: firstPois, total } = await fetchOnePage(apiKey, gcjLng, gcjLat, options.radius, 1);

    if (!firstPois.length) return { all: [], curated: [] };

    const phase1All = firstPois.map(poiToRestaurant);
    const phase1Result: CurationResult = {
      all: phase1All,
      curated: curateCandidates(phase1All),
    };
    onPhaseOne?.(phase1Result);

    // ── 第二阶段：串行拉取剩余页，后台静默完成 ──
    const allPois: AmapPOI[] = [...firstPois];
    const totalPages = Math.ceil(total / PAGE_SIZE);

    for (let page = 2; page <= totalPages; page++) {
      try {
        const { pois } = await fetchOnePage(apiKey, gcjLng, gcjLat, options.radius, page);
        if (!pois.length) break;
        allPois.push(...pois);
        if (pois.length < PAGE_SIZE) break; // 最后一页
      } catch {
        break;
      }
    }

    const allRestaurants = allPois.map(poiToRestaurant);
    const fullResult: CurationResult = {
      all: allRestaurants,
      curated: curateCandidates(allRestaurants),
    };

    // 写入缓存（下次打开秒开）
    writeCache(lat, lng, fullResult);
    console.log(`[What2Eat] 全量加载完成，共 ${allRestaurants.length} 家，已缓存`);

    return fullResult;

  } catch (err) {
    console.error('[What2Eat] 高德 API 请求失败:', err);
    return { all: [], curated: [] };
  }
}
