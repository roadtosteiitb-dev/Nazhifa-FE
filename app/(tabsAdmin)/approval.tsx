import { useTranslation } from "react-i18next";
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
  Dimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLands } from "../../contexts/LandContext";

const { width } = Dimensions.get("window");

const PRIMARY = "#2E7D32";
const PRIMARY_LIGHT = "#DBEAFE";
const SUCCESS = "#16A34A";
const WARNING = "#F59E0B";
const DANGER = "#EF4444";
const GRAY_BG = "#F1F5F9";
const TEXT_DARK = "#0F172A";
const TEXT_SECONDARY = "#64748B";

type FilterType = "all" | "pending" | "accepted" | "declined";

export default function ApprovalScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { lands = [], updateLandStatus } = useLands() || {};

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [showCertModal, setShowCertModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  const filtered = useMemo(() => {
    return lands.filter((item) => {
      const matchSearch =
        item.name.toLowerCase().includes(search.toLowerCase()) ||
        (item.owner || "").toLowerCase().includes(search.toLowerCase());
      
      let matchFilter = false;
      if (filter === "all") {
        matchFilter = true;
      } else if (filter === "pending") {
        matchFilter = item.status === "Pending";
      } else if (filter === "accepted") {
        matchFilter = item.status === "Approved";
      } else if (filter === "declined") {
        matchFilter = item.status === "Rejected";
      }
      return matchSearch && matchFilter;
    });
  }, [lands, search, filter]);

  const handleAccept = (id: string) => {
    Alert.alert(t("common.confirm"), t("homeAdmin.approveConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("homeAdmin.approve"),
        onPress: async () => {
          try {
            if (updateLandStatus) await updateLandStatus(id, "Approved");
            if (selectedItem?.id === id) setSelectedItem(null);
          } catch {
            Alert.alert(t("common.failed"), t("admin.approveFailed"));
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
    const reason = rejectionReasonInput.trim() || t("admin.defaultRejectReason");

    try {
      if (updateLandStatus) await updateLandStatus(rejectingId, "Rejected", reason);
      if (selectedItem?.id === rejectingId) setSelectedItem(null);
      setRejectingId(null);
      setRejectionReasonInput("");
      Alert.alert(t("common.success"), t("admin.rejectSuccess"));
    } catch {
      Alert.alert(t("common.failed"), t("admin.rejectFailed"));
    }
  };

  const filters: { label: string; value: FilterType }[] = [
    { label: t("common.all"), value: "all" },
    { label: t("homeAdmin.pending"), value: "pending" },
    { label: t("homeAdmin.approved"), value: "accepted" },
    { label: t("homeAdmin.rejected"), value: "declined" },
  ];

  const getStatusInfo = (status: string) => {
    switch (status) {
      case "Approved": return { bg: "#DCFCE7", text: SUCCESS, label: t("homeAdmin.approved") };
      case "Rejected": return { bg: "#FEE2E2", text: DANGER, label: t("homeAdmin.rejected") };
      default: return { bg: "#FEF3C7", text: "#D97706", label: t("homeAdmin.pending") };
    }
  };

  // ── Detail View ──
  if (selectedItem) {
    const si = selectedItem;
    const currentRealTimeItem = lands.find((l) => l.id === si.id) || si;
    const statusInfo = getStatusInfo(currentRealTimeItem.status);
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
          {/* Header */}
          <View style={styles.detailHeader}>
            <TouchableOpacity onPress={() => setSelectedItem(null)} style={styles.backBtn}>
              <Ionicons name="arrow-back" size={22} color={TEXT_DARK} />
            </TouchableOpacity>
            <Text style={styles.detailHeaderTitle}>{t("admin.approval.detailTitle")}</Text>
            <View style={{ width: 42 }} />
          </View>

          {/* Image */}
          <Image source={{ uri: currentRealTimeItem.image }} style={styles.detailImage} />

          <View style={{ padding: 20 }}>
            {/* Title & Status */}
            <View style={styles.detailTitleRow}>
              <Text style={styles.detailTitle}>{currentRealTimeItem.name}</Text>
              <View style={[styles.detailStatusBadge, { backgroundColor: statusInfo.bg }]}>
                <Text style={[styles.detailStatusText, { color: statusInfo.text }]}>
                  {statusInfo.label}
                </Text>
              </View>
            </View>

            <Text style={styles.detailPrice}>
              Rp {(currentRealTimeItem.price || 0).toLocaleString("id-ID")}
            </Text>

            {/* Rejection Reason display if rejected */}
            {currentRealTimeItem.status === "Rejected" && currentRealTimeItem.rejectionReason && (
              <View style={styles.rejectionReasonBox}>
                <Text style={styles.rejectionReasonTitle}>{t("homeOwner.rejectionReason")}</Text>
                <Text style={styles.rejectionReasonText}>{currentRealTimeItem.rejectionReason}</Text>
              </View>
            )}

            <View style={styles.divider} />

            {/* Information Grid */}
            <Text style={styles.sectionHeader}>{t("admin.approval.generalInfo")}</Text>
            <View style={styles.infoGrid}>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t("admin.approval.submitter")}</Text>
                <Text style={styles.infoValue}>{currentRealTimeItem.owner}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t("productDetail.location")}</Text>
                <Text style={styles.infoValue}>{currentRealTimeItem.location}</Text>
              </View>
              <View style={styles.infoItem}>
                <Text style={styles.infoLabel}>{t("admin.approval.submittedAt")}</Text>
                <Text style={styles.infoValue}>{currentRealTimeItem.createdAt || "2026-07-22"}</Text>
              </View>
            </View>

            <View style={styles.divider} />

            {/* Sertifikat & Berkas Legalitas */}
            <Text style={styles.sectionHeader}>{t("admin.approval.certificateSection")}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", backgroundColor: "#F8FAFC", padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E2E8F0", marginBottom: 16 }}>
              <Image
                source={{ uri: currentRealTimeItem.certificateImage || "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&q=80" }}
                style={{ width: 60, height: 60, borderRadius: 8, marginRight: 12 }}
              />
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 13, fontWeight: "800", color: "#0F172A" }}>
                  {t("admin.approval.ownershipCertificate", { type: currentRealTimeItem.certificate || "SHM" })}
                </Text>
                <Text style={{ fontSize: 11, color: "#64748B", marginTop: 2 }}>
                  {t("admin.approval.uploadedByOwner")}
                </Text>
              </View>
              <TouchableOpacity
                style={{ backgroundColor: "#2E7D32", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 }}
                onPress={() => setShowCertModal(true)}
              >
                <Text style={{ color: "#FFF", fontSize: 11, fontWeight: "800" }}>{t("admin.approval.inspect")}</Text>
              </TouchableOpacity>
            </View>

            {/* Description */}
            <Text style={styles.sectionHeader}>{t("addProperty.description")}</Text>
            <Text style={styles.descriptionText}>{currentRealTimeItem.description}</Text>

            {/* Action Buttons if Pending */}
            {currentRealTimeItem.status === "Pending" && (
              <View style={styles.actionRow}>
                <TouchableOpacity
                  style={[styles.btnDecline, { borderColor: DANGER }]}
                  onPress={() => handleDecline(currentRealTimeItem.id)}
                >
                  <Ionicons name="close-circle-outline" size={18} color={DANGER} />
                  <Text style={[styles.btnText, { color: DANGER }]}>{t("homeAdmin.reject")}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.btnAccept, { backgroundColor: SUCCESS }]}
                  onPress={() => handleAccept(currentRealTimeItem.id)}
                >
                  <Ionicons name="checkmark-circle-outline" size={18} color="#fff" />
                  <Text style={[styles.btnText, { color: "#fff" }]}>{t("homeAdmin.approve")}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </ScrollView>

        {/* ── Rejection Reason Modal inside Detail View ── */}
        <Modal visible={rejectingId !== null} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={[styles.modalIconWrap, { backgroundColor: "#EF444415" }]}>
                  <Ionicons name="close-circle" size={22} color="#EF4444" />
                </View>
                <Text style={styles.modalTitle}>{t("admin.rejectSubmission")}</Text>
              </View>

              <Text style={styles.fieldLabel}>{t("admin.rejectionReason")}</Text>
              <TextInput
                style={[styles.modalInput, { height: 80, textAlignVertical: "top" }]}
                placeholder={t("admin.rejectionPlaceholder")}
                value={rejectionReasonInput}
                onChangeText={setRejectionReasonInput}
                multiline
                numberOfLines={4}
              />

              <View style={styles.modalBtnRow}>
                <TouchableOpacity
                  style={styles.cancelBtn}
                  onPress={() => setRejectingId(null)}
                >
                  <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.confirmBtn, { backgroundColor: "#EF4444" }]}
                  onPress={submitRejection}
                >
                  <Text style={styles.confirmBtnText}>{t("homeAdmin.reject")}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* ── Modal Inspeksi Sertifikat ── */}
        <Modal visible={showCertModal} transparent animationType="fade">
          <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.9)", justifyContent: "center", alignItems: "center", padding: 20 }}>
            <TouchableOpacity style={{ position: "absolute", top: 40, right: 20, zIndex: 10, padding: 8 }} onPress={() => setShowCertModal(false)}>
              <Ionicons name="close-circle" size={36} color="#FFF" />
            </TouchableOpacity>
            <Text style={{ color: "#FFF", fontSize: 16, fontWeight: "800", marginBottom: 16 }}>{t("admin.approval.inspectTitle")}</Text>
            <Image
              source={{ uri: currentRealTimeItem?.certificateImage || "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&q=80" }}
              style={{ width: "100%", height: "70%", borderRadius: 12 }}
              resizeMode="contain"
            />
          </View>
        </Modal>
      </SafeAreaView>
    );
  }

  // ── List View ──
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="chevron-back" size={26} color={TEXT_DARK} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t("admin.propertyApproval")}</Text>
        <View style={{ width: 32 }} />
      </View>

      {/* Search and Filters */}
      <View style={styles.filterSection}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={TEXT_SECONDARY} />
          <TextInput
            placeholder={t("admin.approval.search")}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
          />
        </View>

        {/* Filter Scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScroll}>
          {filters.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.chip, filter === f.value && styles.chipActive]}
              onPress={() => setFilter(f.value)}
            >
              <Text style={[styles.chipText, filter === f.value && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Items list */}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 80 }}>
        {filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>{t("admin.approval.empty")}</Text>
          </View>
        ) : (
          filtered.map((item) => {
            const statusInfo = getStatusInfo(item.status || "Pending");
            return (
              <TouchableOpacity
                key={item.id}
                style={styles.card}
                activeOpacity={0.9}
                onPress={() => setSelectedItem(item)}
              >
                <Image source={{ uri: item.image }} style={styles.cardImage} />
                <View style={styles.cardInfo}>
                  <Text style={styles.cardTitle}>{item.name}</Text>
                  <Text style={styles.cardOwner}>Oleh: {item.owner}</Text>
                  <Text style={styles.cardPrice}>
                    Rp {(item.price || 0).toLocaleString("id-ID")}
                  </Text>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 8 }}>
                    <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                      <Text style={[styles.statusText, { color: statusInfo.text }]}>
                        {statusInfo.label}
                      </Text>
                    </View>
                    <Text style={styles.cardDate}>{item.createdAt || "2026-07-22"}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>

      {/* ── Rejection Reason Modal inside List View ── */}
      <Modal visible={rejectingId !== null} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={[styles.modalIconWrap, { backgroundColor: "#EF444415" }]}>
                <Ionicons name="close-circle" size={22} color="#EF4444" />
              </View>
              <Text style={styles.modalTitle}>{t("admin.rejectSubmission")}</Text>
            </View>

            <Text style={styles.fieldLabel}>{t("admin.rejectionReason")}</Text>
            <TextInput
              style={[styles.modalInput, { height: 80, textAlignVertical: "top" }]}
              placeholder={t("admin.rejectionPlaceholder")}
              value={rejectionReasonInput}
              onChangeText={setRejectionReasonInput}
              multiline
              numberOfLines={4}
            />

            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setRejectingId(null)}
              >
                <Text style={styles.cancelBtnText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, { backgroundColor: "#EF4444" }]}
                onPress={submitRejection}
              >
                <Text style={styles.confirmBtnText}>{t("homeAdmin.reject")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFF" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
  },
  backBtn: { padding: 4 },
  headerTitle: { fontSize: 18, fontWeight: "800", color: TEXT_DARK },
  filterSection: { padding: 16 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#F8FAFC",
    borderWidth: 0.5,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 44,
    gap: 8,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT_DARK, height: "100%", padding: 0 },
  filterScroll: { flexDirection: "row", marginTop: 12 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: "#F1F5F9",
    marginRight: 8,
  },
  chipActive: { backgroundColor: PRIMARY },
  chipText: { fontSize: 12, color: TEXT_SECONDARY, fontWeight: "600" },
  chipTextActive: { color: "#FFF" },

  emptyState: { alignItems: "center", justifyContent: "center", marginTop: 80, paddingHorizontal: 40 },
  emptyText: { fontSize: 14, color: TEXT_SECONDARY, marginTop: 12, fontWeight: "500" },

  // List Cards
  card: {
    marginHorizontal: 16,
    marginBottom: 16,
    backgroundColor: "#F8FAFC",
    borderWidth: 0.5,
    borderColor: "#E2E8F0",
    borderRadius: 16,
    overflow: "hidden",
    flexDirection: "row",
  },
  cardImage: { width: 110, height: 110 },
  cardInfo: { flex: 1, padding: 12, justifyContent: "space-between" },
  cardTitle: { fontSize: 14, fontWeight: "800", color: TEXT_DARK },
  cardOwner: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 2 },
  cardPrice: { fontSize: 14, fontWeight: "900", color: PRIMARY, marginTop: 4 },
  cardDate: { fontSize: 10, color: TEXT_SECONDARY },
  statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  statusText: { fontSize: 10, fontWeight: "800" },

  // Detail View Styles
  detailHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: "#FFF",
    borderBottomWidth: 0.5,
    borderBottomColor: "#E2E8F0",
  },
  detailHeaderTitle: { fontSize: 16, fontWeight: "800", color: TEXT_DARK },
  detailImage: { width: "100%", height: 230 },
  detailTitleRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", marginTop: 8 },
  detailTitle: { fontSize: 20, fontWeight: "900", color: TEXT_DARK, flex: 1, marginRight: 12 },
  detailStatusBadge: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8 },
  detailStatusText: { fontSize: 11, fontWeight: "800" },
  detailPrice: { fontSize: 22, fontWeight: "900", color: PRIMARY, marginTop: 4 },
  rejectionReasonBox: {
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 10,
    marginTop: 12,
    borderWidth: 0.5,
    borderColor: "#FCA5A5",
  },
  rejectionReasonTitle: { fontSize: 12, color: DANGER, fontWeight: "800" },
  rejectionReasonText: { fontSize: 12, color: "#991B1B", marginTop: 2 },
  divider: { height: 0.5, backgroundColor: "#E2E8F0", marginVertical: 16 },
  sectionHeader: { fontSize: 14, fontWeight: "800", color: TEXT_DARK, marginBottom: 8 },
  infoGrid: { gap: 10 },
  infoItem: { flexDirection: "row", justifyContent: "space-between" },
  infoLabel: { fontSize: 13, color: TEXT_SECONDARY },
  infoValue: { fontSize: 13, fontWeight: "700", color: TEXT_DARK, textAlign: "right", flex: 1, marginLeft: 12 },
  descriptionText: { fontSize: 13, color: TEXT_SECONDARY, lineHeight: 20 },

  actionRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  btnDecline: {
    flex: 1,
    flexDirection: "row",
    borderWidth: 1.5,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  btnAccept: {
    flex: 1.5,
    flexDirection: "row",
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  btnText: { fontSize: 14, fontWeight: "700" },

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalCard: {
    width: "85%",
    backgroundColor: "#FFF",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 16 },
  modalIconWrap: { width: 36, height: 36, borderRadius: 18, alignItems: "center", justifyContent: "center" },
  modalTitle: { fontSize: 16, fontWeight: "800", color: TEXT_DARK },
  fieldLabel: { fontSize: 12, fontWeight: "600", color: TEXT_SECONDARY, marginBottom: 6 },
  modalInput: {
    borderWidth: 0.5,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    padding: 10,
    fontSize: 13,
    color: TEXT_DARK,
    backgroundColor: "#F8FAFC",
    marginBottom: 16,
  },
  modalBtnRow: { flexDirection: "row", gap: 10 },
  cancelBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  cancelBtnText: { fontSize: 13, fontWeight: "600", color: TEXT_SECONDARY },
  confirmBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  confirmBtnText: { fontSize: 13, fontWeight: "600", color: "#FFF" },
});
