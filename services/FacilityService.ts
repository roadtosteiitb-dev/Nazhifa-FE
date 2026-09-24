/**
 * FacilityService – fetches nearest public facilities from Laravel + pgRouting.
 * Distance calculations are performed exclusively in PostgreSQL via ST_Distance.
 * React Native never computes distances.
 */
import api from "./apiClient";

export interface NearestFacility {
  category: string;
  icon: string;
  name: string;
  distanceKm: number;
  travelTimeMinutes: number;
  lat: number;
  lng: number;
}

export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface RouteResult {
  distanceKm: number;       // road distance
  durationMinutes: number;  // driving time
  coordinates: LatLng[];    // route line, property → destination
  from: LatLng;
  to: LatLng;
}

export interface ApiFacility {
  id: string;
  name: string;
  amenity: string;
  category: string;
  lat: number;
  lng: number;
}

/**
 * GET /api/facilities
 * Returns all public facilities with coordinates (for admin spatial map).
 */
export async function fetchFacilities(
  params?: {
    amenities?: string[];
    bbox?: { minLat: number; maxLat: number; minLng: number; maxLng: number };
  },
  signal?: AbortSignal
): Promise<ApiFacility[]> {
  const query: Record<string, string | number> = {};
  if (params?.amenities?.length) query.amenity = params.amenities.join(",");
  if (params?.bbox) {
    query.min_lat = params.bbox.minLat;
    query.max_lat = params.bbox.maxLat;
    query.min_lng = params.bbox.minLng;
    query.max_lng = params.bbox.maxLng;
  }
  const res = await api.get("/facilities", { params: query, signal });
  return res.data as ApiFacility[];
}

/**
 * GET /api/lands/{id}/facilities
 * Returns nearest public facilities per category, sorted by distance.
 * Distance and travel time are computed by PostGIS/pgRouting on the backend.
 */
export async function fetchNearestFacilities(
  landId: string
): Promise<NearestFacility[]> {
  const res = await api.get(`/lands/${landId}/facilities`);
  return res.data as NearestFacility[];
}

/**
 * GET /api/lands/{id}/route?to_lat=&to_lng=
 * Road route (driving) from the property to a destination, computed server-side.
 */
export async function fetchRoute(
  landId: string,
  to: { lat: number; lng: number }
): Promise<RouteResult> {
  const res = await api.get(`/lands/${landId}/route`, {
    params: { to_lat: to.lat, to_lng: to.lng },
  });
  return res.data as RouteResult;
}
