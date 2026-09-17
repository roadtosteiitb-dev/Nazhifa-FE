import React, { createContext, useContext, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
  favorites: FavoriteItem[];
  toggleFavorite: (item: FavoriteItem) => void;
  isFavorite: (id: string) => boolean;
  loadFavorites: () => Promise<void>;
};

const BookmarkContext = createContext<BookmarkContextType>({
  favorites: [],
  toggleFavorite: () => {},
  isFavorite: () => false,
  loadFavorites: async () => {},
});

export const BookmarkProvider = ({ children }: { children: React.ReactNode }) => {
  const [favorites, setFavorites] = useState<FavoriteItem[]>([]);
  const STORAGE_KEY = "@loka:favorites";

  const loadFavorites = async () => {
    try {
      const stored = await AsyncStorage.getItem(STORAGE_KEY);
      if (stored) setFavorites(JSON.parse(stored));
    } catch (err) {
      console.error("Gagal memuat favorit:", err);
    }
  };

  useEffect(() => {
    loadFavorites();
  }, []);

  const toggleFavorite = async (item: FavoriteItem) => {
    try {
      const exists = favorites.some((f) => f.id === item.id);
      let updated: FavoriteItem[];

      if (exists) {
        updated = favorites.filter((f) => f.id !== item.id);
      } else {
        updated = [...favorites, item];
      }

      setFavorites(updated);
      await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    } catch (err) {
      console.error("Gagal update favorit:", err);
    }
  };

  const isFavorite = (id: string) => favorites.some((f) => f.id === id);

  return (
    <BookmarkContext.Provider value={{ favorites, toggleFavorite, isFavorite, loadFavorites }}>
      {children}
    </BookmarkContext.Provider>
  );
};

export const useBookmark = () => useContext(BookmarkContext);
