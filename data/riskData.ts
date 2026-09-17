/**
 * riskData.ts
 *
 * UI configuration only — types, interfaces, color maps, and layer configs.
 * NO hardcoded GIS datasets. All spatial data comes from the Laravel REST API.
 *
 * Kept:
 *  - TypeScript types and interfaces
 *  - GIS_RISK_COLORS (UI display only)
 *  - NUMERIC_RISK_MAP (maps backend gridcode → UI label/color)
 *  - DISASTER_LAYERS (layer name, emoji, icon, color config)
 *  - PROPERTY_FACILITY_LAYERS (facility layer toggle config)
 *
 * Removed:
 *  - GIS_RISK_POLYGONS (hardcoded dummy polygons — use GET /api/layers/{type})
 *  - PROPERTY_GIS_DETAILS (hardcoded dummy properties — use GET /api/lands/{id})
 */

// ─── Base Types ─────────────────────────────────────────────────────────────

export type BaseMapType = "standard" | "satellite" | "osm";

export type GisRiskLevel =
  | "low"
  | "medium"
  | "high"
  | "very_high"
  | "not_affected";

export type NumericRiskCode = 1 | 2 | 3; // 1 = Low, 2 = Medium, 3 = High

export type DisasterType =
  | "flood"
  | "landslide"
  | "eruption"
  | "liquefaction"
  | "drought"
  | "extreme_weather";

export type PropertyFacilityLayerType =
  | "properties"
  | "roads"
  | "schools"
  | "hospitals"
  | "clinics"
  | "pharmacies"
  | "markets"
  | "gas_stations"
  | "banks"
  | "atms"
  | "worship_places";

// ─── Disaster Layer Config ───────────────────────────────────────────────────

export interface DisasterLayerConfig {
  id: DisasterType;
  keyName: string; // key in API risk response
  name: string;
  emoji: string;
  icon: string;
  color: string;
  description: string;
}

export const DISASTER_LAYERS: DisasterLayerConfig[] = [
  {
    id: "flood",
    keyName: "flood",
    name: "Flood",
    emoji: "🌊",
    icon: "water-outline",
    color: "#3B82F6",
    description:
      "Potential flood exposure according to BPBD/BNPB disaster risk layer.",
  },
  {
    id: "landslide",
    keyName: "landslide",
    name: "Landslide",
    emoji: "⛰",
    icon: "warning-outline",
    color: "#D97706",
    description:
      "Potential landslide exposure according to BPBD/BNPB disaster risk layer.",
  },
  {
    id: "eruption",
    keyName: "eruption",
    name: "Merapi Eruption",
    emoji: "🌋",
    icon: "flame-outline",
    color: "#DC2626",
    description:
      "Potential volcanic eruption exposure according to BPBD/BNPB KRB layer.",
  },
  {
    id: "extreme_weather",
    keyName: "extreme_weather",
    name: "Extreme Weather",
    emoji: "🌪",
    icon: "thunderstorm-outline",
    color: "#7C3AED",
    description:
      "Potential extreme weather exposure according to BPBD/BNPB disaster risk layer.",
  },
  {
    id: "drought",
    keyName: "drought",
    name: "Drought",
    emoji: "🌵",
    icon: "sunny-outline",
    color: "#EAB308",
    description:
      "Potential drought risk exposure according to BPBD/BNPB disaster risk layer.",
  },
  {
    id: "liquefaction",
    keyName: "liquefaction",
    name: "Liquefaction",
    emoji: "🌍",
    icon: "earth-outline",
    color: "#0D9488",
    description:
      "Potential liquefaction risk exposure according to BPBD/BNPB disaster risk layer.",
  },
];

// ─── Facility Layer Config ───────────────────────────────────────────────────

export interface FacilityLayerConfig {
  id: PropertyFacilityLayerType;
  name: string;
  icon: string;
  color: string;
}

export const PROPERTY_FACILITY_LAYERS: FacilityLayerConfig[] = [
  { id: "properties",    name: "Properti",       icon: "business-outline",     color: "#2E7D32" },
  { id: "roads",         name: "Jalan Utama",     icon: "navigate-outline",     color: "#4B5563" },
  { id: "schools",       name: "Sekolah",         icon: "school-outline",       color: "#2E7D32" },
  { id: "hospitals",     name: "Rumah Sakit",     icon: "medical-outline",      color: "#DC2626" },
  { id: "clinics",       name: "Klinik",          icon: "fitness-outline",      color: "#059669" },
  { id: "pharmacies",    name: "Apotek",          icon: "medkit-outline",       color: "#0284C7" },
  { id: "markets",       name: "Pasar",           icon: "cart-outline",         color: "#D97706" },
  { id: "gas_stations",  name: "SPBU",            icon: "car-outline",          color: "#EA580C" },
  { id: "banks",         name: "Bank",            icon: "cash-outline",         color: "#16A34A" },
  { id: "atms",          name: "ATM",             icon: "card-outline",         color: "#4F46E5" },
  { id: "worship_places",name: "Tempat Ibadah",   icon: "home-outline",         color: "#9333EA" },
];

// ─── GIS Risk Colors (UI display only) ──────────────────────────────────────

export const GIS_RISK_COLORS: Record<
  GisRiskLevel,
  { bg: string; text: string; dot: string; label: string }
> = {
  low:         { bg: "rgba(22, 163, 74, 0.12)",  text: "#16A34A", dot: "#16A34A", label: "🟢 Low Risk" },
  medium:      { bg: "rgba(234, 179, 8, 0.15)",  text: "#CA8A04", dot: "#EAB308", label: "🟡 Medium Risk" },
  high:        { bg: "rgba(249, 115, 22, 0.15)", text: "#EA580C", dot: "#F97316", label: "🔴 High Risk" },
  very_high:   { bg: "rgba(220, 38, 38, 0.15)",  text: "#DC2626", dot: "#DC2626", label: "🔴 High Risk" },
  not_affected:{ bg: "rgba(156, 163, 175, 0.15)",text: "#4B5563", dot: "#9CA3AF", label: "⚪ Low Risk" },
};

export const NUMERIC_RISK_MAP: Record<
  NumericRiskCode,
  { label: string; text: string; color: string; bg: string; dotColor: string }
> = {
  1: { label: "🟢 Low Risk",    text: "Low Risk",    color: "#16A34A", bg: "rgba(22, 163, 74, 0.12)",  dotColor: "#16A34A" },
  2: { label: "🟡 Medium Risk", text: "Medium Risk", color: "#CA8A04", bg: "rgba(234, 179, 8, 0.15)",  dotColor: "#EAB308" },
  3: { label: "🔴 High Risk",   text: "High Risk",   color: "#DC2626", bg: "rgba(220, 38, 38, 0.15)", dotColor: "#DC2626" },
};

// ─── Backend API Interfaces ──────────────────────────────────────────────────

/** Response shape of GET /api/lands/{id}/risk */
export interface BackendRiskApiResponse {
  overallRisk: NumericRiskCode;
  risk: {
    flood: NumericRiskCode;
    landslide: NumericRiskCode;
    eruption: NumericRiskCode;
    extreme_weather: NumericRiskCode;
    drought: NumericRiskCode;
    liquefaction: NumericRiskCode;
  };
  distribution: {
    low: number;
    medium: number;
    high: number;
  };
}

/** Shape of a single polygon returned by GET /api/layers/{type} */
export interface RiskPolygon {
  id: string;
  disasterType: DisasterType;
  level: GisRiskLevel;
  title: string;
  coordinates: { latitude: number; longitude: number }[];
  fillColor: string;
  strokeColor: string;
}
