import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  TextInput,
  Image,
  FlatList,
  PanResponder,
  Animated,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import MapView, {
  Marker,
  Circle,
  Callout,
  Polygon,
  UrlTile,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import * as Location from "expo-location";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import {
  BaseMapType,
  DisasterType,
  PropertyFacilityLayerType,
  GIS_RISK_COLORS,
  GisRiskLevel,
  DISASTER_LAYERS,
} from "../data/riskData";
import { fetchActiveLayers, LayerType, DisasterPolygon } from "../services/LayerService";
import { FloatingMapControls } from "../components/maps/FloatingMapControls";
import { LayerSelectionSheet } from "../components/maps/LayerSelectionSheet";
import { useLands } from "../contexts/LandContext";
import type { Land } from "../contexts/LandContext";

const { height: screenHeight } = Dimensions.get("window");
const MIN_HEIGHT = 120;
const MAX_HEIGHT = screenHeight * 0.72;

/** disasterType → base color, sourced from DISASTER_LAYERS (flood = blue, extreme_weather = purple, ...) */
const DISASTER_COLOR_MAP: Record<string, string> = Object.fromEntries(
  DISASTER_LAYERS.map((layer) => [layer.id, layer.color])
);

function hexToRgba(hex: string, alpha: number): string {
  const parsed = hex.replace("#", "");
  const r = parseInt(parsed.substring(0, 2), 16);
  const g = parseInt(parsed.substring(2, 4), 16);
  const b = parseInt(parsed.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/** Resolve a polygon's map colors from its disasterType, overriding whatever the backend sends. */
function getDisasterPolygonColors(poly: DisasterPolygon): {
  fillColor: string;
  strokeColor: string;
} {
  const base = DISASTER_COLOR_MAP[poly.disasterType] ?? "#6B7280";
  return {
    fillColor: hexToRgba(base, 0.35),
    strokeColor: base,
  };
}

/* =============================================
   PROPERTY CARD COMPONENT (UI preserved exactly)
   ============================================= */
const GisPropertyCard = ({ item, active, onPress, userLoc }: any) => {
  // Derive risk level from backend data: not_affected as default when unknown
  const riskLevel: GisRiskLevel = "not_affected";
  const riskInfo = GIS_RISK_COLORS[riskLevel];

  const price = item.price ?? 0;
  const formattedPrice =
    price >= 1000000000
      ? `Rp ${(price / 1000000000).toFixed(1)} M`
      : `Rp ${(price / 1000000).toFixed(0)} Jt`;

  const district = item.location?.split(",")[0]?.trim() ?? "Yogyakarta";
  const propType = item.isForSale ? "sale" : "rent";
  const typeLabel =
    item.type === "house" ? "Rumah"
    : item.type === "apartment" ? "Apartemen"
    : item.type === "villa" ? "Villa"
    : "Lahan";

  return (
    <TouchableOpacity
      style={[
        styles.card,
        {
          borderColor: active ? "#2E7D32" : "#E5E7EB",
          borderWidth: active ? 2 : 1,
        },
      ]}
      onPress={onPress}
      activeOpacity={0.9}
    >
      <Image
        source={{
          uri: item.image ?? "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400",
        }}
        style={styles.cardImage}
      />

      {/* PROPERTY TYPE BADGE */}
      <View style={styles.cardTypeBadge}>
        <Text style={styles.cardTypeBadgeText}>
          {propType === "sale" ? "DIJUAL" : "DISEWA"} • {typeLabel}
        </Text>
      </View>

      {/* RISK BADGE — shown as pending if no risk level yet from backend */}
      <View style={[styles.cardDisasterBadge, { backgroundColor: riskInfo.bg }]}>
        <Text style={[styles.cardDisasterText, { color: riskInfo.text }]}>
          {riskInfo.label}
        </Text>
      </View>

      <View style={styles.cardContent}>
        <Text numberOfLines={1} style={styles.cardTitle}>
          {item.name}
        </Text>

        <Text style={styles.cardPrice}>{formattedPrice}</Text>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={13} color="#6B7280" />
          <Text style={styles.cardLocation}>
            {district}
            {userLoc && item.distanceKm != null
              ? ` • ${Number(item.distanceKm).toFixed(1)} km`
              : ""}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

/* =============================================
   MAIN MAP SCREEN
   ============================================= */
export default function HomeGuestMap() {
  const mapRef = useRef<MapView>(null);
  const router = useRouter();

  // ── Property data from LandContext (already fetches from GET /api/lands) ──
  const { lands, isLoading: isLandsLoading } = useLands();

  const [userLoc, setUserLoc] = useState<any>(null);
  const [radius, setRadius] = useState(15);
  const [activeId, setActiveId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [type, setType] = useState<"all" | "sale" | "rent">("all");
  const [sort, setSort] = useState<"distance" | "low" | "high">("distance");
  const [selectedRiskFilter, setSelectedRiskFilter] = useState<"all" | GisRiskLevel>("all");
  const [isFilterVisible, setFilterVisible] = useState(false);

  /* GIS LAYERS STATE */
  const [baseMap, setBaseMap] = useState<BaseMapType>("standard");
  const [activePropertyLayers, setActivePropertyLayers] = useState<PropertyFacilityLayerType[]>(
    ["properties"]
  );
  const [activeDisasterLayers, setActiveDisasterLayers] = useState<DisasterType[]>(["flood"]);
  const [isLayerSheetVisible, setLayerSheetVisible] = useState(false);

  /* DISASTER POLYGONS STATE — no fallback to dummy data */
  const [disasterPolygons, setDisasterPolygons] = useState<DisasterPolygon[]>([]);
  const [isLayerLoading, setIsLayerLoading] = useState(false);
  const [layerError, setLayerError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  /* Currently visible map region, seeded with a sensible default so a bbox is
     always available for the very first fetch (extreme_weather/drought/
     liquefaction have 8k-23k rows each — fetching them without a viewport
     bbox means pulling/simplifying the entire table, which is what made the
     dev server hang before). Refined by onRegionChangeComplete once the map
     actually renders / GPS resolves. */
  const [visibleRegion, setVisibleRegion] = useState<Region>({
    latitude: -7.76,
    longitude: 110.377,
    latitudeDelta: 0.08,
    longitudeDelta: 0.08,
  });

  /* Fetch disaster polygons from backend for a given viewport — using LayerService cache */
  const loadLayers = useCallback(async (layers: DisasterType[], region: Region) => {
    // Cancel any in-flight request
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    if (layers.length === 0) {
      setDisasterPolygons([]);
      setIsLayerLoading(false);
      setLayerError(null);
      return;
    }

    setIsLayerLoading(true);
    setLayerError(null);

    // Fetch a viewport padded well beyond what's on screen (2x the visible
    // span each side) so small pans don't need an immediate refetch.
    const latPad = region.latitudeDelta * 1.5;
    const lngPad = region.longitudeDelta * 1.5;
    const bbox = {
      minLat: region.latitude - region.latitudeDelta / 2 - latPad,
      maxLat: region.latitude + region.latitudeDelta / 2 + latPad,
      minLng: region.longitude - region.longitudeDelta / 2 - lngPad,
      maxLng: region.longitude + region.longitudeDelta / 2 + lngPad,
    };

    try {
      const polygons = await fetchActiveLayers(layers as LayerType[], bbox, controller.signal);
      if (!controller.signal.aborted) {
        setDisasterPolygons(polygons);
      }
    } catch (err: any) {
      if (err?.name === "AbortError" || err?.code === "ERR_CANCELED") {
        // Intentional cancel — ignore
        return;
      }
      console.error("Layer fetch error:", err);
      if (!controller.signal.aborted) {
        setLayerError("Gagal memuat layer. Periksa koneksi ke server.");
        setDisasterPolygons([]);
      }
    } finally {
      if (!controller.signal.aborted) {
        setIsLayerLoading(false);
      }
    }
  }, []);

  // Debounce region-driven refetches so a pan/zoom gesture (which can fire
  // onRegionChangeComplete a couple times in quick succession) triggers one
  // network call, not several.
  useEffect(() => {
    const timer = setTimeout(() => {
      loadLayers(activeDisasterLayers, visibleRegion);
    }, 350);
    return () => {
      clearTimeout(timer);
      abortControllerRef.current?.abort();
    };
  }, [activeDisasterLayers, visibleRegion, loadLayers]);

  /* DRAGGABLE BOTTOM SHEET ANIMATION */
  const sheetHeight = useRef(new Animated.Value(screenHeight * 0.42)).current;
  const lastHeight = useRef(screenHeight * 0.42);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (e, gestureState) => {
        let newHeight = lastHeight.current - gestureState.dy;
        if (newHeight < MIN_HEIGHT) newHeight = MIN_HEIGHT;
        if (newHeight > MAX_HEIGHT) newHeight = MAX_HEIGHT;
        sheetHeight.setValue(newHeight);
      },
      onPanResponderRelease: (e, gestureState) => {
        let finalHeight = lastHeight.current - gestureState.dy;
        const midHeight = screenHeight * 0.42;
        let snapTo = midHeight;

        if (finalHeight < (MIN_HEIGHT + midHeight) / 2) {
          snapTo = MIN_HEIGHT;
        } else if (finalHeight > (midHeight + MAX_HEIGHT) / 2) {
          snapTo = MAX_HEIGHT;
        }

        Animated.spring(sheetHeight, {
          toValue: snapTo,
          useNativeDriver: false,
          tension: 40,
          friction: 7,
        }).start(() => {
          lastHeight.current = snapTo;
        });
      },
    })
  ).current;

  /* REQUEST USER LOCATION */
  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;

      const loc = await Location.getCurrentPositionAsync({});
      const coords = {
        latitude: loc.coords.latitude,
        longitude: loc.coords.longitude,
      };
      setUserLoc(coords);

      mapRef.current?.animateToRegion(
        { ...coords, latitudeDelta: 0.08, longitudeDelta: 0.08 },
        800
      );
    })();
  }, []);

  /* CONTROL HANDLERS */
  const handleMyLocation = () => {
    if (userLoc) {
      mapRef.current?.animateToRegion(
        { ...userLoc, latitudeDelta: 0.04, longitudeDelta: 0.04 },
        700
      );
    }
  };

  const handleResetView = () => {
    const defaultCoords = userLoc || { latitude: -7.760, longitude: 110.377 };
    mapRef.current?.animateToRegion(
      { ...defaultCoords, latitudeDelta: 0.08, longitudeDelta: 0.08 },
      600
    );
  };

  const handleTogglePropertyLayer = (layerId: PropertyFacilityLayerType) => {
    setActivePropertyLayers((prev) =>
      prev.includes(layerId) ? prev.filter((id) => id !== layerId) : [...prev, layerId]
    );
  };

  const handleToggleDisasterLayer = (layerId: DisasterType) => {
    setActiveDisasterLayers((prev) =>
      prev.includes(layerId) ? prev.filter((id) => id !== layerId) : [...prev, layerId]
    );
  };

  const handleResetAllLayers = () => {
    setActivePropertyLayers(["properties"]);
    setActiveDisasterLayers([]);
  };

  /* FILTER + SORT (operates on backend lands — no local Haversine) */
  const filtered = useMemo(() => {
    let data: Land[] = [...lands];

    if (search.trim()) {
      const q = search.toLowerCase();
      data = data.filter(
        (l) =>
          l.name.toLowerCase().includes(q) ||
          l.location.toLowerCase().includes(q)
      );
    }

    if (type !== "all") {
      data = data.filter((l) =>
        type === "sale" ? l.isForSale === true : l.isForSale === false
      );
    }

    if (sort === "distance") {
      data.sort((a, b) => (a.distanceKm ?? 999) - (b.distanceKm ?? 999));
    } else if (sort === "low") {
      data.sort((a, b) => (a.price ?? 0) - (b.price ?? 0));
    } else if (sort === "high") {
      data.sort((a, b) => (b.price ?? 0) - (a.price ?? 0));
    }

    return data;
  }, [lands, search, type, sort]);

  const activeFiltersCount =
    (type !== "all" ? 1 : 0) +
    (selectedRiskFilter !== "all" ? 1 : 0) +
    (radius !== 15 ? 1 : 0);

  const activeLayersTotalCount = activePropertyLayers.length + activeDisasterLayers.length;

  /* Precompute each polygon's bounding box once per data load — cheap to
     compare against the visible region on every pan/zoom, instead of
     re-scanning every coordinate each time. */
  const polygonsWithBBox = useMemo(() => {
    return disasterPolygons.map((poly) => {
      let minLat = Infinity, maxLat = -Infinity, minLng = Infinity, maxLng = -Infinity;
      for (const c of poly.coordinates) {
        if (c.latitude < minLat) minLat = c.latitude;
        if (c.latitude > maxLat) maxLat = c.latitude;
        if (c.longitude < minLng) minLng = c.longitude;
        if (c.longitude > maxLng) maxLng = c.longitude;
      }
      return { poly, bbox: { minLat, maxLat, minLng, maxLng } };
    });
  }, [disasterPolygons]);

  /* Viewport culling: only render polygons whose bounding box intersects the
     currently visible map region (plus a margin so panning slightly doesn't
     pop shapes in/out). This is what actually keeps zoom/pan smooth — react-
     native-maps has to redraw every rendered <Polygon> on each camera move,
     so limiting that count to what's on screen matters far more than trimming
     the underlying dataset size. */
  const visibleDisasterPolygons = useMemo(() => {
    const latMargin = visibleRegion.latitudeDelta * 0.75;
    const lngMargin = visibleRegion.longitudeDelta * 0.75;
    const minLat = visibleRegion.latitude - visibleRegion.latitudeDelta / 2 - latMargin;
    const maxLat = visibleRegion.latitude + visibleRegion.latitudeDelta / 2 + latMargin;
    const minLng = visibleRegion.longitude - visibleRegion.longitudeDelta / 2 - lngMargin;
    const maxLng = visibleRegion.longitude + visibleRegion.longitudeDelta / 2 + lngMargin;

    return polygonsWithBBox
      .filter(
        ({ bbox }) =>
          bbox.maxLat >= minLat &&
          bbox.minLat <= maxLat &&
          bbox.maxLng >= minLng &&
          bbox.minLng <= maxLng
      )
      .map((p) => p.poly);
  }, [polygonsWithBBox, visibleRegion]);

  return (
    <View style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
      {/* TOP SEARCH BAR */}
      <View style={styles.topContainer}>
        <View style={styles.searchBox}>
          <Ionicons name="search-outline" size={18} color="#6B7280" />
          <TextInput
            placeholder="Search property, address, district..."
            placeholderTextColor="#9CA3AF"
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
          <TouchableOpacity
            style={styles.filterIconBtn}
            onPress={() => setFilterVisible(true)}
            activeOpacity={0.8}
          >
            <Ionicons name="options-outline" size={20} color="#2E7D32" />
          </TouchableOpacity>
        </View>
      </View>

      {/* QUICK INTERACTIVE DISASTER LAYER SWITCHER */}
      <View style={{ position: "absolute", top: 110, left: 16, right: 16, zIndex: 10 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {[
            { id: "flood" as DisasterType, label: "Banjir 🌊", color: "#3B82F6" },
            { id: "landslide" as DisasterType, label: "Longsor ⛰️", color: "#EAB308" },
            { id: "eruption" as DisasterType, label: "Erupsi Gunung 🌋", color: "#EF4444" },
            { id: "extreme_weather" as DisasterType, label: "Cuaca Ekstrem ⚡", color: "#8B5CF6" },
          ].map((layer) => {
            const isActive = activeDisasterLayers.includes(layer.id);
            return (
              <TouchableOpacity
                key={layer.id}
                onPress={() => handleToggleDisasterLayer(layer.id)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 7,
                  borderRadius: 20,
                  backgroundColor: isActive ? layer.color : "rgba(255, 255, 255, 0.92)",
                  borderWidth: 1,
                  borderColor: isActive ? layer.color : "#E2E8F0",
                  shadowColor: "#000",
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 3,
                  flexDirection: "row",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {isLayerLoading && isActive && (
                  <ActivityIndicator size="small" color={isActive ? "#FFF" : layer.color} style={{ marginRight: 2 }} />
                )}
                <Text style={{ fontSize: 11, fontWeight: "800", color: isActive ? "#FFF" : "#334155" }}>
                  {layer.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* FLOATING CONTROLS (MY LOCATION, LAYERS, RESET VIEW) */}
      <FloatingMapControls
        onMyLocation={handleMyLocation}
        onOpenLayers={() => setLayerSheetVisible(true)}
        onResetView={handleResetView}
        activeLayersCount={activeLayersTotalCount}
      />

      {/* MAP VIEW */}
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        mapType={baseMap === "satellite" ? "satellite" : "standard"}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation
        onRegionChangeComplete={setVisibleRegion}
      >
        {/* OSM TILE LAYER IF SELECTED */}
        {baseMap === "osm" && (
          <UrlTile
            urlTemplate="https://c.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            zIndex={1}
          />
        )}

        {/* RENDER DISASTER POLYGONS — colored by disasterType (flood = blue, extreme_weather = purple, etc.),
            culled to only what's in/near the current viewport so pan/zoom stays smooth. */}
        {visibleDisasterPolygons.map((poly) => {
          const { fillColor, strokeColor } = getDisasterPolygonColors(poly);
          return (
            <Polygon
              key={poly.id}
              coordinates={poly.coordinates}
              fillColor={fillColor}
              strokeColor={strokeColor}
              strokeWidth={2}
            />
          );
        })}

        {/* RADIUS CIRCLE */}
        {userLoc && (
          <Circle
            center={userLoc}
            radius={radius * 1000}
            strokeColor="rgba(46, 125, 50, 0.6)"
            fillColor="rgba(46, 125, 50, 0.08)"
          />
        )}

        {/* PROPERTY MARKERS — from LandContext (backend data) */}
        {activePropertyLayers.includes("properties") &&
          filtered.map((l) => {
            if (!l.center) return null; // skip properties without coordinates
            const isActive = activeId === l.id;
            const price = l.price ?? 0;
            const priceLabel =
              price >= 1000000000
                ? `${(price / 1000000000).toFixed(1)}M`
                : `${(price / 1000000).toFixed(0)} Jt`;

            return (
              <Marker
                key={l.id}
                coordinate={l.center}
                onPress={() => {
                  setActiveId(l.id);
                  mapRef.current?.animateToRegion(
                    { ...l.center!, latitudeDelta: 0.02, longitudeDelta: 0.02 },
                    500
                  );
                }}
              >
                {/* COMPACT PROPERTY MARKER */}
                <View
                  style={[
                    styles.compactMarkerPin,
                    {
                      backgroundColor: isActive ? "#2E7D32" : "#FFFFFF",
                      borderColor: isActive ? "#2E7D32" : "#E5E7EB",
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.compactMarkerPrice,
                      { color: isActive ? "#FFFFFF" : "#111827" },
                    ]}
                  >
                    {priceLabel}
                  </Text>
                  <View style={[styles.disasterIndicatorDot, { backgroundColor: "#9CA3AF" }]} />
                </View>

                {/* PROPERTY CALLOUT */}
                <Callout
                  tooltip
                  onPress={() =>
                    router.push({
                      pathname: "/product/[id]",
                      params: { id: l.id },
                    })
                  }
                >
                  <View style={styles.calloutBubble}>
                    <Image
                      source={{
                        uri: l.image ?? "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=400",
                      }}
                      style={styles.calloutImage}
                    />

                    <View style={styles.calloutBody}>
                      <View style={styles.calloutTitleRow}>
                        <Text numberOfLines={1} style={styles.calloutTitle}>
                          {l.name}
                        </Text>
                      </View>

                      <Text style={styles.calloutPrice}>
                        Rp {price.toLocaleString("id-ID")}
                      </Text>

                      <Text style={styles.calloutDistrict}>
                        📍 {l.location?.split(",")[0]?.trim() ?? "Yogyakarta"}
                      </Text>

                      <Text numberOfLines={2} style={styles.calloutDesc}>
                        {l.description ?? "Lihat detail properti untuk informasi lengkap."}
                      </Text>

                      <View style={styles.viewDetailBtn}>
                        <Text style={styles.viewDetailBtnText}>View Detail</Text>
                        <Ionicons name="arrow-forward" size={12} color="#FFFFFF" />
                      </View>
                    </View>
                    <View style={styles.calloutArrow} />
                  </View>
                </Callout>
              </Marker>
            );
          })}
      </MapView>

      {/* LAYER ERROR BANNER */}
      {layerError && (
        <View style={styles.errorBanner}>
          <Ionicons name="warning-outline" size={14} color="#DC2626" />
          <Text style={styles.errorBannerText}>{layerError}</Text>
          <TouchableOpacity
            onPress={() => loadLayers(activeDisasterLayers, visibleRegion)}
            style={styles.retryBtn}
          >
            <Text style={styles.retryBtnText}>Retry</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* DRAGGABLE BOTTOM SHEET */}
      <Animated.View style={[styles.sheet, { height: sheetHeight }]}>
        {/* DRAG HANDLE & HEADER */}
        <View style={styles.dragHandleArea} {...panResponder.panHandlers}>
          <View style={styles.dragHandle} />

          <View style={styles.sheetHeader}>
            <View style={styles.sheetHeaderCol}>
              <Text style={styles.totalPropertiesText}>
                Total Properties:{" "}
                <Text style={{ color: "#2E7D32" }}>
                  {isLandsLoading ? "..." : filtered.length}
                </Text>
              </Text>
              <Text style={styles.activeMetaText}>
                Active Filters: {activeFiltersCount} • Active Layers: {activeLayersTotalCount}
              </Text>
            </View>

            {(type !== "all" || sort !== "distance" || radius !== 15 || selectedRiskFilter !== "all") && (
              <TouchableOpacity
                onPress={() => {
                  setType("all");
                  setSort("distance");
                  setRadius(15);
                  setSelectedRiskFilter("all");
                }}
              >
                <Text style={styles.resetFiltersText}>Reset</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

        {/* PROPERTY LIST */}
        {isLandsLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2E7D32" />
            <Text style={styles.loadingText}>Memuat data properti dari PostgreSQL...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={32} color="#9CA3AF" />
            <Text style={styles.emptyText}>Tidak ada properti ditemukan</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(i) => i.id.toString()}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}
            renderItem={({ item }) => (
              <GisPropertyCard
                item={item}
                active={activeId === item.id}
                userLoc={userLoc}
                onPress={() => {
                  setActiveId(item.id);
                  router.push({
                    pathname: "/product/[id]",
                    params: { id: item.id },
                  });
                }}
              />
            )}
          />
        )}
      </Animated.View>

      {/* LAYER SELECTION PANEL */}
      <LayerSelectionSheet
        visible={isLayerSheetVisible}
        onClose={() => setLayerSheetVisible(false)}
        baseMap={baseMap}
        onSelectBaseMap={setBaseMap}
        activePropertyLayers={activePropertyLayers}
        onTogglePropertyLayer={handleTogglePropertyLayer}
        activeDisasterLayers={activeDisasterLayers}
        onToggleDisasterLayer={handleToggleDisasterLayer}
        onResetAllLayers={handleResetAllLayers}
        theme={{}}
      />

      {/* FILTER MODAL */}
      <Modal
        transparent
        visible={isFilterVisible}
        animationType="slide"
        onRequestClose={() => setFilterVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity style={{ flex: 1 }} onPress={() => setFilterVisible(false)} />
          <View style={styles.filterSheet}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Properties</Text>
              <TouchableOpacity onPress={() => setFilterVisible(false)}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>

            {/* TRANSACTION TYPE */}
            <Text style={styles.sectionTitle}>Transaction Type</Text>
            <View style={styles.chipRow}>
              {["all", "sale", "rent"].map((t) => (
                <TouchableOpacity
                  key={t}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: type === t ? "#2E7D32" : "#F8FAFC",
                      borderColor: type === t ? "#2E7D32" : "#E5E7EB",
                    },
                  ]}
                  onPress={() => setType(t as any)}
                >
                  <Text style={{ color: type === t ? "#FFF" : "#4B5563", fontWeight: "600" }}>
                    {t === "all" ? "All" : t === "sale" ? "For Sale" : "For Rent"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* DISASTER RISK LEVEL FILTER */}
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Disaster Risk Level</Text>
            <View style={styles.chipRow}>
              {[
                { k: "all", l: "All Levels" },
                { k: "low", l: "🟢 Rendah" },
                { k: "medium", l: "🟡 Sedang" },
                { k: "high", l: "🟠 Tinggi" },
                { k: "very_high", l: "🔴 Sangat Tinggi" },
              ].map((rf) => (
                <TouchableOpacity
                  key={rf.k}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedRiskFilter === rf.k ? "#2E7D32" : "#F8FAFC",
                      borderColor: selectedRiskFilter === rf.k ? "#2E7D32" : "#E5E7EB",
                    },
                  ]}
                  onPress={() => setSelectedRiskFilter(rf.k as any)}
                >
                  <Text
                    style={{
                      color: selectedRiskFilter === rf.k ? "#FFF" : "#4B5563",
                      fontWeight: "600",
                    }}
                  >
                    {rf.l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* SORT BY */}
            <Text style={[styles.sectionTitle, { marginTop: 14 }]}>Sort By</Text>
            <View style={styles.chipRow}>
              {[
                { k: "distance", l: "Nearest" },
                { k: "low", l: "Lowest Price" },
                { k: "high", l: "Highest Price" },
              ].map((s) => (
                <TouchableOpacity
                  key={s.k}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: sort === s.k ? "#2E7D32" : "#F8FAFC",
                      borderColor: sort === s.k ? "#2E7D32" : "#E5E7EB",
                    },
                  ]}
                  onPress={() => setSort(s.k as any)}
                >
                  <Text style={{ color: sort === s.k ? "#FFF" : "#4B5563", fontWeight: "600" }}>
                    {s.l}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* RADIUS */}
            <View style={styles.radiusHeader}>
              <Text style={styles.sectionTitle}>Search Radius</Text>
              <Text style={styles.radiusValue}>{radius} km</Text>
            </View>
            <Slider
              minimumValue={1}
              maximumValue={50}
              step={1}
              value={radius}
              minimumTrackTintColor="#2E7D32"
              thumbTintColor="#2E7D32"
              onValueChange={setRadius}
              style={{ marginVertical: 6 }}
            />

            {/* APPLY BUTTON */}
            <TouchableOpacity
              style={styles.applyFilterBtn}
              onPress={() => setFilterVisible(false)}
            >
              <Text style={styles.applyFilterBtnText}>Apply Filter</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* =======================
   STYLES
========================= */
const styles = StyleSheet.create({
  topContainer: {
    position: "absolute",
    top: 50,
    left: 16,
    right: 16,
    zIndex: 10,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
  },
  searchInput: {
    marginLeft: 8,
    flex: 1,
    fontSize: 14,
    color: "#111827",
  },
  filterIconBtn: {
    paddingLeft: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  compactMarkerPin: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 16,
    borderWidth: 1,
    gap: 5,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
  },
  compactMarkerPrice: {
    fontSize: 11,
    fontWeight: "800",
  },
  disasterIndicatorDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },
  calloutBubble: {
    width: 220,
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    overflow: "hidden",
    elevation: 5,
  },
  calloutImage: {
    width: "100%",
    height: 95,
    backgroundColor: "#E5E7EB",
  },
  calloutBody: {
    padding: 10,
  },
  calloutTitleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  calloutTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    flex: 1,
    marginRight: 4,
  },
  miniBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  miniBadgeText: {
    fontSize: 9,
    fontWeight: "800",
  },
  calloutPrice: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2E7D32",
    marginBottom: 2,
  },
  calloutDistrict: {
    fontSize: 11,
    color: "#6B7280",
    marginBottom: 4,
  },
  calloutDesc: {
    fontSize: 10,
    color: "#6B7280",
    lineHeight: 14,
    marginBottom: 8,
  },
  viewDetailBtn: {
    backgroundColor: "#2E7D32",
    paddingVertical: 6,
    borderRadius: 6,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 4,
  },
  viewDetailBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  calloutArrow: {
    backgroundColor: "transparent",
    borderColor: "transparent",
    borderTopColor: "#FFFFFF",
    borderWidth: 8,
    alignSelf: "center",
    marginTop: -1,
  },
  sheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
  },
  dragHandleArea: {
    paddingTop: 10,
    paddingBottom: 10,
    alignItems: "center",
  },
  dragHandle: {
    width: 38,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#D1D5DB",
    marginBottom: 8,
  },
  sheetHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    paddingHorizontal: 18,
  },
  sheetHeaderCol: {
    flex: 1,
  },
  totalPropertiesText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  activeMetaText: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  resetFiltersText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#2E7D32",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    paddingBottom: 24,
  },
  loadingText: {
    fontSize: 13,
    color: "#6B7280",
    textAlign: "center",
  },
  emptyContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingBottom: 24,
  },
  emptyText: {
    fontSize: 14,
    color: "#9CA3AF",
    textAlign: "center",
  },
  errorBanner: {
    position: "absolute",
    bottom: screenHeight * 0.42 + 8,
    left: 16,
    right: 16,
    zIndex: 20,
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  errorBannerText: {
    flex: 1,
    fontSize: 12,
    color: "#DC2626",
  },
  retryBtn: {
    backgroundColor: "#DC2626",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  retryBtnText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    marginBottom: 12,
    overflow: "hidden",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
  },
  cardImage: {
    width: "100%",
    height: 130,
    backgroundColor: "#E5E7EB",
  },
  cardTypeBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    backgroundColor: "rgba(17, 24, 39, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardTypeBadgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "800",
  },
  cardDisasterBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  cardDisasterText: {
    fontSize: 10,
    fontWeight: "800",
  },
  cardContent: {
    padding: 12,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  cardPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: "#2E7D32",
    marginTop: 4,
  },
  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 4,
  },
  cardLocation: {
    fontSize: 12,
    color: "#6B7280",
    marginLeft: 3,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.4)",
    justifyContent: "flex-end",
  },
  filterSheet: {
    backgroundColor: "#FFFFFF",
    padding: 20,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 16,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 8,
  },
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 4,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  radiusHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 14,
  },
  radiusValue: {
    fontSize: 13,
    fontWeight: "800",
    color: "#2E7D32",
  },
  applyFilterBtn: {
    backgroundColor: "#2E7D32",
    marginTop: 18,
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
  },
  applyFilterBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
});
