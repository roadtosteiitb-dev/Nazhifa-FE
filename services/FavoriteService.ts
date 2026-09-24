/**
 * FavoriteService – saved properties of the logged-in user (server-side).
 */
import api from "./apiClient";

/** GET /api/favorites — ids of saved properties, newest first */
export async function fetchFavoriteIds(): Promise<string[]> {
  const res = await api.get("/favorites");
  return (res.data as string[]).map(String);
}

/** POST /api/lands/{id}/favorite */
export async function addFavorite(landId: string): Promise<number> {
  const res = await api.post(`/lands/${landId}/favorite`);
  return res.data.favorites as number;
}

/** DELETE /api/lands/{id}/favorite */
export async function removeFavorite(landId: string): Promise<number> {
  const res = await api.delete(`/lands/${landId}/favorite`);
  return res.data.favorites as number;
}
