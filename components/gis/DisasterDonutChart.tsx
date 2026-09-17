import React from "react";
import { View, Text, StyleSheet } from "react-native";

interface DisasterDonutChartProps {
  distribution: {
    low: number;
    medium: number;
    high: number;
  };
}

export const DisasterDonutChart: React.FC<DisasterDonutChartProps> = ({
  distribution,
}) => {
  const { low = 0, medium = 0, high = 0 } = distribution || {};
  const totalLayers = 6;

  // Colors
  const lowColor = "#16A34A"; // Green
  const mediumColor = "#EAB308"; // Yellow
  const highColor = "#DC2626"; // Red

  // Compute proportion segments for visual ring blocks
  // Create 6 discrete segment blocks representing the 6 PostGIS layers
  const segments: string[] = [];
  for (let i = 0; i < low; i++) segments.push(lowColor);
  for (let i = 0; i < medium; i++) segments.push(mediumColor);
  for (let i = 0; i < high; i++) segments.push(highColor);

  // Pad to 6 if needed
  while (segments.length < 6) segments.push("#E5E7EB");

  return (
    <View style={styles.container}>
      <Text style={styles.chartTitle}>Disaster Risk Category Distribution</Text>

      <View style={styles.chartBodyRow}>
        {/* DONUT RING CONTAINER */}
        <View style={styles.donutOuterRing}>
          {/* SEGMENT BLOCKS IN CIRCULAR LAYOUT */}
          <View style={styles.segmentsContainer}>
            {segments.map((color, index) => {
              const rotation = index * 60; // 360 / 6 = 60 deg
              return (
                <View
                  key={index}
                  style={[
                    styles.segmentArcWrap,
                    { transform: [{ rotate: `${rotation}deg` }] },
                  ]}
                >
                  <View style={[styles.segmentArcBlock, { backgroundColor: color }]} />
                </View>
              );
            })}
          </View>

          {/* INNER HOLE (CENTER OF DONUT) */}
          <View style={styles.donutInnerHole}>
            <Text style={styles.centerNumber}>6</Text>
            <Text style={styles.centerLabel}>Disaster Layers</Text>
          </View>
        </View>

        {/* LEGEND BESIDE CHART */}
        <View style={styles.legendContainer}>
          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: lowColor }]} />
            <Text style={styles.legendText}>
              <Text style={{ fontWeight: "800" }}>🟢 Low</Text> ({low})
            </Text>
          </View>

          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: mediumColor }]} />
            <Text style={styles.legendText}>
              <Text style={{ fontWeight: "800" }}>🟡 Medium</Text> ({medium})
            </Text>
          </View>

          <View style={styles.legendRow}>
            <View style={[styles.legendDot, { backgroundColor: highColor }]} />
            <Text style={styles.legendText}>
              <Text style={{ fontWeight: "800" }}>🔴 High</Text> ({high})
            </Text>
          </View>
        </View>
      </View>

      {/* CAPTION BELOW CHART */}
      <Text style={styles.captionText}>
        The chart represents the distribution of disaster risk categories derived
        from six official BPBD/BNPB (InaRISK) disaster layers through PostGIS
        spatial overlay analysis.
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginTop: 14,
    marginBottom: 14,
  },
  chartTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 12,
  },
  chartBodyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-around",
    marginVertical: 4,
  },
  donutOuterRing: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: "#E5E7EB",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
    overflow: "hidden",
  },
  segmentsContainer: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },
  segmentArcWrap: {
    position: "absolute",
    width: 120,
    height: 120,
    alignItems: "center",
  },
  segmentArcBlock: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginTop: 6,
  },
  donutInnerHole: {
    width: 82,
    height: 82,
    borderRadius: 41,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    zIndex: 10,
  },
  centerNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: "#111827",
    lineHeight: 24,
  },
  centerLabel: {
    fontSize: 9,
    fontWeight: "700",
    color: "#6B7280",
    textAlign: "center",
  },
  legendContainer: {
    gap: 10,
    paddingLeft: 8,
  },
  legendRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  legendDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  legendText: {
    fontSize: 12,
    color: "#374151",
  },
  captionText: {
    fontSize: 11,
    color: "#6B7280",
    lineHeight: 15,
    marginTop: 12,
    fontStyle: "italic",
    textAlign: "center",
  },
});
