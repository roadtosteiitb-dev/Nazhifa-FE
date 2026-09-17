import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Dimensions,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import MapView, { Marker, Polygon, PROVIDER_DEFAULT } from "react-native-maps";
import { useRouter } from "expo-router";
import { fetchLands, ApiLand } from "../../services/PropertyService";
import { fetchFacilities, ApiFacility } from "../../services/FacilityService";
import { fetchLayer, DisasterPolygon } from "../../services/LayerService";

const { height } = Dimensions.get("window");

const PRIMARY = "#2E7D32";
const TEXT_DARK = "#0F172A";
const TEXT_SECONDARY = "#64748B";

type LayerType = "properties" | "facilities" | "flood" | "landslide";

const layerConfig: Record<LayerType, { label: string; color: string; icon: string }> = {
  properties: { label: "Properties", color: PRIMARY, icon: "business" },
  facilities: { label: "Public Facilities", color: "#0891B2", icon: "medkit" },
  flood: { label: "Flood Hazard", color: "#3B82F6", icon: "water" },
  landslide: { label: "Landslide Hazard", color: "#92400E", icon: "warning" },
};

interface SelectedPoint {
  name: string;
  description: string;
  lat: number;
  lng: number;
  color: string;
  icon: string;
}

export default function SpatialDataScreen() {
  const router = useRouter();
  const [activeLayers, setActiveLayers] = useState<LayerType[]>(["properties", "facilities", "flood", "landslide"]);
  const [selectedMarker, setSelectedMarker] = useState<SelectedPoint | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const [lands, setLands] = useState<ApiLand[]>([]);
  const [facilities, setFacilities] = useState<ApiFacility[]>([]);
  const [floodPolygons, setFloodPolygons] = useState<DisasterPolygon[]>([]);
  const [landslidePolygons, setLandslidePolygons] = useState<DisasterPolygon[]>([]);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [landsData, facilitiesData, flood, landslide] = await Promise.allSettled([
        fetchLands(),
        fetchFacilities(),
        fetchLayer("flood"),
        fetchLayer("landslide"),
      ]);
      if (landsData.status === "fulfilled") setLands(landsData.value);
      if (facilitiesData.status === "fulfilled") setFacilities(facilitiesData.value);
      if (flood.status === "fulfilled") setFloodPolygons(flood.value);
      if (landslide.status === "fulfilled") setLandslidePolygons(landslide.value);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const toggleLayer = (type: LayerType) => {
    setActiveLayers((prev) =>
      prev.includes(type) ? prev.filter((l) => l !== type) : [...prev, type]
    );
  };

  const propertyPoints = useMemo(
    () => lands.filter((l) => l.center),
    [lands]
  );

  const initialRegion = {
    latitude: -7.7956,
    longitude: 110.3695,
    latitudeDelta: 0.5,
    longitudeDelta: 0.5,
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={TEXT_DARK} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Spatial Data</Text>
          <Text style={styles.headerSubtitle}>GIS Property Map View</Text>
        </View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerRow}>
        {(Object.keys(layerConfig) as LayerType[]).map((type) => {
          const cfg = layerConfig[type];
          const isActive = activeLayers.includes(type);
          return (
            <TouchableOpacity
              key={type}
              style={[styles.layerChip, isActive && { backgroundColor: cfg.color }]}
              onPress={() => toggleLayer(type)}
            >
              <Ionicons name={cfg.icon as any} size={14} color={isActive ? "#fff" : cfg.color} />
              <Text style={[styles.layerChipText, isActive && { color: "#fff" }, !isActive && { color: cfg.color }]}>
                {cfg.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.mapContainer}>
        {isLoading ? (
          <View style={styles.mapLoading}>
            <ActivityIndicator size="large" color={PRIMARY} />
          </View>
        ) : (
          <MapView
            provider={PROVIDER_DEFAULT}
            style={styles.map}
            initialRegion={initialRegion}
            showsUserLocation={false}
            showsMyLocationButton={false}
          >
            {activeLayers.includes("properties") &&
              propertyPoints.map((item) => (
                <Marker
                  key={`land-${item.id}`}
                  coordinate={{ latitude: item.center!.latitude, longitude: item.center!.longitude }}
                  title={item.name}
                  description={item.location}
                  pinColor={layerConfig.properties.color}
                  onPress={() =>
                    setSelectedMarker({
                      name: item.name,
                      description: item.location,
                      lat: item.center!.latitude,
                      lng: item.center!.longitude,
                      color: layerConfig.properties.color,
                      icon: layerConfig.properties.icon,
                    })
                  }
                />
              ))}

            {activeLayers.includes("facilities") &&
              facilities.map((item) => (
                <Marker
                  key={`fac-${item.id}`}
                  coordinate={{ latitude: item.lat, longitude: item.lng }}
                  title={item.name}
                  description={item.category}
                  pinColor={layerConfig.facilities.color}
                  onPress={() =>
                    setSelectedMarker({
                      name: item.name,
                      description: item.category,
                      lat: item.lat,
                      lng: item.lng,
                      color: layerConfig.facilities.color,
                      icon: layerConfig.facilities.icon,
                    })
                  }
                />
              ))}

            {activeLayers.includes("flood") &&
              floodPolygons.map((poly) => (
                <Polygon
                  key={poly.id}
                  coordinates={poly.coordinates}
                  fillColor={poly.fillColor}
                  strokeColor={poly.strokeColor}
                  strokeWidth={1}
                />
              ))}

            {activeLayers.includes("landslide") &&
              landslidePolygons.map((poly) => (
                <Polygon
                  key={poly.id}
                  coordinates={poly.coordinates}
                  fillColor={poly.fillColor}
                  strokeColor={poly.strokeColor}
                  strokeWidth={1}
                />
              ))}
          </MapView>
        )}
      </View>

      {selectedMarker && (
        <View style={styles.infoPanel}>
          <View style={styles.infoPanelHeader}>
            <View style={[styles.infoIconWrap, { backgroundColor: selectedMarker.color + "20" }]}>
              <Ionicons name={selectedMarker.icon as any} size={18} color={selectedMarker.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.infoPanelTitle}>{selectedMarker.name}</Text>
              <Text style={styles.infoPanelDesc}>{selectedMarker.description}</Text>
            </View>
            <TouchableOpacity onPress={() => setSelectedMarker(null)}>
              <Ionicons name="close-circle" size={22} color={TEXT_SECONDARY} />
            </TouchableOpacity>
          </View>
          <Text style={styles.infoPanelCoords}>
            Lat: {selectedMarker.lat.toFixed(4)}, Lng: {selectedMarker.lng.toFixed(4)}
          </Text>
        </View>
      )}

      <View style={styles.legend}>
        <Text style={styles.legendTitle}>Legend</Text>
        <View style={styles.legendRow}>
          {(Object.keys(layerConfig) as LayerType[]).map((type) => (
            <View key={type} style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: layerConfig[type].color }]} />
              <Text style={styles.legendText}>{layerConfig[type].label}</Text>
            </View>
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },

  header: {
    flexDirection: "row", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "700", color: TEXT_DARK },
  headerSubtitle: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },

  layerRow: { paddingHorizontal: 16, gap: 8, paddingBottom: 10 },
  layerChip: {
    flexDirection: "row", alignItems: "center", gap: 6,
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    backgroundColor: "#F1F5F9",
  },
  layerChipText: { fontSize: 12, fontWeight: "600" },

  mapContainer: {
    marginHorizontal: 16, height: height * 0.42,
    borderRadius: 16, overflow: "hidden", borderWidth: 1, borderColor: "#E2E8F0",
  },
  map: { flex: 1 },
  mapLoading: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#F8FAFC" },

  infoPanel: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: "#F8FAFC",
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0",
  },
  infoPanelHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  infoIconWrap: {
    width: 38, height: 38, borderRadius: 10,
    justifyContent: "center", alignItems: "center",
  },
  infoPanelTitle: { fontSize: 15, fontWeight: "700", color: TEXT_DARK },
  infoPanelDesc: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },
  infoPanelCoords: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 8 },

  legend: {
    marginHorizontal: 16, marginTop: 12, backgroundColor: "#F8FAFC",
    borderRadius: 14, padding: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16,
  },
  legendTitle: { fontSize: 13, fontWeight: "700", color: TEXT_DARK, marginBottom: 8 },
  legendRow: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  legendItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  legendDot: { width: 10, height: 10, borderRadius: 5 },
  legendText: { fontSize: 11, color: TEXT_SECONDARY },
});
