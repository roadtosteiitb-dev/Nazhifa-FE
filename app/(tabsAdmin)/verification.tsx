import React, { useState, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useLands, Land } from "../../contexts/LandContext";

const PRIMARY = "#2E7D32";
const SUCCESS = "#16A34A";
const DANGER = "#EF4444";
const TEXT_DARK = "#0F172A";
const TEXT_SECONDARY = "#64748B";

type FilterType = "all" | "pending" | "accepted" | "declined";

export default function VerificationScreen() {
  const { lands = [], isLoading, updateLandStatus } = useLands() || {};
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedItem, setSelectedItem] = useState<Land | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  const filtered = useMemo(() => {
    return lands.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.owner || "").toLowerCase().includes(search.toLowerCase());
      let matchFilter = true;
      if (filter === "pending") matchFilter = item.status === "Pending";
      else if (filter === "accepted") matchFilter = item.status === "Approved";
      else if (filter === "declined") matchFilter = item.status === "Rejected";
      return matchSearch && matchFilter;
    });
  }, [lands, search, filter]);

  const handleAccept = (id: string) => {
    Alert.alert("Approve Property", "Confirm approval?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: async () => {
          try {
            if (updateLandStatus) await updateLandStatus(id, "Approved");
            if (selectedItem?.id === id) setSelectedItem(null);
          } catch {
            Alert.alert("Gagal", "Tidak dapat menyetujui properti.");
          }
        },
      },
    ]);
  };

  const handleDecline = (id: string) => {
    setRejectingId(id);
    setRejectionReasonInput("");
  };

  const submitRejection = async () => {
    if (!rejectingId) return;
    const reason = rejectionReasonInput.trim() || "Lokasi properti tidak sesuai.";
    try {
      if (updateLandStatus) await updateLandStatus(rejectingId, "Rejected", reason);
      if (selectedItem?.id === rejectingId) setSelectedItem(null);
      setRejectingId(null);
      setRejectionReasonInput("");
    } catch {
      Alert.alert("Gagal", "Tidak dapat menolak properti.");
    }
  };

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Pending", value: "pending" },
    { label: "Approved", value: "accepted" },
    { label: "Rejected", value: "declined" },
  ];

  const getStatusInfo = (status?: string) => {
    switch (status) {
      case "Approved": return { bg: "#DCFCE7", text: SUCCESS, label: "Approved" };
      case "Rejected": return { bg: "#FEE2E2", text: DANGER, label: "Rejected" };
      default: return { bg: "#FEF3C7", text: "#D97706", label: "Pending" };
    }
  };

  // ── Detail View ──
  if (selectedItem) {
    const si = lands.find((l) => l.id === selectedItem.id) || selectedItem;
    const statusInfo = getStatusInfo(si.status);
    const gallery = si.images && si.images.length > 0 ? si.images : (si.image ? [si.image] : []);
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={TEXT_DARK} />
            </TouchableOpacity>
            <Text style={styles.detailHeaderTitle}>Property Details</Text>
            <View style={{ width: 42 }} />
          </View>

          {gallery.length > 0 && (
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false}>
              {gallery.map((img: string, idx: number) => (
                <Image key={idx} source={{ uri: img }} style={styles.galleryImage} />
              ))}
            </ScrollView>
          )}

          <View style={{ padding: 20 }}>
            <View style={styles.detailTitleRow}>
              <Text style={styles.detailTitle}>{si.name}</Text>
              <View style={[styles.detailStatus, { backgroundColor: statusInfo.bg }]}>
                <Text style={[styles.detailStatusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
              </View>
            </View>

            <Text style={styles.detailPrice}>Rp{(si.price || 0).toLocaleString("id-ID")}</Text>

            {si.status === "Rejected" && si.rejectionReason && (
              <View style={styles.rejectionBox}>
                <Text style={styles.rejectionTitle}>Alasan Penolakan:</Text>
                <Text style={styles.rejectionText}>{si.rejectionReason}</Text>
              </View>
            )}

            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Ionicons name="person-outline" size={16} color={PRIMARY} />
                <Text style={styles.infoLabel}>Owner</Text>
                <Text style={styles.infoValue}>{si.owner || "-"}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="location-outline" size={16} color={PRIMARY} />
                <Text style={styles.infoLabel}>Location</Text>
                <Text style={styles.infoValue}>{si.location}</Text>
              </View>
              <View style={styles.infoItem}>
                <Ionicons name="calendar-outline" size={16} color={PRIMARY} />
                <Text style={styles.infoLabel}>Submitted</Text>
                <Text style={styles.infoValue}>{si.createdAt ? new Date(si.createdAt).toLocaleDateString("id-ID") : "-"}</Text>
              </View>
            </View>

            <Text style={styles.sectionLabel}>Description</Text>
            <Text style={styles.descText}>{si.description || "-"}</Text>

            {si.facilities && si.facilities.length > 0 && (
              <>
                <Text style={styles.sectionLabel}>Facilities</Text>
                <View style={styles.facilitiesRow}>
                  {si.facilities.map((f: string, i: number) => (
                    <View key={i} style={styles.facilityChip}>
                      <Ionicons name="checkmark-circle" size={14} color={PRIMARY} />
                      <Text style={styles.facilityText}>{f}</Text>
                    </View>
                  ))}
                </View>
              </>
            )}

            {si.center && (
              <>
                <Text style={styles.sectionLabel}>Map Location</Text>
                <View style={styles.mapPlaceholder}>
                  <Ionicons name="map" size={32} color={PRIMARY} />
                  <Text style={styles.mapCoordText}>
                    Lat: {si.center.latitude.toFixed(4)}, Lng: {si.center.longitude.toFixed(4)}
                  </Text>
                </View>
              </>
            )}

            {si.status === "Pending" && (
              <View style={styles.detailActions}>
                <TouchableOpacity style={styles.detailApproveBtn} onPress={() => handleAccept(si.id)}>
                  <Ionicons name="checkmark-circle" size={18} color="#fff" />
                  <Text style={styles.detailApproveText}>Approve Property</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.detailRejectBtn} onPress={() => handleDecline(si.id)}>
                  <Ionicons name="close-circle" size={18} color="#fff" />
                  <Text style={styles.detailRejectText}>Reject Property</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        <Modal visible={rejectingId !== null} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Tolak Pengajuan</Text>
              <TextInput
                style={styles.modalInput}
                placeholder="Alasan penolakan..."
                value={rejectionReasonInput}
                onChangeText={setRejectionReasonInput}
                multiline
                numberOfLines={4}
              />
              <View style={styles.modalBtnRow}>
                <TouchableOpacity style={styles.cancelBtn} onPress={() => setRejectingId(null)}>
                  <Text style={styles.cancelBtnText}>Batal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.confirmBtn} onPress={submitRejection}>
                  <Text style={styles.confirmBtnText}>Tolak</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── List View ──
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>Property Verification</Text>
        <Text style={styles.pageSubtitle}>Review property submissions from owners</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={TEXT_SECONDARY} style={{ marginLeft: 14 }} />
        <TextInput
          placeholder="Search properties or owners..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholderTextColor={TEXT_SECONDARY}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={styles.filterScroll}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.chip, filter === f.value && styles.chipActive]}
            onPress={() => setFilter(f.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, filter === f.value && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>
        {isLoading ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyText}>Memuat data...</Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="folder-open-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>No properties found.</Text>
          </View>
        ) : (
          filtered.map((item) => {
            const info = getStatusInfo(item.status);
            return (
              <View key={item.id} style={styles.card}>
                <Image source={{ uri: item.image || undefined }} style={styles.cardImage} />
                <View style={[styles.cardBadge, { backgroundColor: info.bg }]}>
                  <Text style={[styles.cardBadgeText, { color: info.text }]}>{info.label}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.cardName}>{item.name}</Text>
                  <Text style={styles.cardSeller}>by {item.owner || "-"}</Text>
                  <View style={styles.cardMeta}>
                    <Ionicons name="location-outline" size={12} color={TEXT_SECONDARY} />
                    <Text style={styles.cardMetaText}>{item.location}</Text>
                  </View>
                  <Text style={styles.cardPrice}>Rp{(item.price || 0).toLocaleString("id-ID")}</Text>

                  <View style={styles.cardActions}>
                    <TouchableOpacity style={styles.viewBtn} onPress={() => setSelectedItem(item)}>
                      <Ionicons name="eye-outline" size={14} color={PRIMARY} />
                      <Text style={styles.viewBtnText}>View Details</Text>
                    </TouchableOpacity>
                    {item.status === "Pending" && (
                      <>
                        <TouchableOpacity style={styles.approveBtn} onPress={() => handleAccept(item.id)}>
                          <Ionicons name="checkmark" size={14} color="#fff" />
                          <Text style={styles.smallBtnText}>Approve</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.rejectBtn} onPress={() => handleDecline(item.id)}>
                          <Ionicons name="close" size={14} color="#fff" />
                          <Text style={styles.smallBtnText}>Reject</Text>
                        </TouchableOpacity>
                      </>
                    )}
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      <Modal visible={rejectingId !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Tolak Pengajuan</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Alasan penolakan..."
              value={rejectionReasonInput}
              onChangeText={setRejectionReasonInput}
              multiline
              numberOfLines={4}
            />
            <View style={styles.modalBtnRow}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setRejectingId(null)}>
                <Text style={styles.cancelBtnText}>Batal</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.confirmBtn} onPress={submitRejection}>
                <Text style={styles.confirmBtnText}>Tolak</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  pageHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontSize: 22, fontWeight: "700", color: TEXT_DARK },
  pageSubtitle: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },
  searchBar: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9",
    marginHorizontal: 20, borderRadius: 14, height: 46, marginTop: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT_DARK, paddingHorizontal: 10 },
  filterScroll: { maxHeight: 44 },
  filterRow: { paddingHorizontal: 20, paddingVertical: 8, gap: 8, alignItems: "center" },
  chip: {
    height: 32, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center",
  },
  chipActive: { backgroundColor: PRIMARY },
  chipText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  chipTextActive: { color: "#fff" },
  card: {
    marginHorizontal: 20, marginTop: 14, backgroundColor: "#fff",
    borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  cardImage: { width: "100%", height: 150, backgroundColor: "#F1F5F9" },
  cardBadge: {
    position: "absolute", top: 12, right: 12,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  cardBadgeText: { fontSize: 11, fontWeight: "700" },
  cardBody: { padding: 14 },
  cardName: { fontSize: 16, fontWeight: "700", color: TEXT_DARK },
  cardSeller: { fontSize: 13, color: "#64748B", marginTop: 2 },
  cardMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  cardMetaText: { fontSize: 12, color: "#64748B", marginLeft: 4 },
  cardPrice: { fontSize: 16, fontWeight: "700", color: "#16A34A", marginTop: 8 },
  cardActions: { flexDirection: "row", gap: 8, marginTop: 12 },
  viewBtn: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 10, backgroundColor: "#DBEAFE", gap: 4,
  },
  viewBtnText: { fontSize: 12, fontWeight: "600", color: PRIMARY },
  approveBtn: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 10, backgroundColor: "#16A34A", gap: 4,
  },
  rejectBtn: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 10, backgroundColor: "#EF4444", gap: 4,
  },
  smallBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  emptyState: { alignItems: "center", marginTop: 48 },
  emptyText: { fontSize: 14, color: "#64748B", marginTop: 12 },
  detailHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center",
  },
  detailHeaderTitle: { fontSize: 17, fontWeight: "700", color: TEXT_DARK },
  galleryImage: { width: 320, height: 200, marginHorizontal: 4, borderRadius: 12 },
  detailTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  detailTitle: { fontSize: 20, fontWeight: "700", color: TEXT_DARK, flex: 1, marginRight: 8 },
  detailStatus: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  detailStatusText: { fontSize: 12, fontWeight: "700" },
  detailPrice: { fontSize: 18, fontWeight: "700", color: "#16A34A", marginTop: 8 },
  rejectionBox: {
    backgroundColor: "#FEE2E2", padding: 12, borderRadius: 10, marginTop: 12,
    borderWidth: 0.5, borderColor: "#FCA5A5",
  },
  rejectionTitle: { fontSize: 12, color: DANGER, fontWeight: "800" },
  rejectionText: { fontSize: 12, color: "#991B1B", marginTop: 2 },
  infoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 16 },
  infoItem: {
    flex: 1, minWidth: 140, backgroundColor: "#F8FAFC",
    borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#E2E8F0",
  },
  infoLabel: { fontSize: 11, color: "#64748B", marginTop: 4 },
  infoValue: { fontSize: 13, fontWeight: "600", color: TEXT_DARK, marginTop: 2 },
  sectionLabel: { fontSize: 15, fontWeight: "700", color: TEXT_DARK, marginTop: 20 },
  descText: { fontSize: 14, color: "#64748B", lineHeight: 20, marginTop: 8 },
  facilitiesRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 },
  facilityChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#DBEAFE", paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8,
  },
  facilityText: { fontSize: 12, fontWeight: "600", color: PRIMARY },
  mapPlaceholder: {
    backgroundColor: "#F8FAFC", borderRadius: 14, padding: 24,
    alignItems: "center", marginTop: 8, borderWidth: 1, borderColor: "#E2E8F0",
  },
  mapCoordText: { fontSize: 13, fontWeight: "600", color: TEXT_DARK, marginTop: 8 },
  detailActions: { flexDirection: "row", gap: 12, marginTop: 24 },
  detailApproveBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#16A34A", paddingVertical: 14, borderRadius: 14, gap: 6,
  },
  detailApproveText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  detailRejectBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#EF4444", paddingVertical: 14, borderRadius: 14, gap: 6,
  },
  detailRejectText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "center", alignItems: "center" },
  modalCard: { width: "85%", backgroundColor: "#FFF", borderRadius: 16, padding: 20 },
  modalTitle: { fontSize: 16, fontWeight: "800", color: TEXT_DARK, marginBottom: 16 },
  modalInput: {
    borderWidth: 0.5, borderColor: "#CBD5E1", borderRadius: 10, padding: 10,
    fontSize: 13, color: TEXT_DARK, backgroundColor: "#F8FAFC", marginBottom: 16,
    height: 80, textAlignVertical: "top",
  },
  modalBtnRow: { flexDirection: "row", gap: 10 },
  cancelBtn: { flex: 1, borderWidth: 0.5, borderColor: "#CBD5E1", borderRadius: 10, paddingVertical: 10, alignItems: "center" },
  cancelBtnText: { fontSize: 13, fontWeight: "600", color: TEXT_SECONDARY },
  confirmBtn: { flex: 1, borderRadius: 10, paddingVertical: 10, alignItems: "center", backgroundColor: DANGER },
  confirmBtnText: { fontSize: 13, fontWeight: "600", color: "#FFF" },
});
