import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

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

export default function ReportScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<ReportType | null>(null);
  const [selectedRange, setSelectedRange] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const canGenerate = selectedType && selectedRange;

  const handleGenerate = (format: "pdf" | "excel") => {
    if (!canGenerate) {
      Alert.alert("Incomplete", "Please select a report type and date range.");
      return;
    }
    setIsGenerating(true);
    setTimeout(() => {
      setIsGenerating(false);
      Alert.alert(
        "Report Generated",
        `Your ${reportTypes.find((r) => r.type === selectedType)?.label} report (${format.toUpperCase()}) has been generated successfully.`,
        [{ text: "OK" }]
      );
    }, 1500);
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

        {/* Preview Summary */}
        {canGenerate && (
          <View style={styles.previewCard}>
            <Ionicons name="document-text-outline" size={20} color={PRIMARY} />
            <View style={{ flex: 1, marginLeft: 10 }}>
              <Text style={styles.previewTitle}>Report Summary</Text>
              <Text style={styles.previewLine}>Type: {selectedTypeInfo?.label}</Text>
              <Text style={styles.previewLine}>
                Period: {dateRanges.find((d) => d.value === selectedRange)?.label}
              </Text>
              <Text style={styles.previewLine}>Format: PDF / Excel</Text>
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
            {isGenerating ? (
              <Text style={styles.exportBtnText}>Generating...</Text>
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
            {isGenerating ? (
              <Text style={styles.exportBtnText}>Generating...</Text>
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
