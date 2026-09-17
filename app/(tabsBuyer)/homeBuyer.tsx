import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  Image,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { useLands } from "../../contexts/LandContext";

/* =========================
   PROPERTY CARD
========================= */
const PropertyCard = ({ land, viewMode, onPress, theme }: any) => {
  const isGrid = viewMode === "grid";

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={onPress}
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: theme.borderWidth,
          borderRadius: theme.borderRadius,
          shadowColor: theme.shadow || '#000',
          shadowOffset: theme.shadowOffset,
          shadowOpacity: theme.shadowOpacity,
          shadowRadius: theme.shadowRadius,
          elevation: 2,
        },
        isGrid && styles.gridCard,
      ]}
    >
      <View>
        <Image source={{ uri: land.image }} style={styles.cardImage} />

        <View style={[styles.statusBadge, { backgroundColor: land.isForSale ? "#10B981" : "#F59E0B", borderRadius: 8 }]}>
          <Text style={styles.statusBadgeText}>
            {land.isForSale ? "DIJUAL" : "DISEWA"}
          </Text>
        </View>

        {land.status === "Sold" && (
          <View style={styles.soldOverlay}>
            <Text style={styles.soldOverlayText}>TERJUAL</Text>
          </View>
        )}
      </View>

      <View style={styles.cardContent}>
        <Text numberOfLines={1} style={[styles.landName, { color: theme.text }]}>
          {land.name}
        </Text>

        <Text style={[styles.landPrice, { color: theme.primary }]}>
          Rp{land.price?.toLocaleString("id-ID")}
        </Text>

        <View style={styles.locationRow}>
          <Ionicons name="location-outline" size={12} color={theme.textSecondary} />
          <Text numberOfLines={1} style={[styles.landLocation, { color: theme.textSecondary }]}>
            {land.location}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
};

/* =========================
   MAIN PAGE
========================= */
export default function HomeBuyer() {
  const { theme } = useTheme();
  const { lands } = useLands();
  const router = useRouter();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStatus, setSelectedStatus] =
    useState<"all" | "sale" | "rent">("all");
  const [sortOption, setSortOption] =
    useState<"none" | "lowToHigh" | "highToLow">("none");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isFilterVisible, setFilterVisible] = useState(false);

  /* =========================
     FILTER + SORT
  ========================= */
  const [selectedRadius, setSelectedRadius] = useState<"all" | 2 | 5 | 10 | 25>("all");
  const defaultUserPos = { latitude: -7.7956, longitude: 110.3695 };

  const filteredLands = useMemo(() => {
    let data = lands.filter((l) => l.status === "Approved" || l.status === "Sold");

    if (searchQuery.trim()) {
      data = data.filter((l) =>
        l.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (selectedStatus === "sale") {
      data = data.filter((l) => l.isForSale);
    }

    if (selectedStatus === "rent") {
      data = data.filter((l) => !l.isForSale);
    }

    if (selectedRadius !== "all") {
      data = data.filter((l) => {
        const coords = l.center || (l.coords && l.coords[0]) || { latitude: -7.7956 + (parseInt(l.id) * 0.01), longitude: 110.3695 + (parseInt(l.id) * 0.01) };
        const dLat = ((coords.latitude - defaultUserPos.latitude) * Math.PI) / 180;
        const dLon = ((coords.longitude - defaultUserPos.longitude) * Math.PI) / 180;
        const a = Math.sin(dLat / 2) ** 2 + Math.cos((defaultUserPos.latitude * Math.PI) / 180) * Math.cos((coords.latitude * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
        const distKm = 6371 * (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)));
        return distKm <= selectedRadius;
      });
    }

    if (sortOption === "lowToHigh") {
      data = data.sort((a, b) => (a.price || 0) - (b.price || 0));
    }

    if (sortOption === "highToLow") {
      data = data.sort((a, b) => (b.price || 0) - (a.price || 0));
    }

    return data;
  }, [lands, searchQuery, selectedStatus, selectedRadius, sortOption]);

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: theme.surface }]}
    >
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* HEADER */}
        <View style={styles.header}>
          <View>
            <Text style={[styles.brandTitle, { color: theme.primary }]}>
              titikhuni
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>Jelajahi properti terbaik</Text>
          </View>

          <View style={styles.headerActions}>
            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: theme.card,
                  borderColor: theme.border,
                  borderWidth: theme.borderWidth,
                  borderRadius: 12,
                  shadowColor: theme.shadow || '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 1,
                },
              ]}
              onPress={() =>
                setViewMode(viewMode === "grid" ? "list" : "grid")
              }
            >
              <Ionicons
                name={viewMode === "grid" ? "list-outline" : "grid-outline"}
                size={22}
                color={theme.text}
              />
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.iconButton,
                {
                  backgroundColor: theme.primary,
                  borderRadius: 12,
                  shadowColor: theme.shadow || '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.1,
                  shadowRadius: 4,
                  elevation: 1,
                },
              ]}
              onPress={() => setFilterVisible(true)}
            >
              <Ionicons name="filter-outline" size={22} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* SEARCH & FILTER ROW */}
        <View style={styles.searchContainer}>
          <View
            style={[
              styles.searchBox,
              {
                backgroundColor: theme.card,
                borderColor: theme.border,
                borderWidth: theme.borderWidth,
                borderRadius: theme.borderRadius,
                shadowColor: theme.shadow || '#000',
                shadowOffset: theme.shadowOffset,
                shadowOpacity: theme.shadowOpacity,
                shadowRadius: theme.shadowRadius,
                elevation: 2,
              },
            ]}
          >
            <Ionicons name="search-outline" size={20} color={theme.textSecondary} />
            <TextInput
              placeholder="Cari properti..."
              placeholderTextColor={theme.textLight}
              style={[styles.searchInput, { color: theme.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
        </View>

        {/* CATEGORIES */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        >
          {[
            { id: "all", label: "Semua", icon: "grid-outline" },
            { id: "sale", label: "Dijual", icon: "cash-outline" },
            { id: "rent", label: "Disewa", icon: "key-outline" },
          ].map((cat) => {
            const isActive = selectedStatus === cat.id;
            return (
              <TouchableOpacity
                key={cat.id}
                onPress={() => setSelectedStatus(cat.id as any)}
                style={[
                  styles.categoryTab,
                  {
                    backgroundColor: isActive ? theme.primary : theme.card,
                    borderColor: isActive ? theme.primary : theme.border,
                    borderWidth: theme.borderWidth,
                    borderRadius: 24, // Rounded pills
                  },
                ]}
              >
                <Ionicons
                  name={cat.icon as any}
                  size={14}
                  color={isActive ? "#FFFFFF" : theme.textSecondary}
                />
                <Text
                  style={[
                    styles.categoryLabel,
                    {
                      color: isActive ? "#FFFFFF" : theme.text,
                      fontWeight: isActive ? "700" : "500",
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        {/* SPATIAL RADIUS FILTER (PostGIS ST_DWithin) */}
        <View style={{ paddingHorizontal: 20, marginTop: 10, marginBottom: 6 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 8 }}>
            <Ionicons name="navigate-circle" size={16} color={theme.primary} />
            <Text style={{ fontSize: 12, fontWeight: "800", color: theme.text }}>
              Radius Spasial (PostGIS ST_DWithin)
            </Text>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
            {[
              { id: "all", label: "Semua Radius" },
              { id: 2, label: "< 2 km" },
              { id: 5, label: "< 5 km" },
              { id: 10, label: "< 10 km" },
              { id: 25, label: "< 25 km" },
            ].map((r) => {
              const isActive = selectedRadius === r.id;
              return (
                <TouchableOpacity
                  key={String(r.id)}
                  onPress={() => setSelectedRadius(r.id as any)}
                  style={{
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 20,
                    backgroundColor: isActive ? theme.primary + "18" : theme.card,
                    borderColor: isActive ? theme.primary : theme.border,
                    borderWidth: 1,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 4,
                  }}
                >
                  <Ionicons name="compass-outline" size={12} color={isActive ? theme.primary : theme.textSecondary} />
                  <Text style={{ fontSize: 11, fontWeight: "700", color: isActive ? theme.primary : theme.textSecondary }}>
                    {r.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>

        {/* LIST */}
        <View
          style={[
            styles.listWrapper,
            viewMode === "grid" && styles.gridWrapper,
          ]}
        >
          {filteredLands.map((item) => (
            <PropertyCard
              key={item.id}
              land={item}
              viewMode={viewMode}
              theme={theme}
              onPress={() =>
                router.push({
                  pathname: "/product/[id]",
                  params: { id: item.id },
                })
              }
            />
          ))}
        </View>
      </ScrollView>

      {/* MAP BUTTON */}
      <TouchableOpacity
        style={[
          styles.mapButton,
          {
            backgroundColor: theme.primary,
            borderRadius: 30, // capsule shape
            shadowColor: theme.shadow || '#000',
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.2,
            shadowRadius: 8,
            elevation: 4,
          },
        ]}
        onPress={() => router.push("/maps")}
      >
        <Ionicons name="map-outline" size={22} color="#FFF" />
        <Text style={styles.mapText}>Lihat Peta</Text>
      </TouchableOpacity>

      {/* FILTER MODAL */}
      <Modal transparent visible={isFilterVisible} animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={[styles.filterSheet, { backgroundColor: theme.card }]}>
            <Text style={[styles.modalTitle, { color: theme.text }]}>Filter & Urutkan</Text>

            <View style={styles.chipRow}>
              {["all", "sale", "rent"].map((s) => (
                <TouchableOpacity
                  key={s}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: selectedStatus === s ? theme.primary : theme.surface,
                      borderColor: selectedStatus === s ? theme.primary : theme.border,
                      borderWidth: 1,
                      borderRadius: 20,
                    },
                  ]}
                  onPress={() => setSelectedStatus(s as any)}
                >
                  <Text style={{ color: selectedStatus === s ? "#FFF" : theme.text, fontWeight: "600" }}>
                    {s === "all" ? "Semua" : s === "sale" ? "Dijual" : "Disewa"}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={styles.chipRow}>
              {[
                { key: "lowToHigh", label: "Termurah" },
                { key: "highToLow", label: "Termahal" },
              ].map((o) => (
                <TouchableOpacity
                  key={o.key}
                  style={[
                    styles.chip,
                    {
                      backgroundColor: sortOption === o.key ? theme.primary : theme.surface,
                      borderColor: sortOption === o.key ? theme.primary : theme.border,
                      borderWidth: 1,
                      borderRadius: 20,
                    },
                  ]}
                  onPress={() => setSortOption(o.key as any)}
                >
                  <Text style={{ color: sortOption === o.key ? "#FFF" : theme.text, fontWeight: "600" }}>
                    {o.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity
              style={[
                styles.applyButton,
                {
                  backgroundColor: theme.primary,
                  borderRadius: theme.borderRadius,
                },
              ]}
              onPress={() => setFilterVisible(false)}
            >
              <Text style={styles.applyText}>Terapkan</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* =========================
   STYLES
========================= */
const styles = StyleSheet.create({
  container: { flex: 1 },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  brandTitle: {
    fontSize: 28,
    fontWeight: "900",
    letterSpacing: -0.5,
  },

  subtitle: {
    fontSize: 14,
    marginTop: 2,
  },

  headerActions: {
    flexDirection: "row",
    gap: 8,
  },

  iconButton: {
    padding: 10,
    alignItems: "center",
    justifyContent: "center",
  },

  searchContainer: {
    paddingHorizontal: 20,
    paddingVertical: 12,
  },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    height: 50,
  },

  searchInput: {
    marginLeft: 10,
    fontSize: 15,
    flex: 1,
    fontWeight: "500",
  },

  categoriesContainer: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 8,
  },

  categoryTab: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 6,
  },

  categoryLabel: {
    fontSize: 13,
  },

  listWrapper: {
    paddingHorizontal: 20,
    paddingBottom: 120,
  },

  gridWrapper: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
  },

  card: {
    marginBottom: 16,
    overflow: "hidden",
  },

  gridCard: {
    width: "48%",
  },

  cardImage: {
    width: "100%",
    height: 135,
    backgroundColor: "#E2E8F0",
  },

  statusBadge: {
    position: "absolute",
    top: 10,
    left: 10,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  statusBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "800",
  },

  ratingBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(15, 23, 42, 0.75)",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  ratingText: {
    color: "#FFF",
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 4,
  },

  cardContent: {
    padding: 12,
  },

  landName: {
    fontSize: 14,
    fontWeight: "700",
    lineHeight: 18,
  },

  landPrice: {
    marginTop: 6,
    fontSize: 16,
    fontWeight: "900",
  },

  locationRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 6,
  },

  landLocation: {
    fontSize: 12,
    marginLeft: 4,
    fontWeight: "500",
  },

  mapButton: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    flexDirection: "row",
    paddingHorizontal: 22,
    paddingVertical: 14,
    alignItems: "center",
    gap: 8,
  },

  mapText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 15,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.4)",
    justifyContent: "flex-end",
  },

  filterSheet: {
    padding: 24,
    borderTopLeftRadius: 0,
    borderTopRightRadius: 0,
  },

  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    marginBottom: 16,
  },

  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginVertical: 8,
  },

  chip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
  },

  chipActive: {
  },

  applyButton: {
    marginTop: 20,
    padding: 16,
    alignItems: "center",
  },

  applyText: {
    color: "#FFF",
    fontWeight: "700",
    fontSize: 16,
  },

  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
  },
  soldOverlayText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: 2,
    borderWidth: 1.5,
    borderColor: "#FFF",
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 6,
  },
});
