/**
 * NotificationService – owner notifications (property submitted / approved / rejected / sold / archived).
 */
import api from "./apiClient";

export type NotificationType = "submitted" | "approved" | "rejected" | "archived" | "sold";

export interface ApiNotification {
  id: string;
  propertyId: string;
  propertyName: string;
  type: NotificationType;
  ownerId: string;
  reason: string | null;
  isRead: boolean;
  createdAt: string | null;
}

/** GET /api/notifications — notifications of the logged-in owner, newest first */
export async function fetchNotifications(): Promise<ApiNotification[]> {
  const res = await api.get("/notifications");
  return res.data as ApiNotification[];
}

/** PUT /api/notifications/read-all */
export async function markAllNotificationsRead(): Promise<void> {
  await api.put("/notifications/read-all");
}
