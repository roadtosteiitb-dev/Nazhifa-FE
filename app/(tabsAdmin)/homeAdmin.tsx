import React, { useCallback, useEffect, useState, useMemo } from "react";
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
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useTranslation } from "react-i18next";
import { useLands, Land } from "../../contexts/LandContext";
import { fetchUsers, ApiUser } from "../../services/UserService";
import { fetchComplaints, ApiComplaint } from "../../services/ComplaintService";
import { exportReport, toDateStr, ExportFormat, ReportKind } from "../../utils/reportExport";

const { width } = Dimensions.get("window");

// Inclusive date-range check on an ISO/date string; rows without a date are excluded
const inRange = (value: string | null | undefined, start: string, end: string) => {
  if (!value) return false;
  const day = value.slice(0, 10);
  return (!start || day >= start) && (!end || day <= end);
};
const CARD_WIDTH = (width - 52) / 2;

const PRIMARY = "#2E7D32";
const PRIMARY_LIGHT = "#DBEAFE";
const SUCCESS = "#16A34A";
const WARNING = "#F59E0B";
const DANGER = "#EF4444";
const GRAY_BG = "#F1F5F9";
const GRAY_CARD = "#F8FAFC";
const TEXT_DARK = "#0F172A";
const TEXT_SECONDARY = "#64748B";

type FilterType = "all" | "pending" | "accepted" | "declined";
type ReportType = "property" | "verification" | "user" | "complaint";

const reportTypeLabels: Record<ReportType, (t: any) => string> = {
  property: (t) => t("homeAdmin.propertyReport"),
  verification: (t) => t("homeAdmin.verificationReport"),
  user: (t) => t("homeAdmin.userReport"),
  complaint: (t) => t("homeAdmin.complaintReport"),
};

export default function HomeAdmin() {
  const router = useRouter();
  const { user, logout } = useAuth();
  const { t } = useTranslation();
  const { lands = [], updateLandStatus, refreshLands } = useLands();

  // Real data for dashboard statistics
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [complaints, setComplaints] = useState<ApiComplaint[]>([]);
  const [statsLoaded, setStatsLoaded] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const loadStats = useCallback(async () => {
    const [usersRes, complaintsRes] = await Promise.allSettled([
      fetchUsers(),
      fetchComplaints(),
      refreshLands(),
    ]);
    if (usersRes.status === "fulfilled") setUsers(usersRes.value);
    else console.warn("❌ Gagal memuat data pengguna:", usersRes.reason);
    if (complaintsRes.status === "fulfilled") setComplaints(complaintsRes.value);
    else console.warn("❌ Gagal memuat data keluhan:", complaintsRes.reason);
    setStatsLoaded(true);
  }, [refreshLands]);

  // Reload every time the dashboard tab gains focus
  useFocusEffect(
    useCallback(() => {
      loadStats();
    }, [loadStats])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await loadStats();
    setRefreshing(false);
  };
  
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<FilterType>("all");
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectionReasonInput, setRejectionReasonInput] = useState("");

  const pendingCount = lands.filter((l) => l.status === "Pending").length;
  const totalProperties = lands.length;
  const totalUsers = users.length;
  const totalReports = complaints.length;

  const stats = [
    { label: t("homeAdmin.totalProperties"), value: totalProperties, icon: "business-outline" as const, color: PRIMARY },
    { label: t("homeAdmin.registeredUsers"), value: statsLoaded ? totalUsers : "…", icon: "people-outline" as const, color: "#8B5CF6" },
    { label: t("homeAdmin.pendingVerification"), value: pendingCount, icon: "time-outline" as const, color: WARNING },
    { label: t("homeAdmin.reportsComplaints"), value: statsLoaded ? totalReports : "…", icon: "document-text-outline" as const, color: DANGER },
  ];

  const quickActions = [
    { label: t("admin.propertyApproval"), icon: "checkmark-circle" as const, color: PRIMARY, route: "/(tabsAdmin)/approval" },
    { label: t("homeAdmin.userManagement"), icon: "people" as const, color: "#8B5CF6", route: "/(tabsAdmin)/users" },
    { label: t("homeAdmin.complaintManagement"), icon: "alert-circle" as const, color: WARNING, route: "/(tabsAdmin)/complaints" },
    { label: t("homeAdmin.spatialData"), icon: "map" as const, color: "#0891B2", route: "/(tabsAdmin)/spatial" },
    { label: t("homeAdmin.generateReport"), icon: "bar-chart" as const, color: DANGER, route: "/(tabsAdmin)/report" },
  ];

  const filters: { label: string; value: FilterType }[] = [
    { label: t("homeAdmin.all"), value: "all" },
    { label: t("homeAdmin.pending"), value: "pending" },
    { label: t("homeAdmin.approved"), value: "accepted" },
    { label: t("homeAdmin.rejected"), value: "declined" },
  ];

  const pendingItems = useMemo(() => {
    return lands
      .filter((l) => {
        const matchSearch =
          l.name.toLowerCase().includes(search.toLowerCase()) ||
          (l.owner || "").toLowerCase().includes(search.toLowerCase());
        
        let matchFilter = false;
        if (activeFilter === "all") {
          matchFilter = l.status === "Pending";
        } else if (activeFilter === "pending") {
          matchFilter = l.status === "Pending";
        } else if (activeFilter === "accepted") {
          matchFilter = l.status === "Approved";
        } else if (activeFilter === "declined") {
          matchFilter = l.status === "Rejected";
        }
        return matchSearch && matchFilter;
      })
      .slice(0, 3);
  }, [lands, search, activeFilter]);
 
  // Report states
  const [showReportModal, setShowReportModal] = useState(false);
  const [showResultModal, setShowResultModal] = useState(false);
  const [selectedReportType, setSelectedReportType] = useState<ReportType>("verification");
  // Default range: first day of this month → today
  const [startDate, setStartDate] = useState(() => {
    const now = new Date();
    return toDateStr(new Date(now.getFullYear(), now.getMonth(), 1));
  });
  const [endDate, setEndDate] = useState(() => toDateStr(new Date()));
  const [showDropdown, setShowDropdown] = useState(false);
  const [reportData, setReportData] = useState<{ title: string; rows: { label: string; value: number; color: string }[] }>({
    title: "",
    rows: [],
  });

  const handleAccept = (id: string) => {
    const targetLand = lands.find((l) => l.id === id);
    if (!targetLand) return;

    Alert.alert(t("homeAdmin.confirm"), t("homeAdmin.approveConfirm"), [
      { text: t("homeAdmin.cancel"), style: "cancel" },
      {
        text: t("homeAdmin.approve"),
        onPress: async () => {
          try {
            await updateLandStatus(id, "Approved");
          } catch (error: any) {
            Alert.alert(t("common.failed"), error.response?.data?.message || t("admin.approveFailed"));
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
      await updateLandStatus(rejectingId, "Rejected", reason);
      setRejectingId(null);
      setRejectionReasonInput("");
      Alert.alert(t("common.success"), t("admin.rejectSuccess"));
    } catch (error: any) {
      Alert.alert(t("common.failed"), error.response?.data?.message || t("admin.rejectFailed"));
    }
  };

  // Generate Report handler
  const handleGenerateReport = () => {
    if (startDate && endDate && startDate > endDate) {
      Alert.alert(t("common.warning"), t("report.startAfterEnd"));
      return;
    }

    const rLands = lands.filter((l) => inRange(l.createdAt, startDate, endDate));
    const rUsers = users.filter((u) => inRange(u.joinDate, startDate, endDate));
    const rComplaints = complaints.filter((c) => inRange(c.date, startDate, endDate));

    const pending = rLands.filter((l) => l.status === "Pending").length;
    const accepted = rLands.filter((l) => l.status === "Approved").length;
    const rejected = rLands.filter((l) => l.status === "Rejected").length;

    let data: { title: string; rows: { label: string; value: number; color: string }[] } = {
      title: "",
      rows: [],
    };

    switch (selectedReportType) {
      case "property":
        data = {
          title: t("homeAdmin.propertyReport"),
          rows: [
            { label: t("homeAdmin.totalProperties"), value: rLands.length, color: PRIMARY },
            { label: t("homeAdmin.approvedProperties"), value: accepted, color: SUCCESS },
            { label: t("homeAdmin.pendingVerification"), value: pending, color: WARNING },
            { label: t("homeAdmin.rejectedProperties"), value: rejected, color: DANGER },
          ],
        };
        break;
      case "verification":
        data = {
          title: t("homeAdmin.verificationReport"),
          rows: [
            { label: t("homeAdmin.totalProperties"), value: rLands.length, color: PRIMARY },
            { label: t("homeAdmin.approved"), value: accepted, color: SUCCESS },
            { label: t("homeAdmin.pending"), value: pending, color: WARNING },
            { label: t("homeAdmin.rejected"), value: rejected, color: DANGER },
          ],
        };
        break;
      case "user":
        data = {
          title: t("homeAdmin.userReport"),
          rows: [
            { label: t("homeAdmin.totalRegisteredUsers"), value: rUsers.length, color: PRIMARY },
            { label: t("homeAdmin.activeUsers"), value: rUsers.filter((u) => u.status === "active").length, color: SUCCESS },
            { label: t("homeAdmin.inactiveUsers"), value: rUsers.filter((u) => u.status === "inactive").length, color: DANGER },
            { label: t("homeAdmin.propertyOwners"), value: rUsers.filter((u) => u.role === "owner").length, color: "#8B5CF6" },
            { label: t("homeAdmin.buyers"), value: rUsers.filter((u) => u.role === "buyer").length, color: "#0891B2" },
          ],
        };
        break;
      case "complaint":
        data = {
          title: t("homeAdmin.complaintReport"),
          rows: [
            { label: t("homeAdmin.totalComplaints"), value: rComplaints.length, color: PRIMARY },
            { label: t("homeAdmin.open"), value: rComplaints.filter((c) => c.status === "open").length, color: WARNING },
            { label: t("homeAdmin.inProgress"), value: rComplaints.filter((c) => c.status === "in_progress").length, color: "#0891B2" },
            { label: t("homeAdmin.resolved"), value: rComplaints.filter((c) => c.status === "resolved").length, color: SUCCESS },
          ],
        };
        break;
    }

    setReportData(data);
    setShowReportModal(false);
    setShowResultModal(true);
  };

  const [downloading, setDownloading] = useState<ExportFormat | null>(null);

  const REPORT_KIND: Record<ReportType, ReportKind> = {
    property: "property",
    verification: "verification",
    user: "users",
    complaint: "complaints",
  };

  const handleDownload = async (format: ExportFormat) => {
    if (downloading) return;
    const [sy, sm, sd] = startDate.split("-").map(Number);
    const [ey, em, ed] = endDate.split("-").map(Number);
    const range = { start: new Date(sy, sm - 1, sd), end: new Date(ey, em - 1, ed) };
    if (isNaN(range.start.getTime()) || isNaN(range.end.getTime())) {
      Alert.alert(t("common.warning"), t("report.dateFormat"));
      return;
    }
    try {
      setDownloading(format);
      const result = await exportReport(REPORT_KIND[selectedReportType], format, range, { lands, users, complaints });
      if (result.status === "saved") {
        Alert.alert(t("homeAdmin.success"), t("report.savedAs", { file: result.fileName }));
      } else if (result.status === "cancelled") {
        Alert.alert(t("report.cancelledTitle"), t("report.cancelled"));
      }
    } catch (error: any) {
      console.error("❌ Export report error:", error);
      Alert.alert(t("common.failed"), error?.message || t("report.failed"));
    } finally {
      setDownloading(null);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={styles.greeting}>{t("homeAdmin.greeting")}</Text>
            <Text style={styles.headerSubtitle}>
              {t("homeAdmin.subtitle")}
            </Text>
          </View>
          <View style={styles.headerRight}>
            <TouchableOpacity style={styles.iconBtn}>
              <Ionicons name="notifications-outline" size={22} color={TEXT_DARK} />
              {pendingCount > 0 && (
                <View style={styles.notifBadge}>
                  <Text style={styles.notifBadgeText}>{pendingCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.avatar} onPress={() => setShowProfileModal(true)} activeOpacity={0.7}>
              <Ionicons name="person" size={20} color="#fff" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Persetujuan Properti Summary Card ── */}
        <View style={styles.approvalSummaryCard}>
          <Text style={styles.approvalSummaryTitle}>{t("admin.propertyApproval")}</Text>
          <View style={styles.approvalSummaryRow}>
            {/* Pending Card */}
            <TouchableOpacity 
              style={[styles.approvalSubCard, { borderColor: "#F59E0B" }]}
              onPress={() => router.push("/(tabsAdmin)/approval" as any)}
              activeOpacity={0.8}
            >
              <View style={[styles.approvalIconWrap, { backgroundColor: "#F59E0B15" }]}>
                <Ionicons name="time" size={18} color="#F59E0B" />
              </View>
              <Text style={styles.approvalCount}>{lands.filter((l) => l.status === "Pending").length}</Text>
              <Text style={styles.approvalLabel}>{t("homeAdmin.pending")}</Text>
            </TouchableOpacity>

            {/* Approved Card */}
            <View style={[styles.approvalSubCard, { borderColor: "#16A34A" }]}>
              <View style={[styles.approvalIconWrap, { backgroundColor: "#16A34A15" }]}>
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
              </View>
              <Text style={styles.approvalCount}>{lands.filter((l) => l.status === "Approved").length}</Text>
              <Text style={styles.approvalLabel}>{t("homeAdmin.approved")}</Text>
            </View>

            {/* Rejected Card */}
            <View style={[styles.approvalSubCard, { borderColor: "#EF4444" }]}>
              <View style={[styles.approvalIconWrap, { backgroundColor: "#EF444415" }]}>
                <Ionicons name="close-circle" size={18} color="#EF4444" />
              </View>
              <Text style={styles.approvalCount}>{lands.filter((l) => l.status === "Rejected").length}</Text>
              <Text style={styles.approvalLabel}>{t("homeAdmin.rejected")}</Text>
            </View>
          </View>
        </View>

        {/* ── Stats ── */}
        <View style={styles.statsGrid}>
          {stats.map((s, i) => (
            <View key={i} style={styles.statCard}>
              <View style={[styles.statIconWrap, { backgroundColor: s.color + "15" }]}>
                <Ionicons name={s.icon} size={22} color={s.color} />
              </View>
              <Text style={styles.statValue}>{s.value}</Text>
              <Text style={styles.statLabel} numberOfLines={2}>{s.label}</Text>
            </View>
          ))}
        </View>

        {/* ── Quick Actions ── */}
        <Text style={styles.sectionTitle}>{t("homeAdmin.quickMenu")}</Text>
        <View style={styles.actionsGrid}>
          {quickActions.map((a, i) => (
            <TouchableOpacity
              key={i}
              style={styles.actionItem}
              onPress={() => router.push(a.route as any)}
            >
              <View style={[styles.actionIconCircle, { backgroundColor: a.color + "15" }]}>
                <Ionicons name={a.icon} size={26} color={a.color} />
              </View>
              <Text style={styles.actionLabel}>{a.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Pending Verification Section ── */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t("homeAdmin.pendingVerification")}</Text>
          <TouchableOpacity onPress={() => router.push("/(tabsAdmin)/verification" as any)}>
            <Text style={styles.seeAll}>{t("homeAdmin.seeAll")}</Text>
          </TouchableOpacity>
        </View>

        {/* Search */}
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={18} color={TEXT_SECONDARY} style={{ marginLeft: 12 }} />
          <TextInput
            placeholder={t("homeAdmin.searchProperties")}
            value={search}
            onChangeText={setSearch}
            style={styles.searchInput}
            placeholderTextColor={TEXT_SECONDARY}
          />
        </View>

        {/* Filter Chips */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
          style={styles.filterScroll}
        >
          {filters.map((f) => (
            <TouchableOpacity
              key={f.value}
              style={[styles.chip, activeFilter === f.value && styles.chipActive]}
              onPress={() => setActiveFilter(f.value)}
              activeOpacity={0.7}
            >
              <Text style={[styles.chipText, activeFilter === f.value && styles.chipTextActive]}>
                {f.label}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {pendingItems.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="checkmark-done-circle" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>{t("homeAdmin.noPending")}</Text>
          </View>
        ) : (
          pendingItems.map((item: Land) => (
            <View key={item.id} style={styles.propertyCard}>
              <Image source={{ uri: item.image }} style={styles.propertyImage} />
              <View style={styles.pendingBadge}>
                <Ionicons name="time-outline" size={10} color="#D97706" />
                <Text style={styles.pendingBadgeText}>{t("homeAdmin.pendingStatus")}</Text>
              </View>

              <View style={styles.propertyInfo}>
                <Text style={styles.propertyName}>{item.name}</Text>
                <Text style={styles.propertySeller}>{t("homeAdmin.bySeller")} {item.owner}</Text>
                <View style={styles.propertyMeta}>
                  <Ionicons name="location-outline" size={13} color={TEXT_SECONDARY} />
                  <Text style={styles.propertyLocation}>{item.location}</Text>
                </View>
                <View style={styles.propertyMeta}>
                  <Ionicons name="calendar-outline" size={13} color={TEXT_SECONDARY} />
                  <Text style={styles.propertyLocation}>{t("homeAdmin.submitted")}: {item.createdAt || "2026-07-22"}</Text>
                </View>
                <Text style={styles.propertyPrice}>
                  Rp{(item.price || 0).toLocaleString("id-ID")}
                </Text>

                <View style={styles.actionBtnRow}>
                  <TouchableOpacity style={styles.detailBtn}>
                    <Ionicons name="eye-outline" size={14} color={PRIMARY} />
                    <Text style={styles.detailBtnText}>{t("homeAdmin.details")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.approveBtn} onPress={() => handleAccept(item.id)}>
                    <Ionicons name="checkmark-circle-outline" size={14} color="#fff" />
                    <Text style={styles.approveBtnText}>{t("homeAdmin.approve")}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.rejectBtn} onPress={() => handleDecline(item.id)}>
                    <Ionicons name="close-circle-outline" size={14} color="#fff" />
                    <Text style={styles.rejectBtnText}>{t("homeAdmin.reject")}</Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))
        )}
      </ScrollView>

      {/* ── FAB ── */}
      <TouchableOpacity style={styles.fab} activeOpacity={0.85} onPress={() => setShowReportModal(true)}>
        <Ionicons name="document-text" size={22} color="#fff" />
        <Text style={styles.fabText}>{t("homeAdmin.generateReportBtn")}</Text>
      </TouchableOpacity>

      {/* ── Report Config Modal ── */}
      <Modal visible={showReportModal} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Ionicons name="bar-chart" size={22} color={PRIMARY} />
              </View>
              <Text style={styles.modalTitle}>{t("homeAdmin.generateReportBtn")}</Text>
            </View>

            {/* Report Type */}
            <Text style={styles.fieldLabel}>{t("homeAdmin.reportType")}</Text>
            <TouchableOpacity
              style={styles.dropdownBtn}
              onPress={() => setShowDropdown(!showDropdown)}
              activeOpacity={0.7}
            >
              <Text style={styles.dropdownText}>{reportTypeLabels[selectedReportType](t)}</Text>
              <Ionicons name={showDropdown ? "chevron-up" : "chevron-down"} size={18} color={TEXT_SECONDARY} />
            </TouchableOpacity>
            {showDropdown && (
              <View style={styles.dropdownList}>
                {(Object.keys(reportTypeLabels) as ReportType[]).map((key) => (
                  <TouchableOpacity
                    key={key}
                    style={[
                      styles.dropdownItem,
                      selectedReportType === key && styles.dropdownItemActive,
                    ]}
                    onPress={() => {
                      setSelectedReportType(key);
                      setShowDropdown(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.dropdownItemText,
                        selectedReportType === key && styles.dropdownItemTextActive,
                      ]}
                    >
                      {reportTypeLabels[key](t)}
                    </Text>
                    {selectedReportType === key && (
                      <Ionicons name="checkmark" size={16} color={PRIMARY} />
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {/* Date Range */}
            <Text style={styles.fieldLabel}>{t("homeAdmin.dateRange")}</Text>
            <View style={styles.dateRow}>
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>{t("homeAdmin.startDate")}</Text>
                <TextInput
                  style={styles.dateInput}
                  value={startDate}
                  onChangeText={setStartDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94A3B8"
                />
              </View>
              <View style={styles.dateField}>
                <Text style={styles.dateFieldLabel}>{t("homeAdmin.endDate")}</Text>
                <TextInput
                  style={styles.dateInput}
                  value={endDate}
                  onChangeText={setEndDate}
                  placeholder="YYYY-MM-DD"
                  placeholderTextColor="#94A3B8"
                />
              </View>
            </View>

            {/* Buttons */}
            <View style={styles.modalBtnRow}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => {
                  setShowReportModal(false);
                  setShowDropdown(false);
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.cancelBtnText}>{t("homeAdmin.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.generateBtn}
                onPress={handleGenerateReport}
                activeOpacity={0.85}
              >
                <Ionicons name="document-text" size={16} color="#fff" />
                <Text style={styles.generateBtnText}>{t("homeAdmin.generate")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Report Result Modal ── */}
      <Modal visible={showResultModal} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.resultCard}>
            {/* Header */}
            <View style={styles.resultHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.resultTitle}>{reportData.title}</Text>
                <Text style={styles.resultDate}>
                  {startDate} — {endDate}
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setShowResultModal(false)}
                style={styles.resultCloseBtn}
              >
                <Ionicons name="close-circle" size={28} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Summary Rows */}
            <ScrollView showsVerticalScrollIndicator={false}>
              {reportData.rows.map((row, i) => (
                <View key={i} style={styles.summaryRow}>
                  <View style={styles.summaryLeft}>
                    <View style={[styles.summaryDot, { backgroundColor: row.color }]} />
                    <Text style={styles.summaryLabel}>{row.label}</Text>
                  </View>
                  <View style={[styles.summaryValueWrap, { backgroundColor: row.color + "12" }]}>
                    <Text style={[styles.summaryValue, { color: row.color }]}>{row.value}</Text>
                  </View>
                </View>
              ))}
            </ScrollView>

            {/* Divider */}
            <View style={styles.divider} />

            {/* Download Buttons */}
            <View style={styles.downloadRow}>
              <TouchableOpacity
                style={styles.downloadPdfBtn}
                onPress={() => handleDownload("pdf")}
                disabled={!!downloading}
                activeOpacity={0.85}
              >
                {downloading === "pdf" ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="document" size={18} color="#fff" />}
                <Text style={styles.downloadBtnText}>{t("homeAdmin.downloadPdf")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.downloadExcelBtn}
                onPress={() => handleDownload("excel")}
                disabled={!!downloading}
                activeOpacity={0.85}
              >
                {downloading === "excel" ? <ActivityIndicator size="small" color="#fff" /> : <Ionicons name="grid" size={18} color="#fff" />}
                <Text style={styles.downloadBtnText}>{t("homeAdmin.downloadExcel")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

{/* ── Profile / Logout Modal ── */}
<Modal visible={showProfileModal} transparent animationType="fade">
  <TouchableOpacity
    style={styles.profileModalOverlay}
    activeOpacity={1}
    onPress={() => setShowProfileModal(false)}
  >
    <View style={styles.profileMenu}>
      {/* Profile Info */}
      <View style={styles.profileMenuHeader}>
        <View style={styles.profileMenuAvatar}>
          <Ionicons name="person" size={28} color="#fff" />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.profileMenuName}>
            {user?.fullName || t("homeAdmin.administrator")}
          </Text>

          <Text style={styles.profileMenuEmail}>
            {user?.email || "admin@lokatani.com"}
          </Text>

          <View style={styles.profileMenuRole}>
            <Ionicons name="shield-checkmark" size={11} color={PRIMARY} />
            <Text style={styles.profileMenuRoleText}>{t("homeAdmin.administrator")}</Text>
          </View>
        </View>
      </View>

      <View style={styles.profileMenuDivider} />

      {/* Logout */}
      <TouchableOpacity
        style={styles.profileMenuItem}
        activeOpacity={0.7}
        onPress={() => {
          setShowProfileModal(false);

          Alert.alert(
            t("homeAdmin.logout"),
            t("homeAdmin.logoutConfirm"),
            [
              {
                text: t("homeAdmin.cancel"),
                style: "cancel",
              },
              {
                text: t("homeAdmin.logout"),
                style: "destructive",
                onPress: () => logout(),
              },
            ]
          );
        }}
      >
        <View
          style={[
            styles.profileMenuIconWrap,
            { backgroundColor: "#FEE2E2" },
          ]}
        >
          <Ionicons
            name="log-out-outline"
            size={18}
            color={DANGER}
          />
        </View>

        <Text
          style={[
            styles.profileMenuLabel,
            { color: DANGER, flex: 1 },
          ]}
        >
          {t("homeAdmin.logout")}
        </Text>

        <Ionicons
          name="chevron-forward"
          size={18}
          color={DANGER}
        />
      </TouchableOpacity>
    </View>
  </TouchableOpacity>
</Modal>

      {/* ── Rejection Reason Modal ── */}
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
                style={styles.rejectionCancelBtn}
                onPress={() => setRejectingId(null)}
              >
                <Text style={styles.rejectionCancelBtnText}>{t("common.cancel")}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.rejectionConfirmBtn, { backgroundColor: "#EF4444" }]}
                onPress={submitRejection}
              >
                <Text style={styles.rejectionConfirmBtnText}>{t("homeAdmin.reject")}</Text>
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

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
  },
  headerLeft: { flex: 1, marginRight: 12 },
  greeting: { fontSize: 22, fontWeight: "700", color: TEXT_DARK },
  headerSubtitle: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 12 },
  iconBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: GRAY_BG, justifyContent: "center", alignItems: "center",
  },
  notifBadge: {
    position: "absolute", top: 4, right: 4,
    backgroundColor: DANGER, width: 17, height: 17, borderRadius: 9,
    justifyContent: "center", alignItems: "center",
  },
  notifBadgeText: { color: "#fff", fontSize: 9, fontWeight: "700" },
  avatar: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center",
  },

  // Stats
  statsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12 },
  statCard: {
    width: CARD_WIDTH, backgroundColor: GRAY_CARD,
    borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E2E8F0",
  },
  statIconWrap: {
    width: 44, height: 44, borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginBottom: 10,
  },
  statValue: { fontSize: 24, fontWeight: "700", color: TEXT_DARK },
  statLabel: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },

  // Quick Actions
  sectionTitle: {
    fontSize: 16, fontWeight: "700", color: TEXT_DARK,
    marginTop: 24, marginBottom: 14, paddingHorizontal: 20,
  },
  actionsGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 12, justifyContent: "center" },
  actionItem: { alignItems: "center", width: 68, marginBottom: 12 },
  actionIconCircle: {
    width: 58, height: 58, borderRadius: 29,
    justifyContent: "center", alignItems: "center", marginBottom: 8,
  },
  actionLabel: {
    fontSize: 10, fontWeight: "600", color: TEXT_DARK, textAlign: "center", lineHeight: 14,
  },

  // Section Header
  sectionHeader: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingHorizontal: 20, marginTop: 24, marginBottom: 12,
  },
  seeAll: { fontSize: 13, fontWeight: "600", color: PRIMARY },

  // Search & Filter Chips
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: GRAY_BG,
    marginHorizontal: 20,
    borderRadius: 12,
    height: 40,
  },
  searchInput: {
    flex: 1,
    fontSize: 13,
    color: TEXT_DARK,
    paddingHorizontal: 8,
  },
  filterScroll: {
    maxHeight: 44,
  },
  filterRow: {
    paddingHorizontal: 20,
    paddingVertical: 8,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    height: 32,
    paddingHorizontal: 14,
    borderRadius: 16,
    backgroundColor: GRAY_BG,
    justifyContent: "center",
    alignItems: "center",
  },
  chipActive: {
    backgroundColor: PRIMARY,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
    color: TEXT_SECONDARY,
  },
  chipTextActive: {
    color: "#fff",
  },

  // Property Card
  propertyCard: {
    marginHorizontal: 20, marginTop: 14, backgroundColor: "#fff",
    borderRadius: 18, borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06, shadowRadius: 8, elevation: 3,
  },
  propertyImage: { width: "100%", height: 150 },
  pendingBadge: {
    position: "absolute", top: 12, right: 12,
    flexDirection: "row", alignItems: "center", gap: 4,
    backgroundColor: "#FEF3C7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  pendingBadgeText: { fontSize: 11, fontWeight: "700", color: "#D97706" },
  propertyInfo: { padding: 14 },
  propertyName: { fontSize: 16, fontWeight: "700", color: TEXT_DARK },
  propertySeller: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 2 },
  propertyMeta: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  propertyLocation: { fontSize: 12, color: TEXT_SECONDARY, marginLeft: 4 },
  propertyPrice: { fontSize: 16, fontWeight: "700", color: SUCCESS, marginTop: 8 },
  actionBtnRow: { flexDirection: "row", gap: 8, marginTop: 12 },
  detailBtn: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 10, backgroundColor: PRIMARY_LIGHT, gap: 4,
  },
  detailBtnText: { fontSize: 12, fontWeight: "600", color: PRIMARY },
  approveBtn: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 10, backgroundColor: SUCCESS, gap: 4,
  },
  approveBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },
  rejectBtn: {
    flexDirection: "row", alignItems: "center", paddingHorizontal: 12,
    paddingVertical: 8, borderRadius: 10, backgroundColor: DANGER, gap: 4,
  },
  rejectBtnText: { fontSize: 12, fontWeight: "600", color: "#fff" },

  // Empty
  emptyState: { alignItems: "center", marginTop: 40 },
  emptyText: { fontSize: 14, color: TEXT_SECONDARY, marginTop: 12 },

  // FAB
  fab: {
    position: "absolute", bottom: 24, alignSelf: "center",
    flexDirection: "row", alignItems: "center", backgroundColor: PRIMARY,
    paddingHorizontal: 24, paddingVertical: 14, borderRadius: 28, gap: 8,
    shadowColor: PRIMARY, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3, shadowRadius: 8, elevation: 6,
  },
  fabText: { color: "#fff", fontSize: 14, fontWeight: "700" },

  // ── Modal Shared ──
  modalOverlay: {
    flex: 1, backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center", alignItems: "center", padding: 24,
  },
  modalCard: {
    width: "100%", backgroundColor: "#fff", borderRadius: 20,
    padding: 24, shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
  },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 20 },
  modalIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: PRIMARY_LIGHT,
    justifyContent: "center", alignItems: "center",
  },
  modalTitle: { fontSize: 18, fontWeight: "700", color: TEXT_DARK },

  fieldLabel: { fontSize: 13, fontWeight: "600", color: TEXT_DARK, marginBottom: 6, marginTop: 14 },

  // Dropdown
  dropdownBtn: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    backgroundColor: GRAY_BG, borderRadius: 12, paddingHorizontal: 14, height: 44,
  },
  dropdownText: { fontSize: 14, color: TEXT_DARK, fontWeight: "500" },
  dropdownList: {
    backgroundColor: "#fff", borderRadius: 12, marginTop: 4,
    borderWidth: 1, borderColor: "#E2E8F0", overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 14, paddingVertical: 12,
  },
  dropdownItemActive: { backgroundColor: "#EFF6FF" },
  dropdownItemText: { fontSize: 14, color: TEXT_DARK },
  dropdownItemTextActive: { color: PRIMARY, fontWeight: "600" },

  // Date
  dateRow: { flexDirection: "row", gap: 12 },
  dateField: { flex: 1 },
  dateFieldLabel: { fontSize: 11, color: TEXT_SECONDARY, marginBottom: 4 },
  dateInput: {
    backgroundColor: GRAY_BG, borderRadius: 10, paddingHorizontal: 12,
    height: 40, fontSize: 13, color: TEXT_DARK,
  },

  // Modal Buttons
  modalBtnRow: { flexDirection: "row", gap: 12, marginTop: 24 },
  cancelBtn: {
    flex: 1, alignItems: "center", justifyContent: "center",
    backgroundColor: GRAY_BG, paddingVertical: 14, borderRadius: 14,
  },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: TEXT_SECONDARY },
  generateBtn: {
    flex: 1.5, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: PRIMARY, paddingVertical: 14, borderRadius: 14, gap: 6,
  },
  generateBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },

  // ── Result Modal ──
  resultCard: {
    width: "100%", backgroundColor: "#fff", borderRadius: 20,
    padding: 24, maxHeight: "80%",
    shadowColor: "#000", shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15, shadowRadius: 16, elevation: 8,
  },
  resultHeader: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between" },
  resultTitle: { fontSize: 18, fontWeight: "700", color: TEXT_DARK },
  resultDate: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },
  resultCloseBtn: { padding: 2 },
  divider: { height: 1, backgroundColor: "#E2E8F0", marginVertical: 16 },

  // Summary
  summaryRow: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingVertical: 10,
  },
  summaryLeft: { flexDirection: "row", alignItems: "center", gap: 10 },
  summaryDot: { width: 10, height: 10, borderRadius: 5 },
  summaryLabel: { fontSize: 14, color: TEXT_DARK },
  summaryValueWrap: { paddingHorizontal: 14, paddingVertical: 4, borderRadius: 8 },
  summaryValue: { fontSize: 16, fontWeight: "700" },

  // Download
  downloadRow: { flexDirection: "row", gap: 12 },
  downloadPdfBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: DANGER, paddingVertical: 14, borderRadius: 14, gap: 6,
  },
  downloadExcelBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: SUCCESS, paddingVertical: 14, borderRadius: 14, gap: 6,
  },
  downloadBtnText: { fontSize: 13, fontWeight: "700", color: "#fff" },

  // Profile Menu Modal
  profileModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-start",
    alignItems: "flex-end",
    paddingTop: 80,
    paddingHorizontal: 16,
  },
  profileMenu: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },
  profileMenuHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  profileMenuAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: PRIMARY,
    justifyContent: "center",
    alignItems: "center",
  },
  profileMenuName: {
    fontSize: 16,
    fontWeight: "700",
    color: TEXT_DARK,
  },
  profileMenuEmail: {
    fontSize: 12,
    color: TEXT_SECONDARY,
    marginTop: 2,
  },
  profileMenuRole: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  profileMenuRoleText: {
    fontSize: 11,
    fontWeight: "600",
    color: PRIMARY,
  },
  profileMenuDivider: {
    height: 1,
    backgroundColor: "#E2E8F0",
    marginVertical: 16,
  },
  profileMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    gap: 12,
  },
  profileMenuIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  profileMenuLabel: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: TEXT_DARK,
  },

  // Property Approval Summary Styles
  approvalSummaryCard: {
    marginHorizontal: 20,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
    marginBottom: 20,
  },
  approvalSummaryTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#0F172A",
    marginBottom: 12,
  },
  approvalSummaryRow: {
    flexDirection: "row",
    gap: 10,
  },
  approvalSubCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    backgroundColor: "#F8FAFC",
  },
  approvalIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  approvalCount: {
    fontSize: 18,
    fontWeight: "900",
    color: "#0F172A",
  },
  approvalLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: "#64748B",
    marginTop: 2,
  },

  // Modal Input Styles for Rejection
  modalInput: {
    borderWidth: 1,
    borderColor: "#E2E8F0",
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: "#0F172A",
    backgroundColor: "#F8FAFC",
    marginBottom: 16,
  },
  rejectionCancelBtn: {
    flex: 1,
    borderWidth: 0.5,
    borderColor: "#CBD5E1",
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  rejectionCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: TEXT_SECONDARY,
  },
  rejectionConfirmBtn: {
    flex: 1,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
  },
  rejectionConfirmBtnText: {
    fontSize: 13,
    fontWeight: "600",
    color: "#FFF",
  },
});
