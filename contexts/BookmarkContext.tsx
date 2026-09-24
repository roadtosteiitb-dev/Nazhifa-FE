import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useAuth } from "./AuthContext";
import { useLands } from "./LandContext";
import { addFavorite, fetchFavoriteIds, removeFavorite } from "../services/FavoriteService";

export type FavoriteItem = {
  id: string;
  name: string;
  image?: string;
  location?: string;
  price?: number;
  forSale?: boolean;
  rating?: number;
};

type BookmarkContextType = {
  /** saved properties with full details (from the property list) */
  favorites: FavoriteItem[];
  toggleFavorite: (item: FavoriteItem | string) => Promise<void>;
  isFavorite: (id: string) => boolean;
  loadFavorites: () => Promise<void>;
};

const BookmarkContext = createContext<BookmarkContextType>({
  favorites: [],
  toggleFavorite: async () => {},
  isFavorite: () => false,
  loadFavorites: async () => {},
});

/** Local cache (per user) so the list shows instantly and survives offline starts */
const cacheKey = (userId?: string | null) => `@loka:favorites:${userId ?? "guest"}`;
/** Pre-server favorites were stored here as full objects — migrated to the server once */
const LEGACY_KEY = "@loka:favorites";

const readIds = async (key: string): Promise<string[]> => {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((x: any) => String(typeof x === "object" ? x.id : x)) : [];
  } catch {
    return [];
  }
};

/**
 * Favorites are stored on the server (GET/POST/DELETE /favorites) so the owner's
 * "Total Favorit" statistic is real. Toggling is optimistic and rolls back on failure.
 */
export const BookmarkProvider = ({ children }: { children: React.ReactNode }) => {
  const { user } = useAuth();
  const { lands } = useLands();
  const [favoriteIds, setFavoriteIds] = useState<string[]>([]);
  const idsRef = useRef<string[]>([]);
  idsRef.current = favoriteIds;

  const persist = useCallback(
    (ids: string[]) => AsyncStorage.setItem(cacheKey(user?.id), JSON.stringify(ids)).catch(() => {}),
    [user?.id]
  );

  const loadFavorites = useCallback(async () => {
    const cached = await readIds(cacheKey(user?.id));
    setFavoriteIds(cached);
    if (!user) return;
    try {
      let serverIds = await fetchFavoriteIds();

      // One-time migration of favorites saved on this device before they lived on the server
      const legacy = await readIds(LEGACY_KEY);
      const toUpload = legacy.filter((id) => !serverIds.includes(id));
      if (toUpload.length) {
        await Promise.allSettled(toUpload.map((id) => addFavorite(id)));
        serverIds = [...serverIds, ...toUpload];
      }
      if (legacy.length) await AsyncStorage.removeItem(LEGACY_KEY);

      setFavoriteIds(serverIds);
      persist(serverIds);
    } catch {
      // offline — keep the cached list
    }
  }, [user?.id, persist]);

  useEffect(() => {
    loadFavorites();
  }, [loadFavorites]);

  const toggleFavorite = useCallback(
    async (item: FavoriteItem | string) => {
      const id = String(typeof item === "string" ? item : item.id);
      const before = idsRef.current;
      const wasFavorite = before.includes(id);
      const next = wasFavorite ? before.filter((x) => x !== id) : [id, ...before];

      setFavoriteIds(next);
      persist(next);
      if (!user) return;

      try {
        if (wasFavorite) await removeFavorite(id);
        else await addFavorite(id);
      } catch (err) {
        // Roll back so the UI matches the server
        setFavoriteIds(before);
        persist(before);
        throw err;
      }
    },
    [user?.id, persist]
  );

  const isFavorite = useCallback((id: string) => favoriteIds.includes(String(id)), [favoriteIds]);

  // Resolve ids to full items using the property list
  const favorites: FavoriteItem[] = useMemo(() => {
    const byId = new Map(lands.map((l) => [String(l.id), l]));
    return favoriteIds
      .map((id) => byId.get(id))
      .filter((l): l is NonNullable<typeof l> => !!l)
      .map((l) => ({
        id: String(l.id),
        name: l.name,
        image: l.image,
        location: l.location,
        price: l.price,
        forSale: l.isForSale,
      }));
  }, [favoriteIds, lands]);

  return (
    <BookmarkContext.Provider value={{ favorites, toggleFavorite, isFavorite, loadFavorites }}>
      {children}
    </BookmarkContext.Provider>
  );
};

export const useBookmark = () => useContext(BookmarkContext);
