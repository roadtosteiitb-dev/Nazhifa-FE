import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { DISASTER_LAYERS, DisasterType, GIS_RISK_COLORS } from "../../data/riskData";

interface RiskLegendProps {
  activeRiskLayers: DisasterType[];
  theme?: any;
  onClearLayers?: () => void;
}

export const RiskLegend: React.FC<RiskLegendProps> = ({
  activeRiskLayers,
  theme,
  onClearLayers,
}) => {
  if (!activeRiskLayers || activeRiskLayers.length === 0) return null;

  const activeConfigs = DISASTER_LAYERS.filter((l) =>
    activeRiskLayers.includes(l.id)
  );

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Ionicons name="shield-checkmark" size={16} color="#2E7D32" />
          <Text style={styles.title}>Disaster Risk Legend</Text>
        </View>

        {onClearLayers && (
          <TouchableOpacity onPress={onClearLayers} style={styles.closeBtn}>
            <Ionicons name="close" size={16} color="#6B7280" />
          </TouchableOpacity>
        )}
      </View>

      <Text style={styles.activeLayersText}>
        Layers: {activeConfigs.map((c) => c.name).join(", ")}
      </Text>

      {/* COLOR SPECTRUM / LEGEND */}
      <View style={styles.legendRow}>
        <View style={styles.legendItem}>
          <View style={[styles.colorBox, { backgroundColor: GIS_RISK_COLORS.low.dot }]} />
          <Text style={styles.legendLabel}>Rendah</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.colorBox, { backgroundColor: GIS_RISK_COLORS.medium.dot }]} />
          <Text style={styles.legendLabel}>Sedang</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.colorBox, { backgroundColor: GIS_RISK_COLORS.high.dot }]} />
          <Text style={styles.legendLabel}>Tinggi</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.colorBox, { backgroundColor: GIS_RISK_COLORS.very_high.dot }]} />
          <Text style={styles.legendLabel}>Sangat Tinggi</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    position: "absolute",
    left: 16,
    top: 110,
    zIndex: 11,
    paddingHorizontal: 12,
    paddingVertical: 10,
    width: 220,
    backgroundColor: "#FFFFFF",
    borderColor: "#E5E7EB",
    borderWidth: 1,
    borderRadius: 12,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  title: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
  },
  closeBtn: {
    padding: 2,
  },
  activeLayersText: {
    fontSize: 10,
    color: "#6B7280",
    marginTop: 4,
    marginBottom: 6,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 2,
    paddingTop: 6,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
  },
  colorBox: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    fontSize: 9,
    fontWeight: "600",
    color: "#374151",
  },
});
