import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import api from "@/services/apiClient";

// ==============================
// 🧩 Interface Definitions  (UNCHANGED — UI components remain the same)
// ==============================
export interface Land {
  id: string;
  name: string;
  location: string;
  coords?: { latitude: number; longitude: number }[];
  center?: { latitude: number; longitude: number };
  image?: string;
  images?: string[];
  area?: { land?: string; building?: string };
  price?: number;
  status?: "Pending" | "Approved" | "Rejected" | "Sold" | "Archived";
  owner?: string;
  ownerId?: string;
  isOnline?: boolean;
  isForSale?: boolean;
  rating?: number;
  type?: "house" | "apartment";
  facilities?: string[];
  description?: string;
  floors?: number;
  bedrooms?: number;
  bathrooms?: number;
  electricity?: number;
  certificate?: string;
  garage?: string;
  unitFloor?: number;
  unitType?: string;
  furnished?: "furnished" | "semi" | "unfurnished";
  views?: number;
  favorites?: number;
  inquiriesCount?: number;
  certificateImage?: string;
  createdAt?: string;
  rejectionReason?: string;
  // Spatial
  distanceKm?: number;
}

export interface NotificationItem {
  id: string;
  propertyId: string;
  propertyName: string;
  type: "submitted" | "approved" | "rejected" | "archived" | "sold";
  ownerName: string;
  reason?: string;
  timestamp: number;
  read: boolean;
}

interface LandContextType {
  lands: Land[];
  setLands: React.Dispatch<React.SetStateAction<Land[]>>;
  notifications: NotificationItem[];
  setNotifications: React.Dispatch<React.SetStateAction<NotificationItem[]>>;
  addNotification: (
    propertyId: string,
    propertyName: string,
    type: "submitted" | "approved" | "rejected" | "archived" | "sold",
    ownerName: string,
    reason?: string
  ) => void;
  incrementViews: (id: string) => void;
  incrementFavorites: (id: string) => void;
  incrementInquiries: (id: string) => void;
  updateLandStatus: (
    id: string,
    status: "Approved" | "Rejected" | "Sold" | "Archived",
    rejectionReason?: string
  ) => Promise<void>;
  refreshLands: () => Promise<void>;
  isLoading: boolean;
}

const LandContext = createContext<LandContextType | undefined>(undefined);

// Map API response to frontend Land interface
const mapApiLand = (d: any): Land => ({
  id:              String(d.id),
  name:            d.name,
  location:        d.location,
  price:           d.price,
  isForSale:       d.isForSale ?? true,
  type:            d.type,
  status:          d.status,
  owner:           d.owner,
  ownerId:         d.ownerId,
  description:     d.description,
  image:           d.image,
  images:          d.images,
  area:            d.area,
  floors:          d.floors,
  bedrooms:        d.bedrooms,
  bathrooms:       d.bathrooms,
  electricity:     d.electricity,
  certificate:     d.certificate,
  certificateImage:d.certificateImage,
  garage:          d.garage,
  unitFloor:       d.unitFloor,
  unitType:        d.unitType,
  furnished:       d.furnished,
  facilities:      d.facilities || [],
  views:           d.views ?? 0,
  favorites:       d.favorites ?? 0,
  inquiriesCount:  d.inquiriesCount ?? 0,
  center:          d.center,
  distanceKm:      d.distanceKm,
  rejectionReason: d.rejectionReason,
  createdAt:       d.createdAt,
});

export const LandProvider = ({ children }: { children: ReactNode }) => {
  const [lands, setLands] = useState<Land[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fetch lands from backend
  const refreshLands = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await api.get("/lands");
      setLands((res.data as any[]).map(mapApiLand));
    } catch (error) {
      console.error("❌ Error fetching lands:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Initial load
  useEffect(() => {
    refreshLands();
  }, [refreshLands]);

  // addNotification — fires when Admin changes land status
  // (Notification creation is also done server-side in PATCH /api/lands/:id/status)
  const addNotification = (
    propertyId: string,
    propertyName: string,
    type: "submitted" | "approved" | "rejected" | "archived" | "sold",
    ownerName: string,
    reason?: string
  ) => {
    const newNotif: NotificationItem = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      propertyId,
      propertyName,
      type,
      ownerName,
      reason,
      timestamp: Date.now(),
      read: false,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  // Analytics helpers — call backend to persist the count
  const incrementViews = async (id: string) => {
    setLands((prev) =>
      prev.map((l) => (l.id === id ? { ...l, views: (l.views || 0) + 1 } : l))
    );
    try { await api.put(`/lands/${id}/analytics`, { field: "views" }); } catch {}
  };

  const incrementFavorites = async (id: string) => {
    setLands((prev) =>
      prev.map((l) => (l.id === id ? { ...l, favorites: (l.favorites || 0) + 1 } : l))
    );
    try { await api.put(`/lands/${id}/analytics`, { field: "favorites" }); } catch {}
  };

  const incrementInquiries = async (id: string) => {
    setLands((prev) =>
      prev.map((l) => (l.id === id ? { ...l, inquiriesCount: (l.inquiriesCount || 0) + 1 } : l))
    );
    try { await api.put(`/lands/${id}/analytics`, { field: "inquiries_count" }); } catch {}
  };

  // Persist a status change (approve/reject/etc.) to the backend.
  // Also creates the owner-facing notification server-side.
  const updateLandStatus = async (
    id: string,
    status: "Approved" | "Rejected" | "Sold" | "Archived",
    rejectionReason?: string
  ) => {
    const target = lands.find((l) => l.id === id);

    await api.patch(`/lands/${id}/status`, { status, rejectionReason });

    setLands((prev) =>
      prev.map((l) => (l.id === id ? { ...l, status, rejectionReason } : l))
    );

    if (target) {
      const typeMap: Record<string, "approved" | "rejected" | "sold" | "archived"> = {
        Approved: "approved", Rejected: "rejected", Sold: "sold", Archived: "archived",
      };
      addNotification(id, target.name, typeMap[status], target.owner || "Owner", rejectionReason);
    }
  };

  return (
    <LandContext.Provider value={{
      lands, setLands,
      notifications, setNotifications,
      addNotification,
      incrementViews, incrementFavorites, incrementInquiries,
      updateLandStatus,
      refreshLands, isLoading,
    }}>
      {children}
    </LandContext.Provider>
  );
};

export const useLands = (): LandContextType => {
  const context = useContext(LandContext);
  if (!context) throw new Error("useLands must be used within a LandProvider");
  return context;
};
