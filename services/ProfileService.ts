/**
 * ProfileService – profile data & photo of the logged-in user (stored in the users table).
 */
import api from "./apiClient";

export interface ApiUserProfile {
  id: string;
  fullName: string;
  email: string;
  userType: "owner" | "buyer" | "admin";
  phone: string | null;
  photo: string | null;
}

export interface LocalImage {
  uri: string;
  mimeType?: string | null;
  fileName?: string | null;
}

/** GET /api/auth/me */
export async function fetchMe(): Promise<ApiUserProfile> {
  const res = await api.get("/auth/me");
  return res.data;
}

/** PUT /api/auth/profile */
export async function updateProfile(data: { fullName?: string; email?: string; phone?: string | null }): Promise<ApiUserProfile> {
  const res = await api.put("/auth/profile", data);
  return res.data;
}

/** POST /api/auth/profile/photo — uploads the file as multipart (no base64) */
export async function uploadProfilePhoto(image: LocalImage): Promise<ApiUserProfile> {
  const name = image.fileName || image.uri.split("/").pop() || `avatar_${Date.now()}.jpg`;
  const body = new FormData();
  body.append("photo", { uri: image.uri, name, type: image.mimeType || "image/jpeg" } as any);
  const res = await api.post("/auth/profile/photo", body, {
    headers: { "Content-Type": "multipart/form-data" },
    transformRequest: (data) => data,
    timeout: 60000,
  });
  return res.data;
}

/** DELETE /api/auth/profile/photo */
export async function deleteProfilePhoto(): Promise<ApiUserProfile> {
  const res = await api.delete("/auth/profile/photo");
  return res.data;
}
