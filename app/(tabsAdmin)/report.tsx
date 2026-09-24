import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
  Modal,
  Platform,
  ActivityIndicator,
} from "react-native";
import DateTimePicker, { DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useLands } from "../../contexts/LandContext";
import { fetchUsers, ApiUser } from "../../services/UserService";
import { fetchComplaints, ApiComplaint } from "../../services/ComplaintService";
import { exportReport, formatDate, ExportFormat } from "../../utils/reportExport";

const PRIMARY = "#2E7D32";
const SUCCESS = "#16A34A";
const WARNING = "#F59E0B";
const DANGER = "#EF4444";
const GRAY_BG = "#F1F5F9";
const TEXT_DARK = "#0F172A";
const TEXT_SECONDARY = "#64748B";

type ReportType = "property" | "users" | "verification" | "complaints";

const reportTypes: { type: ReportType; label: string; desc: string; icon: string; color: string }[] = [
  { type: "property", label: "Property Data", desc: "All property listings and details", icon: "business-outline", color: PRIMARY },
  { type: "users", label: "User Activity", desc: "Registered users and their activity", icon: "people-outline", color: "#8B5CF6" },
  { type: "verification", label: "Property Verification", desc: "Verification status and history", icon: "shield-checkmark-outline", color: WARNING },
  { type: "complaints", label: "Complaints", desc: "User complaints and resolution status", icon: "alert-circle-outline", color: DANGER },
];

const dateRanges = [
  { label: "Last 7 Days", value: "7d" },
  { label: "Last 30 Days", value: "30d" },
  { label: "Last 3 Months", value: "3m" },
  { label: "Last Year", value: "1y" },
  { label: "Custom Range", value: "custom" },
];

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

// Resolve a preset range key to concrete start/end dates (end = today)
const presetRange = (value: string): { start: Date; end: Date } | null => {
  const end = startOfDay(new Date());
  const start = new Date(end);
  switch (value) {
    case "7d": start.setDate(start.getDate() - 6); break;
    case "30d": start.setDate(start.getDate() - 29); break;
    case "3m": start.setMonth(start.getMonth() - 3); break;
    case "1y": start.setFullYear(start.getFullYear() - 1); break;
    default: return null;
  }
  return { start, end };
};

type PickerTarget = "start" | "end" | null;

export default function ReportScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [selectedRange, setSelectedRange] = useState<string | null>(null);
  const [generatingFormat, setGeneratingFormat] = useState<ExportFormat | null>(null);
  const isGenerating = generatingFormat !== null;

  // Real data for the report
  const { lands, refreshLands } = useLands();
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [complaints, setComplaints] = useState<ApiComplaint[]>([]);

  useEffect(() => {
    refreshLands();
    fetchUsers().then(setUsers).catch((e) => console.warn("❌ Gagal memuat pengguna:", e));
    fetchComplaints().then(setComplaints).catch((e) => console.warn("❌ Gagal memuat keluhan:", e));
  }, [refreshLands]);

  // Custom range
  const [customStart, setCustomStart] = useState<Date | null>(null);
  const [customEnd, setCustomEnd] = useState<Date | null>(null);
  const [pickerTarget, setPickerTarget] = useState<PickerTarget>(null);
  const [iosDraft, setIosDraft] = useState<Date>(new Date());

  const isCustom = selectedRange === "custom";
  const activeRange =
    isCustom
      ? customStart && customEnd ? { start: customStart, end: customEnd } : null
      : selectedRange ? presetRange(selectedRange) : null;

  const canGenerate = !!selectedType && !!activeRange;

  const today = startOfDay(new Date());

  const openPicker = (target: "start" | "end") => {
    const current = target === "start" ? customStart : customEnd;
    setIosDraft(current ?? (target === "end" && customStart ? customStart : today));
    setPickerTarget(target);
  };

  const applyDate = (target: "start" | "end", date: Date) => {
    const d = startOfDay(date);
    if (target === "start") {
      setCustomStart(d);
      // Keep the range valid: push the end date forward if needed
      if (customEnd && customEnd < d) setCustomEnd(d);
    } else {
      if (customStart && d < customStart) {
        Alert.alert("Tanggal tidak valid", "Tanggal akhir tidak boleh sebelum tanggal mulai.");
        return;
      }
      setCustomEnd(d);
    }
  };

  const onAndroidChange = (event: DateTimePickerEvent, date?: Date) => {
    const target = pickerTarget;
    setPickerTarget(null);
    if (event.type === "set" && date && target) applyDate(target, date);
  };

  const confirmIos = () => {
    if (pickerTarget) applyDate(pickerTarget, iosDraft);
    setPickerTarget(null);
  };

  const pickerMin = pickerTarget === "end" && customStart ? customStart : undefined;

  const handleGenerate = async (format: ExportFormat) => {
    if (!canGenerate || !selectedType || !activeRange) {
      Alert.alert(
        "Incomplete",
        isCustom ? "Pilih tanggal mulai dan tanggal akhir." : "Please select a report type and date range."
      );
      return;
    }
    try {
      setGeneratingFormat(format);
      const result = await exportReport(selectedType, format, activeRange, { lands, users, complaints });
      if (result.status === "saved") {
        Alert.alert("Berhasil", `Laporan tersimpan sebagai:\n${result.fileName}`);
      } else if (result.status === "cancelled") {
        Alert.alert("Dibatalkan", "Pilih folder penyimpanan untuk mengunduh laporan.");
      }
      // "shared": the share sheet already gave the user feedback
    } catch (error: any) {
      console.error("❌ Export report error:", error);
      Alert.alert("Gagal", error?.message || "Gagal membuat laporan.");
    } finally {
      setGeneratingFormat(null);
    }
  };

  const selectedTypeInfo = reportTypes.find((r) => r.type === selectedType);

  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={TEXT_DARK} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>Generate Report</Text>
          <Text style={styles.headerSubtitle}>Export system data reports</Text>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40 }}>
        {/* Report Type Selection */}
        <Text style={styles.sectionLabel}>Report Type</Text>
        <View style={styles.typeGrid}>
          {reportTypes.map((rt) => {
            const isSelected = selectedType === rt.type;
            return (
              <TouchableOpacity
                key={rt.type}
                style={[styles.typeCard, isSelected && { borderColor: rt.color, backgroundColor: rt.color + "08" }]}
                onPress={() => setSelectedType(rt.type)}
              >
                <View style={[styles.typeIconWrap, { backgroundColor: rt.color + "15" }]}>
                  <Ionicons name={rt.icon as any} size={24} color={rt.color} />
                </View>
                <Text style={[styles.typeLabel, isSelected && { color: rt.color }]}>{rt.label}</Text>
                <Text style={styles.typeDesc}>{rt.desc}</Text>
                {isSelected && (
                  <View style={[styles.checkBadge, { backgroundColor: rt.color }]}>
                    <Ionicons name="checkmark" size={14} color="#fff" />
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Date Range */}
        <Text style={styles.sectionLabel}>Date Range</Text>
        <View style={styles.rangeList}>
          {dateRanges.map((dr) => {
            const isSelected = selectedRange === dr.value;
            return (
              <TouchableOpacity
                key={dr.value}
                style={[styles.rangeItem, isSelected && { borderColor: PRIMARY, backgroundColor: "#EFF6FF" }]}
                onPress={() => setSelectedRange(dr.value)}
              >
                <Ionicons
                  name={isSelected ? "radio-button-on" : "radio-button-off"}
                  size={22}
                  color={isSelected ? PRIMARY : TEXT_SECONDARY}
                />
                <Text style={[styles.rangeText, isSelected && { color: PRIMARY, fontWeight: "700" }]}>
                  {dr.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* Custom Range pickers */}
        {isCustom && (
          <View style={styles.customRangeRow}>
            {(["start", "end"] as const).map((target) => {
              const value = target === "start" ? customStart : customEnd;
              return (
                <TouchableOpacity
                  key={target}
                  style={[styles.dateField, value && { borderColor: PRIMARY }]}
                  onPress={() => openPicker(target)}
                  activeOpacity={0.8}
                >
                  <Text style={styles.dateFieldLabel}>{target === "start" ? "Dari Tanggal" : "Sampai Tanggal"}</Text>
                  <View style={styles.dateFieldValueRow}>
                    <Ionicons name="calendar-outline" size={16} color={value ? PRIMARY : TEXT_SECONDARY} />
                    <Text style={[styles.dateFieldValue, !value && { color: TEXT_SECONDARY }]}>
                      {value ? formatDate(value) : "Pilih tanggal"}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        )}

        {/* Android: native dialog */}
        {pickerTarget && Platform.OS === "android" && (
          <DateTimePicker
            value={(pickerTarget === "start" ? customStart : customEnd) ?? pickerMin ?? today}
            mode="date"
            display="default"
            minimumDate={pickerMin}
            maximumDate={today}
            onChange={onAndroidChange}
          />
        )}

        {/* iOS: bottom sheet */}
        {Platform.OS === "ios" && (
          <Modal transparent visible={!!pickerTarget} animationType="slide" onRequestClose={() => setPickerTarget(null)}>
            <View style={styles.modalBackdrop}>
              <View style={styles.modalSheet}>
                <View style={styles.modalHeader}>
                  <TouchableOpacity onPress={() => setPickerTarget(null)}>
                    <Text style={styles.modalCancel}>Batal</Text>
                  </TouchableOpacity>
                  <Text style={styles.modalTitle}>
                    {pickerTarget === "start" ? "Dari Tanggal" : "Sampai Tanggal"}
                  </Text>
                  <TouchableOpacity onPress={confirmIos}>
                    <Text style={styles.modalDone}>Pilih</Text>
                  </TouchableOpacity>
                </View>
                <DateTimePicker
                  value={iosDraft}
                  mode="date"
                  display="inline"
                  minimumDate={pickerMin}
                  maximumDate={today}
                  onChange={(_, date) => date && setIosDraft(date)}
                  accentColor={PRIMARY}
                />
              </View>
            </View>
          </Modal>
        )}

        {/* Preview Summary */}
        {canGenerate && (
          <View style={styles.previewCard}>
            <Ionicons name="document-text-outline" size={20} color={PRIMARY} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.previewTitle}>Report Summary</Text>
              <Text style={styles.previewLine}>Type: {selectedTypeInfo?.label}</Text>
              <Text style={styles.previewLine}>
                Period: {activeRange && `${formatDate(activeRange.start)} – ${formatDate(activeRange.end)}`}
              </Text>
              <Text style={styles.previewLine}>Format: PDF / Excel (.xlsx)</Text>
            </View>
          </View>
        )}

        {/* Export Buttons */}
        <Text style={styles.sectionLabel}>Export Format</Text>
        <View style={styles.exportRow}>
          <TouchableOpacity
            style={[styles.exportBtn, !canGenerate && styles.exportBtnDisabled]}
            onPress={() => handleGenerate("pdf")}
            disabled={!canGenerate || isGenerating}
          >
            {generatingFormat === "pdf" ? (
              <>
                <ActivityIndicator size="small" color={DANGER} />
                <Text style={[styles.exportBtnText, { color: DANGER }]}>Membuat...</Text>
              </>
            ) : (
              <>
                <Ionicons name="document" size={20} color={canGenerate ? DANGER : TEXT_SECONDARY} />
                <Text style={[styles.exportBtnText, canGenerate && { color: DANGER }]}>Export PDF</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.exportBtn, !canGenerate && styles.exportBtnDisabled]}
            onPress={() => handleGenerate("excel")}
            disabled={!canGenerate || isGenerating}
          >
            {generatingFormat === "excel" ? (
              <>
                <ActivityIndicator size="small" color={SUCCESS} />
                <Text style={[styles.exportBtnText, { color: SUCCESS }]}>Membuat...</Text>
              </>
            ) : (
              <>
                <Ionicons name="grid" size={20} color={canGenerate ? SUCCESS : TEXT_SECONDARY} />
                <Text style={[styles.exportBtnText, canGenerate && { color: SUCCESS }]}>Export Excel</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </ScrollView>
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

  sectionLabel: {
    fontSize: 15, fontWeight: "700", color: TEXT_DARK,
    marginTop: 24, marginBottom: 12, paddingHorizontal: 20,
  },

  // Type Grid
  typeGrid: { flexDirection: "row", flexWrap: "wrap", paddingHorizontal: 16, gap: 12 },
  typeCard: {
    width: "47%", backgroundColor: "#F8FAFC", borderRadius: 16,
    padding: 16, borderWidth: 2, borderColor: "#E2E8F0", position: "relative",
  },
  typeIconWrap: {
    width: 46, height: 46, borderRadius: 12,
    justifyContent: "center", alignItems: "center", marginBottom: 10,
  },
  typeLabel: { fontSize: 14, fontWeight: "700", color: TEXT_DARK },
  typeDesc: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 4, lineHeight: 16 },
  checkBadge: {
    position: "absolute", top: 10, right: 10,
    width: 22, height: 22, borderRadius: 11,
    justifyContent: "center", alignItems: "center",
  },

  // Date Range
  rangeList: { paddingHorizontal: 20, gap: 8 },
  rangeItem: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#F8FAFC", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#E2E8F0",
  },
  rangeText: { fontSize: 14, color: TEXT_DARK },

  // Custom range
  customRangeRow: { flexDirection: "row", gap: 10, paddingHorizontal: 20, marginTop: 12 },
  dateField: {
    flex: 1, backgroundColor: "#F8FAFC", borderRadius: 12, padding: 12,
    borderWidth: 1, borderColor: "#E2E8F0",
  },
  dateFieldLabel: { fontSize: 11, color: TEXT_SECONDARY, fontWeight: "600" },
  dateFieldValueRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 6 },
  dateFieldValue: { fontSize: 14, fontWeight: "700", color: TEXT_DARK },
  modalBackdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  modalSheet: { backgroundColor: "#FFFFFF", borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: 32 },
  modalHeader: {
    flexDirection: "row", justifyContent: "space-between", alignItems: "center",
    paddingHorizontal: 16, paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: GRAY_BG,
  },
  modalTitle: { fontSize: 15, fontWeight: "700", color: TEXT_DARK },
  modalCancel: { fontSize: 15, color: TEXT_SECONDARY },
  modalDone: { fontSize: 15, fontWeight: "700", color: PRIMARY },

  // Preview
  previewCard: {
    flexDirection: "row", marginHorizontal: 20, marginTop: 20,
    backgroundColor: "#EFF6FF", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#BFDBFE",
  },
  previewTitle: { fontSize: 14, fontWeight: "700", color: PRIMARY },
  previewLine: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },

  // Export
  exportRow: { flexDirection: "row", gap: 12, paddingHorizontal: 20 },
  exportBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    backgroundColor: "#F8FAFC", paddingVertical: 16, borderRadius: 14,
    borderWidth: 1, borderColor: "#E2E8F0", gap: 8,
  },
  exportBtnDisabled: { opacity: 0.5 },
  exportBtnText: { fontSize: 14, fontWeight: "700", color: TEXT_SECONDARY },
});
