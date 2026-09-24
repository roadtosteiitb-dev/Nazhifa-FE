import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import MapView, {
  Marker,
  Circle,
  Polygon,
  UrlTile,
  PROVIDER_GOOGLE,
  Region,
} from "react-native-maps";
import * as Location from "expo-location";
import Slider from "@react-native-community/slider";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Supercluster from "supercluster";

import {
  BaseMapType,
  DisasterType,
  PropertyFacilityLayerType,
  GisRiskLevel,
  DISASTER_LAYERS,
  PROPERTY_FACILITY_LAYERS,
  FacilityLayerConfig,
} from "../data/riskData";
import { fetchActiveLayers, LayerType, DisasterPolygon } from "../services/LayerService";
import { fetchFacilities, ApiFacility } from "../services/FacilityService";
import { FloatingMapControls } from "../components/maps/FloatingMapControls";
import { LayerSelectionSheet } from "../components/maps/LayerSelectionSheet";
import { PropertyPreviewCarousel } from "../components/maps/PropertyPreviewCarousel";
import { useLands } from "../contexts/LandContext";
import type { Land } from "../contexts/LandContext";

/** disasterType → base color, sourced from DISASTER_LAYERS (flood = blue, extreme_weather = purple, ...) */
const DISASTER_COLOR_MAP: Record<string, string> = Object.fromEntries(
  DISASTER_LAYERS.map((layer) => [layer.id, layer.color])
);

/** Quick layer chips on top of the map — colors match the polygons drawn for each layer */
const QUICK_DISASTER_LAYERS: { id: DisasterType; label: string; color: string }[] = (
  [
    { id: "flood", label: "Banjir 🌊" },
    { id: "landslide", label: "Longsor ⛰️" },
    { id: "eruption", label: "Erupsi Gunung 🌋" },
    { id: "extreme_weather", label: "Cuaca Ekstrem ⚡" },
    { id: "drought", label: "Kekeringan 🌵" },
    { id: "liquefaction", label: "Likuefaksi 🌍" },
  ] as { id: DisasterType; label: string }[]
).map((l) => ({ ...l, color: DISASTER_COLOR_MAP[l.id] }));

/** Property marker look: icon per property type, color per listing (dijual / disewa) */
const PROPERTY_TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  house: "home",
  apartment: "business",
  villa: "leaf",
};
const LISTING_COLOR = { sale: "#2E7D32", rent: "#2563EB" };

/** Below this latitudeDelta the map is "zoomed in" → property markers switch to a big pin with price */
const ZOOMED_IN_DELTA = 0.035;

/** Hide Google's own POI / transit icons so our property & facility markers are the only pins */
const CLEAN_MAP_STYLE = [
  { featureType: "poi", stylers: [{ visibility: "off" }] },
  { featureType: "transit", elementType: "labels.icon", stylers: [{ visibility: "off" }] },
];

/** Short Indonesian price label: 1,2 M · 850 Jt · 3,5 Jt/bln */
function formatShortPrice(price: number | undefined, isRent: boolean): string {
  if (!price) return "Harga -";
  let label: string;
  if (price >= 1_000_000_000) {
    label = `${(price / 1_000_000_000).toFixed(price % 1_000_000_000 === 0 ? 0 : 1).replace(".", ",")} M`;
  } else if (price >= 1_000_000) {
    const jt = price / 1_000_000;
    label = `${jt >= 100 ? Math.round(jt) : jt.toFixed(jt % 1 === 0 ? 0 : 1).replace(".", ",")} Jt`;
  } else {
    label = `${Math.round(price / 1000)} Rb`;
  }
  return isRent ? `${label}/bln` : label;
}

/** Facility layers (Sekolah, Rumah Sakit, …) keyed by OSM amenity */
const FACILITY_LAYER_BY_AMENITY: Record<string, FacilityLayerConfig> = Object.fromEntries(
  PROPERTY_FACILITY_LAYERS.filter((l) => l.amenity).map((l) => [l.amenity!, l])
);

/** Small round icon marker. Custom marker views are re-rendered natively only while
 *  tracksViewChanges is true — keep it on briefly so the icon font gets drawn, then turn it
 *  off, otherwise hundreds of markers keep re-rendering and the map stutters. */
const FacilityMarker = React.memo(function FacilityMarker({ facility }: { facility: ApiFacility }) {
  const layer = FACILITY_LAYER_BY_AMENITY[facility.amenity];
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 800);
    return () => clearTimeout(t);
  }, []);
  if (!layer) return null;
  return (
    <Marker
      coordinate={{ latitude: facility.lat, longitude: facility.lng }}
      title={facility.name}
      description={layer.name}
      tracksViewChanges={tracks}
      anchor={{ x: 0.5, y: 0.5 }}
    >
      <View style={styles.facilityMarkerWrap}>
        <View style={[styles.facilityMarker, { backgroundColor: layer.color }]}>
          <Ionicons name={layer.icon as any} size={12} color="#FFFFFF" />
        </View>
      </View>
    </Marker>
  );
});

/* ── Facility clustering (supercluster) ── */
type FacilityPointProps = { facility: ApiFacility; amenity: string };
type ClusterProps = { amenity: string }; // "mixed" when the cluster holds several categories

const CLUSTER_MAX_ZOOM = 16; // from this zoom level on, every facility is shown individually

const regionToZoom = (region: Region) =>
  Math.max(0, Math.min(20, Math.log2(360 / Math.max(region.longitudeDelta, 1e-6))));

/** Cluster bubble: size grows with the count, colored by category (gray = mixed). */
const FacilityClusterMarker = React.memo(function FacilityClusterMarker({
  coordinate,
  count,
  amenity,
  onPress,
}: {
  coordinate: { latitude: number; longitude: number };
  count: number;
  amenity: string;
  onPress: () => void;
}) {
  const layer = FACILITY_LAYER_BY_AMENITY[amenity];
  const color = layer?.color ?? "#475569";
  const size = count < 10 ? 30 : count < 50 ? 36 : count < 200 ? 42 : 48;
  const [tracks, setTracks] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setTracks(false), 800);
    return () => clearTimeout(t);
  }, []);
  return (
    <Marker
      coordinate={coordinate}
      tracksViewChanges={tracks}
      anchor={{ x: 0.5, y: 0.5 }}
      onPress={(e) => {
        e.stopPropagation?.();
        onPress();
      }}
    >
      {/* Fixed 56px box (largest bubble + halo) so Android never clips the snapshot */}
      <View style={styles.clusterWrap}>
        <View
          style={[
            styles.clusterHalo,
            { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, backgroundColor: hexToRgba(color, 0.25) },
          ]}
        >
          <View style={[styles.clusterBubble, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
            {layer && <Ionicons name={layer.icon as any} size={10} color="#FFFFFF" />}
            <Text style={styles.clusterCount}>{count > 999 ? "999+" : count}</Text>
          </View>
        </View>
      </View>
    </Marker>
  );
});

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
   MAIN MAP SCREEN
   ============================================= */
export default function HomeGuestMap() {
  const mapRef = useRef<MapView>(null);
  const router = useRouter();

  // ── Property data from LandContext (already fetches from GET /api/lands) ──
  const { lands } = useLands();

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

  /* Property markers are custom views: let them re-render natively for a moment after the
     data / selection changes (so icons and the active state get drawn), then freeze them. */
  const [propertyMarkersTrack, setPropertyMarkersTrack] = useState(true);
  const isZoomedIn = visibleRegion.latitudeDelta < ZOOMED_IN_DELTA;

  /* FACILITY LAYERS (Sekolah, Rumah Sakit, …) — GET /api/facilities for the current viewport */
  const [facilityMarkers, setFacilityMarkers] = useState<ApiFacility[]>([]);
  const [isFacilityLoading, setIsFacilityLoading] = useState(false);

  const activeAmenities = useMemo(
    () =>
      PROPERTY_FACILITY_LAYERS.filter((l) => l.amenity && activePropertyLayers.includes(l.id)).map(
        (l) => l.amenity!
      ),
    [activePropertyLayers]
  );

  useEffect(() => {
    if (activeAmenities.length === 0) {
      setFacilityMarkers([]);
      setIsFacilityLoading(false);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      // Small padding around the visible area so short pans don't pop markers in/out
      const latPad = visibleRegion.latitudeDelta * 0.25;
      const lngPad = visibleRegion.longitudeDelta * 0.25;
      setIsFacilityLoading(true);
      try {
        const data = await fetchFacilities(
          {
            amenities: activeAmenities,
            bbox: {
              minLat: visibleRegion.latitude - visibleRegion.latitudeDelta / 2 - latPad,
              maxLat: visibleRegion.latitude + visibleRegion.latitudeDelta / 2 + latPad,
              minLng: visibleRegion.longitude - visibleRegion.longitudeDelta / 2 - lngPad,
              maxLng: visibleRegion.longitude + visibleRegion.longitudeDelta / 2 + lngPad,
            },
          },
          controller.signal
        );
        if (!controller.signal.aborted) setFacilityMarkers(data);
      } catch (err: any) {
        if (err?.name !== "CanceledError" && err?.code !== "ERR_CANCELED") {
          console.warn("Facility layer fetch error:", err);
        }
      } finally {
        if (!controller.signal.aborted) setIsFacilityLoading(false);
      }
    }, 350);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [activeAmenities, visibleRegion]);

  /* FACILITY CLUSTERS — rebuilt when the loaded facilities change, queried per viewport */
  const facilityIndex = useMemo(() => {
    const index = new Supercluster<FacilityPointProps, ClusterProps>({
      radius: 60,
      maxZoom: CLUSTER_MAX_ZOOM,
      map: (props) => ({ amenity: props.amenity }),
      reduce: (acc, props) => {
        if (acc.amenity !== props.amenity) acc.amenity = "mixed";
      },
    });
    index.load(
      facilityMarkers.map((f) => ({
        type: "Feature" as const,
        properties: { facility: f, amenity: f.amenity },
        geometry: { type: "Point" as const, coordinates: [f.lng, f.lat] },
      }))
    );
    return index;
  }, [facilityMarkers]);

  const facilityClusters = useMemo(() => {
    if (facilityMarkers.length === 0) return [];
    const r = visibleRegion;
    return facilityIndex.getClusters(
      [
        r.longitude - r.longitudeDelta, // one extra screen on each side so edge clusters don't pop
        r.latitude - r.latitudeDelta,
        r.longitude + r.longitudeDelta,
        r.latitude + r.latitudeDelta,
      ],
      Math.round(regionToZoom(r))
    );
  }, [facilityIndex, facilityMarkers.length, visibleRegion]);

  /* Tap a cluster → zoom to the level where it splits apart */
  const zoomIntoCluster = (clusterId: number, latitude: number, longitude: number) => {
    const zoom = Math.min(facilityIndex.getClusterExpansionZoom(clusterId), CLUSTER_MAX_ZOOM + 1);
    const delta = 360 / Math.pow(2, zoom);
    mapRef.current?.animateToRegion({ latitude, longitude, latitudeDelta: delta, longitudeDelta: delta }, 400);
  };

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

  /* Properties that can be shown on the map (preview carousel swipes through these) */
  const mappableProperties = useMemo(
    () => (activePropertyLayers.includes("properties") ? filtered.filter((l) => !!l.center) : []),
    [filtered, activePropertyLayers]
  );
  const previewVisible = !!activeId && mappableProperties.some((l) => l.id === activeId);

  /* Select a property and move the camera so its pin sits above the preview card */
  const focusProperty = useCallback(
    (id: string) => {
      const land = mappableProperties.find((l) => l.id === id);
      setActiveId(id);
      if (!land?.center) return;
      const delta = 0.02;
      mapRef.current?.animateToRegion(
        {
          latitude: land.center.latitude - delta * 0.28,
          longitude: land.center.longitude,
          latitudeDelta: delta,
          longitudeDelta: delta,
        },
        450
      );
    },
    [mappableProperties]
  );

  useEffect(() => {
    setPropertyMarkersTrack(true);
    const t = setTimeout(() => setPropertyMarkersTrack(false), 800);
    return () => clearTimeout(t);
  }, [filtered, activeId, isZoomedIn]);

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
          {QUICK_DISASTER_LAYERS.map((layer) => {
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
        customMapStyle={baseMap === "standard" ? CLEAN_MAP_STYLE : []}
        style={StyleSheet.absoluteFillObject}
        showsUserLocation
        onRegionChangeComplete={setVisibleRegion}
        onPress={(e) => {
          // iOS also reports marker taps here — only close on a real map tap
          if ((e.nativeEvent as any).action !== "marker-press") setActiveId(null);
        }}
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
            const isRent = l.isForSale === false;
            const color = isRent ? LISTING_COLOR.rent : LISTING_COLOR.sale;
            const typeIcon = PROPERTY_TYPE_ICON[l.type ?? ""] ?? "home";

            return (
              <Marker
                key={l.id}
                coordinate={l.center}
                anchor={isZoomedIn ? { x: 0.5, y: 1 } : { x: 0.5, y: 0.5 }}
                tracksViewChanges={propertyMarkersTrack}
                zIndex={isActive ? 999 : 1}
                onPress={(e) => {
                  e.stopPropagation?.();
                  focusProperty(l.id);
                }}
              >
                {/* PROPERTY MARKER
                    - zoomed out: small rounded square (same footprint as facility markers) with a
                      colored halo so it still pops out between other icons
                    - zoomed in: big pin + price label
                    icon = property type, color = dijual (hijau) / disewa (biru).
                    Fixed-size wrappers so Android never clips the marker snapshot. */}
                {isZoomedIn ? (
                  <View style={styles.propertyPinWrap}>
                    <View style={[styles.propertyPriceChip, { borderColor: color }, isActive && { backgroundColor: color }]}>
                      <Text style={[styles.propertyPriceText, { color: isActive ? "#FFFFFF" : color }]} numberOfLines={1}>
                        {formatShortPrice(l.price, isRent)}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.propertyPinHead,
                        { backgroundColor: color },
                        isActive && styles.propertyMarkerActive,
                      ]}
                    >
                      <Ionicons name={typeIcon} size={17} color="#FFFFFF" />
                    </View>
                    <View style={[styles.propertyPinTail, { borderTopColor: isActive ? "#111827" : color }]} />
                  </View>
                ) : (
                  <View style={styles.propertyMarkerWrap}>
                    <View style={[styles.propertyHalo, { backgroundColor: hexToRgba(color, isActive ? 0.45 : 0.28) }]}>
                      <View
                        style={[
                          styles.propertyMarker,
                          { backgroundColor: color },
                          isActive && styles.propertyMarkerActive,
                        ]}
                      >
                        <Ionicons name={typeIcon} size={12} color="#FFFFFF" />
                      </View>
                    </View>
                  </View>
                )}
              </Marker>
            );
          })}

        {/* FACILITY MARKERS — active facility layers from the Layer Panel, clustered */}
        {facilityClusters.map((c) => {
          const [lng, lat] = c.geometry.coordinates;
          if ("cluster" in c.properties && c.properties.cluster) {
            const { cluster_id, point_count, amenity } = c.properties as Supercluster.ClusterProperties & ClusterProps;
            return (
              <FacilityClusterMarker
                key={`cl-${cluster_id}-${point_count}-${amenity}`}
                coordinate={{ latitude: lat, longitude: lng }}
                count={point_count}
                amenity={amenity}
                onPress={() => zoomIntoCluster(cluster_id, lat, lng)}
              />
            );
          }
          const f = (c.properties as FacilityPointProps).facility;
          return <FacilityMarker key={`fac-${f.id}`} facility={f} />;
        })}
      </MapView>

      {/* PROPERTY PREVIEW (interactive popup) */}
      {previewVisible && (
        <PropertyPreviewCarousel
          properties={mappableProperties}
          activeId={activeId!}
          onChangeActive={focusProperty}
          onClose={() => setActiveId(null)}
          onOpenDetail={(id) => router.push({ pathname: "/product/[id]", params: { id } })}
        />
      )}

      {/* PROPERTY MARKER LEGEND */}
      {activePropertyLayers.includes("properties") && (
        <View style={styles.propertyLegend} pointerEvents="none">
          <View style={[styles.propertyLegendDot, { backgroundColor: LISTING_COLOR.sale }]} />
          <Text style={styles.propertyLegendText}>Dijual</Text>
          <View style={[styles.propertyLegendDot, { backgroundColor: LISTING_COLOR.rent, marginLeft: 8 }]} />
          <Text style={styles.propertyLegendText}>Disewa</Text>
        </View>
      )}

      {/* FACILITY LOADING PILL */}
      {isFacilityLoading && (
        <View style={styles.facilityLoadingPill}>
          <ActivityIndicator size="small" color="#2E7D32" />
          <Text style={styles.facilityLoadingText}>Memuat fasilitas…</Text>
        </View>
      )}

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
  clusterWrap: {
    width: 58,
    height: 58,
    alignItems: "center",
    justifyContent: "center",
  },
  clusterHalo: {
    alignItems: "center",
    justifyContent: "center",
  },
  clusterBubble: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  clusterCount: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "800",
    marginTop: -1,
  },
  facilityMarkerWrap: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  facilityMarker: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  facilityLoadingPill: {
    position: "absolute",
    top: 158,
    right: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  propertyLegend: {
    position: "absolute",
    top: 158,
    left: 16,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.95)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    elevation: 2,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
  },
  propertyLegendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 4 },
  propertyLegendText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  facilityLoadingText: { fontSize: 12, color: "#374151", fontWeight: "600" },
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
  propertyMarker: {
    width: 22,
    height: 22,
    borderRadius: 7,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  propertyMarkerActive: {
    borderColor: "#111827",
  },
  propertyMarkerWrap: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  propertyHalo: {
    width: 34,
    height: 34,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  propertyPinWrap: {
    width: 120,
    height: 70,
    alignItems: "center",
    justifyContent: "flex-end",
  },
  propertyPriceChip: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1.5,
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 2,
    marginBottom: 3,
    maxWidth: 118,
  },
  propertyPriceText: {
    fontSize: 11,
    fontWeight: "800",
  },
  propertyPinHead: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
  },
  propertyPinTail: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: 7,
    borderRightWidth: 7,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
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
  errorBanner: {
    position: "absolute",
    bottom: 24,
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
