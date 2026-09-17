/**
 * UserService – admin user management API calls.
 */
import api from "./apiClient";

export interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: "guest" | "buyer" | "owner" | "admin";
  status: "active" | "inactive";
  phone: string | null;
  photo: string | null;
  joinDate: string | null;
}

/** GET /api/users — admin: list all users with optional filters */
export async function fetchUsers(params?: {
  role?: string;
  status?: string;
}): Promise<ApiUser[]> {
  const res = await api.get("/users", { params });
  return res.data as ApiUser[];
}

/** PATCH /api/users/{id}/status — toggle a user's active/inactive status */
export async function updateUserStatus(
  id: string,
  status: "active" | "inactive"
): Promise<ApiUser> {
  const res = await api.patch(`/users/${id}/status`, { status });
  return res.data as ApiUser;
}
