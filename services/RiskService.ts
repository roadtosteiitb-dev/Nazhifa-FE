/**
 * RiskService – fetches PostGIS disaster risk analysis for a property.
 * All spatial overlay logic lives in PostgreSQL/PostGIS.
 * This service is purely a data fetcher.
 */
import api from "./apiClient";
import { BackendRiskApiResponse } from "../data/riskData";

/**
 * GET /api/lands/{id}/risk
 * Returns the PostGIS spatial overlay result for each disaster type.
 */
export async function fetchRiskAnalysis(
  landId: string
): Promise<BackendRiskApiResponse> {
  const res = await api.get(`/lands/${landId}/risk`);
  return res.data as BackendRiskApiResponse;
}
