/**
 * LayerService – loads disaster polygon layers from Laravel + PostGIS.
 * Implements an in-memory cache so each layer type is fetched only once per session.
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

// In-memory cache: layerType -> polygon array
const _cache = new Map<string, DisasterPolygon[]>();

/** Valid layer types accepted by GET /api/layers/{type} */
export type LayerType =
  | "flood"
  | "landslide"
  | "drought"
  | "eruption"
  | "liquefaction"
  | "extreme_weather";

/**
 * Fetch polygons for a single disaster layer.
 * Results are cached in memory after the first successful fetch.
 * Pass an AbortSignal to support request cancellation.
 */
export async function fetchLayer(
  type: LayerType,
  signal?: AbortSignal
): Promise<DisasterPolygon[]> {
  if (_cache.has(type)) {
    return _cache.get(type)!;
  }

  const res = await api.get(`/layers/${type}`, { signal });
  const data = res.data as DisasterPolygon[];
  _cache.set(type, data);
  return data;
}

/**
 * Fetch multiple active layers concurrently using Promise.all.
 * Cancelled layers (AbortError) are silently ignored.
 */
export async function fetchActiveLayers(
  types: LayerType[],
  signal?: AbortSignal
): Promise<DisasterPolygon[]> {
  const results = await Promise.allSettled(
    types.map((type) => fetchLayer(type, signal))
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
