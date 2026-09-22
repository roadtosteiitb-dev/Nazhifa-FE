/**
 * LayerService – loads disaster polygon layers from Laravel + PostGIS.
 * Layers are fetched per-viewport (bbox) so huge tables (extreme_weather,
 * drought, liquefaction — tens of thousands of rows) never have to be pulled
 * or simplified in full; the server only queries what's near the given bbox.
 * Implements an in-memory cache keyed by layerType + a coarse grid-snapped
 * bbox tile, so panning within the same ~5.5km tile reuses the cached result.
 * Supports AbortController to cancel in-flight requests when layers change rapidly.
 */
import api from "./apiClient";

export interface PolygonCoordinate {
  latitude: number;
  longitude: number;
}

export interface DisasterPolygon {
  id: string;
  disasterType: string;
  level: "low" | "medium" | "high";
  title: string;
  coordinates: PolygonCoordinate[];
  fillColor: string;
  strokeColor: string;
}

export interface BBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

// In-memory cache: "layerType:snappedBBoxKey" -> polygon array
const _cache = new Map<string, DisasterPolygon[]>();

/** Must match the backend's GRID_SIZE in LayerController so tile keys line up. */
const GRID_SIZE = 0.05;

function snapBBoxKey(bbox?: BBox): string {
  if (!bbox) return "all";
  const snap = (v: number, roundUp: boolean) =>
    (roundUp ? Math.ceil(v / GRID_SIZE) : Math.floor(v / GRID_SIZE)) * GRID_SIZE;
  return [
    snap(bbox.minLat, false),
    snap(bbox.minLng, false),
    snap(bbox.maxLat, true),
    snap(bbox.maxLng, true),
  ].join(",");
}

/** Valid layer types accepted by GET /api/layers/{type} */
export type LayerType =
  | "flood"
  | "landslide"
  | "drought"
  | "eruption"
  | "liquefaction"
  | "extreme_weather";

/**
 * Fetch polygons for a single disaster layer within (optionally) a map viewport.
 * Results are cached in memory per layer+tile after the first successful fetch.
 * Pass an AbortSignal to support request cancellation.
 */
export async function fetchLayer(
  type: LayerType,
  bbox?: BBox,
  signal?: AbortSignal
): Promise<DisasterPolygon[]> {
  const cacheKey = `${type}:${snapBBoxKey(bbox)}`;
  if (_cache.has(cacheKey)) {
    return _cache.get(cacheKey)!;
  }

  const res = await api.get(`/layers/${type}`, {
    signal,
    params: bbox
      ? {
          min_lat: bbox.minLat,
          max_lat: bbox.maxLat,
          min_lng: bbox.minLng,
          max_lng: bbox.maxLng,
        }
      : undefined,
  });
  const data = res.data as DisasterPolygon[];
  _cache.set(cacheKey, data);
  return data;
}

/**
 * Fetch multiple active layers concurrently using Promise.all.
 * Cancelled layers (AbortError) are silently ignored.
 */
export async function fetchActiveLayers(
  types: LayerType[],
  bbox?: BBox,
  signal?: AbortSignal
): Promise<DisasterPolygon[]> {
  const results = await Promise.allSettled(
    types.map((type) => fetchLayer(type, bbox, signal))
  );

  const polygons: DisasterPolygon[] = [];
  for (const result of results) {
    if (result.status === "fulfilled") {
      polygons.push(...result.value);
    }
  }
  return polygons;
}

/** Clear the in-memory cache (useful for testing or forced refresh) */
export function clearLayerCache(): void {
  _cache.clear();
}
