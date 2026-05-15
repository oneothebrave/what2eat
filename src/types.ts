export interface Restaurant {
  id: number;
  name: string;
  cuisine?: string;
  distance?: string;      // 展示用，如 "350m" / "1.2km"
  distanceMeters?: number; // 实际米数，用于精选过滤
  rating?: number;
  cost?: string;          // 人均消费，如 "¥38"
  location?: string;      // GCJ-02 坐标，格式 "lng,lat"（高德格式）
  amapId?: string;        // 高德 POI ID，用于精确跳转
}

export type AppState = 'idle' | 'locating' | 'scanning' | 'rolling' | 'result';

export interface LocationStatus {
  status: 'pending' | 'granted' | 'denied' | 'unavailable';
  lat?: number;
  lng?: number;
}

// 精选结果：包含原始总数 + 精选后候选池
export interface CurationResult {
  all: Restaurant[];       // 从 API 拉取的原始列表
  curated: Restaurant[];   // 精选后的候选池（20~30 家）
}
