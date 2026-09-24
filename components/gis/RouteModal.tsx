import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";
import { fetchRoute, LatLng, NearestFacility, RouteResult } from "../../services/FacilityService";

const PRIMARY = "#2E7D32";

interface Props {
  visible: boolean;
  onClose: () => void;
  landId: string;
  propertyName: string;
  propertyCoords: LatLng;
  facility: NearestFacility | null;
}

/** Opens turn-by-turn navigation in Google Maps (app if installed, otherwise browser). */
export function openExternalDirections(to: LatLng, from?: LatLng) {
  const dest = `${to.latitude},${to.longitude}`;
  const origin = from ? `&origin=${from.latitude},${from.longitude}` : "";
  const url = `https://www.google.com/maps/dir/?api=1${origin}&destination=${dest}&travelmode=driving`;
  Linking.openURL(url).catch(() => {
    // Last resort: native maps app
    const fallback = Platform.OS === "ios" ? `maps://?daddr=${dest}` : `geo:0,0?q=${dest}`;
    Linking.openURL(fallback).catch(() => {});
  });
}

export function RouteModal({ visible, onClose, landId, propertyName, propertyCoords, facility }: Props) {
  const mapRef = useRef<MapView>(null);
  const [route, setRoute] = useState<RouteResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const destination: LatLng | null = facility ? { latitude: facility.lat, longitude: facility.lng } : null;

  const load = async () => {
    if (!facility) return;
    setLoading(true);
    setError(null);
    setRoute(null);
    try {
      setRoute(await fetchRoute(landId, { lat: facility.lat, lng: facility.lng }));
    } catch (e: any) {
      setError(e.response?.data?.error || "Rute tidak dapat dimuat.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (visible && facility) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, facility?.lat, facility?.lng, landId]);

  // Fit camera to the whole route (or both endpoints while loading / on error)
  const fitMap = () => {
    if (!destination) return;
    const points = route?.coordinates.length ? route.coordinates : [propertyCoords, destination];
    mapRef.current?.fitToCoordinates(points, {
      edgePadding: { top: 80, right: 60, bottom: 260, left: 60 },
      animated: true,
    });
  };

  useEffect(() => {
    const t = setTimeout(fitMap, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route, visible]);

  if (!facility || !destination) return null;

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <MapView
          ref={mapRef}
          provider={PROVIDER_GOOGLE}
          style={StyleSheet.absoluteFillObject}
          initialRegion={{
            latitude: (propertyCoords.latitude + destination.latitude) / 2,
            longitude: (propertyCoords.longitude + destination.longitude) / 2,
            latitudeDelta: Math.abs(propertyCoords.latitude - destination.latitude) * 2 + 0.01,
            longitudeDelta: Math.abs(propertyCoords.longitude - destination.longitude) * 2 + 0.01,
          }}
          onMapReady={fitMap}
          toolbarEnabled={false}
        >
          <Marker coordinate={propertyCoords} title={propertyName} pinColor={PRIMARY} />
          <Marker coordinate={destination} title={facility.name} description={facility.category} pinColor="#DC2626" />
          {route && route.coordinates.length > 1 && (
            <>
              <Polyline coordinates={route.coordinates} strokeColor="#FFFFFF" strokeWidth={8} />
              <Polyline coordinates={route.coordinates} strokeColor="#2563EB" strokeWidth={5} />
            </>
          )}
        </MapView>

        {/* Header */}
        <SafeAreaView edges={["top"]} style={styles.headerWrap} pointerEvents="box-none">
          <View style={styles.header}>
            <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
              <Ionicons name="close" size={22} color="#0F172A" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Rute ke {facility.category}</Text>
          </View>
        </SafeAreaView>

        {/* Bottom sheet */}
        <SafeAreaView edges={["bottom"]} style={styles.sheet}>
          <View style={styles.pointRow}>
            <View style={[styles.dot, { backgroundColor: PRIMARY }]} />
            <Text style={styles.pointText} numberOfLines={1}>{propertyName}</Text>
          </View>
          <View style={styles.connector} />
          <View style={styles.pointRow}>
            <View style={[styles.dot, { backgroundColor: "#DC2626" }]} />
            <Text style={styles.pointText} numberOfLines={1}>{facility.name}</Text>
          </View>

          <View style={styles.statsRow}>
            {loading ? (
              <View style={styles.loadingRow}>
                <ActivityIndicator color={PRIMARY} />
                <Text style={styles.mutedText}>Menghitung rute…</Text>
              </View>
            ) : error ? (
              <View style={styles.loadingRow}>
                <Ionicons name="alert-circle-outline" size={18} color="#DC2626" />
                <Text style={[styles.mutedText, { color: "#DC2626", flex: 1 }]}>{error}</Text>
                <TouchableOpacity onPress={load}>
                  <Text style={styles.retryText}>Coba lagi</Text>
                </TouchableOpacity>
              </View>
            ) : route ? (
              <>
                <View style={styles.statBox}>
                  <Ionicons name="car-outline" size={18} color={PRIMARY} />
                  <Text style={styles.statValue}>{route.durationMinutes} mnt</Text>
                  <Text style={styles.statLabel}>Waktu tempuh</Text>
                </View>
                <View style={styles.statBox}>
                  <Ionicons name="trail-sign-outline" size={18} color={PRIMARY} />
                  <Text style={styles.statValue}>{route.distanceKm} km</Text>
                  <Text style={styles.statLabel}>Jarak jalan</Text>
                </View>
                <View style={styles.statBox}>
                  <Ionicons name="resize-outline" size={18} color="#64748B" />
                  <Text style={styles.statValue}>{facility.distanceKm} km</Text>
                  <Text style={styles.statLabel}>Garis lurus</Text>
                </View>
              </>
            ) : null}
          </View>

          <TouchableOpacity
            style={styles.navBtn}
            onPress={() => openExternalDirections(destination, propertyCoords)}
            activeOpacity={0.85}
          >
            <Ionicons name="navigate" size={18} color="#FFFFFF" />
            <Text style={styles.navBtnText}>Buka Navigasi di Google Maps</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#E5E7EB" },
  headerWrap: { position: "absolute", top: 0, left: 0, right: 0 },
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 16, paddingTop: 8 },
  closeBtn: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: "#FFFFFF",
    alignItems: "center", justifyContent: "center",
    shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 6, shadowOffset: { width: 0, height: 2 }, elevation: 4,
  },
  headerTitle: {
    flexShrink: 1, fontSize: 15, fontWeight: "700", color: "#0F172A",
    backgroundColor: "#FFFFFF", paddingHorizontal: 14, paddingVertical: 9, borderRadius: 20, overflow: "hidden",
  },
  sheet: {
    position: "absolute", left: 0, right: 0, bottom: 0,
    backgroundColor: "#FFFFFF", borderTopLeftRadius: 22, borderTopRightRadius: 22,
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 12,
    shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 12, shadowOffset: { width: 0, height: -2 }, elevation: 10,
  },
  pointRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  connector: { width: 2, height: 14, backgroundColor: "#CBD5E1", marginLeft: 5, marginVertical: 3 },
  pointText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#0F172A" },
  statsRow: { flexDirection: "row", gap: 8, marginTop: 16, minHeight: 72, alignItems: "stretch" },
  loadingRow: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  mutedText: { fontSize: 13, color: "#64748B" },
  retryText: { fontSize: 13, fontWeight: "700", color: PRIMARY },
  statBox: {
    flex: 1, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 10,
    borderWidth: 1, borderColor: "#E2E8F0", alignItems: "flex-start",
  },
  statValue: { fontSize: 16, fontWeight: "800", color: "#0F172A", marginTop: 4 },
  statLabel: { fontSize: 11, color: "#64748B", marginTop: 2 },
  navBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    backgroundColor: PRIMARY, borderRadius: 14, paddingVertical: 14, marginTop: 16,
  },
  navBtnText: { color: "#FFFFFF", fontSize: 15, fontWeight: "700" },
});
