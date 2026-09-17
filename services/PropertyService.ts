/**
 * PropertyService – all API calls related to land properties.
 * Components must use this service instead of calling api directly.
 */
import api from "./apiClient";

export interface ApiLand {
  id: string;
  name: string;
  location: string;
  price: number;
  isForSale: boolean;
  type: string;
  status: string;
  ownerId: string;
  owner: string | null;
  description: string | null;
  image: string | null;
  images: string[];
  area: { land: string | null; building: string | null };
  floors: number | null;
  bedrooms: number | null;
  bathrooms: number | null;
  electricity: number | null;
  certificate: string | null;
  certificateImage: string | null;
  garage: string | null;
  unitFloor: number | null;
  unitType: string | null;
  furnished: string | null;
  facilities: string[];
  views: number;
  favorites: number;
  inquiriesCount: number;
  center: { latitude: number; longitude: number } | null;
  distanceKm: number | null;
  rejectionReason: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** GET /api/lands — full list with optional filters */
export async function fetchLands(params?: {
  status?: string;
  ownerId?: string;
}): Promise<ApiLand[]> {
  const res = await api.get("/lands", { params });
  return res.data as ApiLand[];
}

/** GET /api/lands/spatial/nearby — lands within radius of user location */
export async function fetchNearbyLands(params: {
  lat: number;
  lng: number;
  radius: number; // km
  status?: string;
}): Promise<ApiLand[]> {
  const res = await api.get("/lands/spatial/nearby", { params });
  return res.data as ApiLand[];
}

/** GET /api/lands/{id} — single property detail including coordinates */
export async function fetchLandById(id: string): Promise<ApiLand> {
  const res = await api.get(`/lands/${id}`);
  return res.data as ApiLand;
}
