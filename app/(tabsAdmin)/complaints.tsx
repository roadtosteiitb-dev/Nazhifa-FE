import { useTranslation } from "react-i18next";
import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  fetchComplaints,
  updateComplaintStatus,
  ApiComplaint,
  ComplaintStatus,
} from "../../services/ComplaintService";

const PRIMARY = "#2E7D32";
const DANGER = "#EF4444";
const SUCCESS = "#16A34A";
const TEXT_DARK = "#0F172A";
const TEXT_SECONDARY = "#64748B";

const statusColors: Record<ComplaintStatus, { bg: string; text: string; label: string }> = {
  open: { bg: "#FEF3C7", text: "#D97706", label: "complaint.statuses.open" },
  in_progress: { bg: "#DBEAFE", text: PRIMARY, label: "complaint.statuses.in_progress" },
  resolved: { bg: "#DCFCE7", text: SUCCESS, label: "complaint.statuses.resolved" },
};

const categoryIcons: Record<string, string> = {
  Fraud: "alert-circle",
  Misinformation: "information-circle",
  "Legal Issue": "scale",
  Spam: "trash",
};

type FilterType = "all" | ComplaintStatus;

export default function ComplaintsScreen() {
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState<ApiComplaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selected, setSelected] = useState<ApiComplaint | null>(null);

  const loadComplaints = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchComplaints();
      setComplaints(data);
    } catch (error) {
      console.error("Complaints fetch error:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  const filtered = complaints.filter((c) => {
    const matchSearch =
      (c.reporter || "").toLowerCase().includes(search.toLowerCase()) ||
      (c.property || "").toLowerCase().includes(search.toLowerCase()) ||
      c.category.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === "all" || c.status === filter;
    return matchSearch && matchFilter;
  });

  const changeStatus = (id: string, newStatus: ComplaintStatus) => {
    Alert.alert(t("admin.complaints.updateStatus"), t("admin.complaints.changeTo", { status: t(statusColors[newStatus].label) }), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: async () => {
          try {
            const updated = await updateComplaintStatus(id, newStatus);
            setComplaints((prev) => prev.map((c) => (c.id === id ? updated : c)));
            setSelected(null);
          } catch {
            Alert.alert(t("common.failed"), t("admin.complaints.statusFailed"));
          }
        },
      },
    ]);
  };

  const filters: { label: string; value: FilterType }[] = [
    { label: t("common.all"), value: "all" },
    { label: t("complaint.statuses.open"), value: "open" },
    { label: t("complaint.statuses.in_progress"), value: "in_progress" },
    { label: t("complaint.statuses.resolved"), value: "resolved" },
  ];

  // ── Detail View ──
  if (selected) {
    const c = selected;
    const info = statusColors[c.status];
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setSelected(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={TEXT_DARK} />
          </TouchableOpacity>
          <Text style={styles.detailHeaderTitle}>{t("admin.complaints.details")}</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={styles.detailStatusRow}>
            <View style={[styles.detailStatusBadge, { backgroundColor: info.bg }]}>
              <Text style={[styles.detailStatusText, { color: info.text }]}>{t(info.label)}</Text>
            </View>
            <View style={styles.detailCategoryBadge}>
              <Ionicons name={(categoryIcons[c.category] || "help-circle") as any} size={14} color={DANGER} />
              <Text style={styles.detailCategoryText}>{t(`complaint.categories.${c.category.replace(/\s/g, "")}`, { defaultValue: c.category })}</Text>
            </View>
          </View>

          <Text style={styles.detailDate}>{t("admin.complaints.submitted", { date: c.date || "-" })}</Text>

          <Text style={styles.sectionLabel}>{t("admin.complaints.reporter")}</Text>
          <View style={styles.reporterCard}>
            <View style={styles.reporterAvatar}>
              <Ionicons name="person" size={22} color="#fff" />
            </View>
            <View>
              <Text style={styles.reporterName}>{c.reporter || t("admin.complaints.unknown")}</Text>
              <Text style={styles.reporterSub}>{t("admin.complaints.reported")}</Text>
            </View>
          </View>

          {c.property && (
            <>
              <Text style={styles.sectionLabel}>{t("admin.complaints.relatedProperty")}</Text>
              <View style={styles.propertyRef}>
                <Ionicons name="business-outline" size={18} color={PRIMARY} />
                <Text style={styles.propertyRefText}>{c.property}</Text>
              </View>
            </>
          )}

          <Text style={styles.sectionLabel}>{t("admin.complaints.message")}</Text>
          <View style={styles.messageCard}>
            <Text style={styles.messageText}>{c.message}</Text>
          </View>

          {c.status !== "resolved" && (
            <>
              <Text style={styles.sectionLabel}>{t("admin.complaints.changeStatus")}</Text>
              <View style={styles.statusActions}>
                {c.status === "open" && (
                  <TouchableOpacity
                    style={styles.statusActionBtn}
                    onPress={() => changeStatus(c.id, "in_progress")}
                  >
                    <Ionicons name="time-outline" size={16} color={PRIMARY} />
                    <Text style={[styles.statusActionText, { color: PRIMARY }]}>{t("admin.complaints.markInProgress")}</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity
                  style={[styles.statusActionBtn, { backgroundColor: SUCCESS + "15" }]}
                  onPress={() => changeStatus(c.id, "resolved")}
                >
                  <Ionicons name="checkmark-done" size={16} color={SUCCESS} />
                  <Text style={[styles.statusActionText, { color: SUCCESS }]}>{t("admin.complaints.markResolved")}</Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── List View ──
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>{t("admin.complaints.title")}</Text>
        <Text style={styles.pageSubtitle}>
          {t("admin.complaints.openCount", { count: complaints.filter((c) => c.status === "open").length })}
        </Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={TEXT_SECONDARY} style={{ marginLeft: 14 }} />
        <TextInput
          placeholder={t("admin.complaints.search")}
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

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadComplaints} />}
      >
        {!isLoading && filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="shield-checkmark" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>{t("admin.complaints.empty")}</Text>
          </View>
        ) : (
          filtered.map((c) => {
            const info = statusColors[c.status];
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.complaintCard}
                activeOpacity={0.7}
                onPress={() => setSelected(c)}
              >
                <View style={styles.complaintCardHeader}>
                  <View style={[styles.complaintBadge, { backgroundColor: info.bg }]}>
                    <Text style={[styles.complaintBadgeText, { color: info.text }]}>{t(info.label)}</Text>
                  </View>
                  <Text style={styles.complaintDate}>{c.date || "-"}</Text>
                </View>

                <View style={styles.complaintCardBody}>
                  <View style={styles.complaintCategoryRow}>
                    <Ionicons
                      name={(categoryIcons[c.category] || "help-circle") as any}
                      size={16}
                      color={DANGER}
                    />
                    <Text style={styles.complaintCategory}>{t(`complaint.categories.${c.category.replace(/\s/g, "")}`, { defaultValue: c.category })}</Text>
                  </View>

                  <Text style={styles.complaintReporter}>
                    <Text style={{ fontWeight: "700", color: TEXT_DARK }}>{c.reporter || t("admin.complaints.unknown")}</Text>
                    {" "}reported
                  </Text>
                  {c.property && <Text style={styles.complaintProperty}>{t("admin.complaints.property", { name: c.property })}</Text>}
                  <Text style={styles.complaintPreview} numberOfLines={2}>{c.message}</Text>
                </View>

                <View style={styles.complaintCardFooter}>
                  <Text style={styles.viewDetailsHint}>{t("admin.complaints.tapForDetails")}</Text>
                  <Ionicons name="chevron-forward" size={18} color={TEXT_SECONDARY} />
                </View>
              </TouchableOpacity>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  pageHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontSize: 22, fontWeight: "700", color: TEXT_DARK },
  pageSubtitle: { fontSize: 13, color: "#64748B", marginTop: 4 },

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
  chipActive: { backgroundColor: "#2E7D32" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  chipTextActive: { color: "#fff" },

  complaintCard: {
    marginHorizontal: 20, marginTop: 12, backgroundColor: "#fff",
    borderRadius: 16, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden",
  },
  complaintCardHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 14, paddingTop: 14,
  },
  complaintBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  complaintBadgeText: { fontSize: 11, fontWeight: "700" },
  complaintDate: { fontSize: 12, color: TEXT_SECONDARY },
  complaintCardBody: { padding: 14 },
  complaintCategoryRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  complaintCategory: { fontSize: 14, fontWeight: "700", color: TEXT_DARK },
  complaintReporter: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 6 },
  complaintProperty: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },
  complaintPreview: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 8, lineHeight: 18 },
  complaintCardFooter: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 14, paddingBottom: 12,
  },
  viewDetailsHint: { fontSize: 12, color: PRIMARY, fontWeight: "600" },

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

  detailStatusRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  detailStatusBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
  detailStatusText: { fontSize: 12, fontWeight: "700" },
  detailCategoryBadge: {
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FEE2E2", paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
  },
  detailCategoryText: { fontSize: 12, fontWeight: "600", color: DANGER },
  detailDate: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 12 },

  sectionLabel: { fontSize: 15, fontWeight: "700", color: TEXT_DARK, marginTop: 20 },

  reporterCard: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#E2E8F0", marginTop: 8,
  },
  reporterAvatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center",
  },
  reporterName: { fontSize: 15, fontWeight: "700", color: TEXT_DARK },
  reporterSub: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },

  propertyRef: {
    flexDirection: "row", alignItems: "center", gap: 8,
    backgroundColor: "#F8FAFC", borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: "#E2E8F0", marginTop: 8,
  },
  propertyRefText: { fontSize: 14, fontWeight: "600", color: TEXT_DARK },

  messageCard: {
    backgroundColor: "#F8FAFC", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#E2E8F0", marginTop: 8,
  },
  messageText: { fontSize: 14, color: TEXT_SECONDARY, lineHeight: 22 },

  statusActions: { gap: 10, marginTop: 8 },
  statusActionBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#DBEAFE", paddingVertical: 14, borderRadius: 14, gap: 8,
  },
  statusActionText: { fontWeight: "700", fontSize: 14 },
});
