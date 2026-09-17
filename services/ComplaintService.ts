/**
 * ComplaintService – buyer complaint submission & admin complaint management.
 */
import api from "./apiClient";

export type ComplaintStatus = "open" | "in_progress" | "resolved";

export interface ApiComplaint {
  id: string;
  reporter: string | null;
  property: string | null;
  propertyId: string | null;
  category: string;
  message: string;
  image: string | null;
  status: ComplaintStatus;
  date: string | null;
}

/** GET /api/complaints — admin: all complaints; buyer/owner: only their own */
export async function fetchComplaints(params?: {
  status?: ComplaintStatus;
}): Promise<ApiComplaint[]> {
  const res = await api.get("/complaints", { params });
  return res.data as ApiComplaint[];
}

/** POST /api/complaints — submit a new complaint */
export async function submitComplaint(data: {
  category: string;
  message: string;
  propertyId?: string;
  image?: string;
}): Promise<ApiComplaint> {
  const res = await api.post("/complaints", data);
  return res.data as ApiComplaint;
}

/** PATCH /api/complaints/{id}/status — admin: change complaint status */
export async function updateComplaintStatus(
  id: string,
  status: ComplaintStatus
): Promise<ApiComplaint> {
  const res = await api.patch(`/complaints/${id}/status`, { status });
  return res.data as ApiComplaint;
}
