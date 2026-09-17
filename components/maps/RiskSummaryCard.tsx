import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, Modal } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  DISASTER_LAYERS,
  GIS_RISK_COLORS,
  GisRiskLevel,
} from "../../data/riskData";

interface RiskSummaryCardProps {
  visible: boolean;
  property: any; // ApiLand from PropertyService
  onClose: () => void;
  onNavigateDetail: (id: number | string) => void;
  theme?: any;
}

export const RiskSummaryCard: React.FC<RiskSummaryCardProps> = ({
  visible,
  property,
  onClose,
  onNavigateDetail,
}) => {
  if (!property) return null;

  // Use backend-derived riskLevel if available, default to 'not_affected'
  const overallRiskLevel: GisRiskLevel =
    (property.overallRiskLevel as GisRiskLevel) ?? "not_affected";
  const riskInfo =
    GIS_RISK_COLORS[overallRiskLevel] ?? GIS_RISK_COLORS.not_affected;

  const price: number = property.price ?? 0;
  const district: string =
    property.location?.split(",")?.[0]?.trim() ?? "Yogyakarta";

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />

        <View style={styles.card}>
          {/* HEADER BAR */}
          <View style={styles.header}>
            <View style={styles.badgeRow}>
              <View style={[styles.riskBadge, { backgroundColor: riskInfo.bg }]}>
                <Ionicons name="shield-checkmark" size={14} color={riskInfo.text} />
                <Text style={[styles.riskBadgeText, { color: riskInfo.text }]}>
                  {riskInfo.label}
                </Text>
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Ionicons name="close" size={22} color="#111827" />
            </TouchableOpacity>
          </View>

          {/* PROPERTY TITLE & PRICE */}
          <Text style={styles.title} numberOfLines={1}>
            {property.name ?? "Properti"}
          </Text>
          <View style={styles.propSubRow}>
            <Text style={styles.price}>
              Rp {price.toLocaleString("id-ID")}
            </Text>
            <Text style={styles.location}>• {district}</Text>
          </View>

          {/* DISASTER LAYER INFO */}
          <Text style={styles.sectionTitle}>PostGIS Disaster Assessment</Text>

          <View style={styles.riskGrid}>
            {DISASTER_LAYERS.slice(0, 4).map((layer) => {
              const colorItem: (typeof GIS_RISK_COLORS)[GisRiskLevel] =
                GIS_RISK_COLORS.not_affected;

              return (
                <View key={layer.id} style={styles.riskGridItem}>
                  <View style={styles.riskGridHeader}>
                    <Text style={styles.riskGridTitle}>
                      {layer.emoji} {layer.name}
                    </Text>
                    <View
                      style={[styles.miniBadge, { backgroundColor: colorItem.bg }]}
                    >
                      <Text
                        style={[styles.miniBadgeText, { color: colorItem.text }]}
                      >
                        {colorItem.label}
                      </Text>
                    </View>
                  </View>
                  <Text style={styles.riskGridDesc} numberOfLines={2}>
                    {layer.description}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* ACTION BUTTON */}
          <TouchableOpacity
            style={styles.actionButton}
            onPress={() => {
              onClose();
              onNavigateDetail(property.id);
            }}
          >
            <Text style={styles.actionButtonText}>View Detail Dashboard</Text>
            <Ionicons name="arrow-forward" size={16} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(17, 24, 39, 0.4)",
    justifyContent: "flex-end",
  },
  backdrop: {
    flex: 1,
  },
  card: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    backgroundColor: "#FFFFFF",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  riskBadge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  riskBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  closeBtn: {
    padding: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "800",
    color: "#111827",
    marginTop: 4,
  },
  propSubRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 2,
    marginBottom: 10,
  },
  price: {
    fontSize: 15,
    fontWeight: "900",
    color: "#2E7D32",
  },
  location: {
    fontSize: 12,
    color: "#6B7280",
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 8,
  },
  riskGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 16,
  },
  riskGridItem: {
    width: "48%",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    backgroundColor: "#F8FAFC",
  },
  riskGridHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  riskGridTitle: {
    fontSize: 11,
    fontWeight: "700",
    color: "#111827",
    flex: 1,
  },
  miniBadge: {
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 4,
  },
  miniBadgeText: {
    fontSize: 8,
    fontWeight: "800",
  },
  riskGridDesc: {
    fontSize: 10,
    color: "#6B7280",
    lineHeight: 13,
  },
  actionButton: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 13,
    borderRadius: 10,
    backgroundColor: "#2E7D32",
    gap: 6,
  },
  actionButtonText: {
    color: "#FFF",
    fontWeight: "800",
    fontSize: 14,
  },
});
