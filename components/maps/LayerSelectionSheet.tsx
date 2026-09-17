import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ScrollView,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  BaseMapType,
  DISASTER_LAYERS,
  DisasterType,
  PROPERTY_FACILITY_LAYERS,
  PropertyFacilityLayerType,
} from "../../data/riskData";

interface LayerSelectionSheetProps {
  visible: boolean;
  onClose: () => void;
  baseMap: BaseMapType;
  onSelectBaseMap: (map: BaseMapType) => void;
  activePropertyLayers: PropertyFacilityLayerType[];
  onTogglePropertyLayer: (layerId: PropertyFacilityLayerType) => void;
  activeDisasterLayers: DisasterType[];
  onToggleDisasterLayer: (layerId: DisasterType) => void;
  onResetAllLayers: () => void;
  theme: any;
}

export const LayerSelectionSheet: React.FC<LayerSelectionSheetProps> = ({
  visible,
  onClose,
  baseMap,
  onSelectBaseMap,
  activePropertyLayers,
  onTogglePropertyLayer,
  activeDisasterLayers,
  onToggleDisasterLayer,
  onResetAllLayers,
  theme,
}) => {
  // Collapsible section state
  const [propertyGroupExpanded, setPropertyGroupExpanded] = useState(true);
  const [disasterGroupExpanded, setDisasterGroupExpanded] = useState(true);
  const [basemapGroupExpanded, setBasemapGroupExpanded] = useState(true);

  const baseMapOptions: { id: BaseMapType; name: string; icon: string }[] = [
    { id: "standard", name: "Standard", icon: "map-outline" },
    { id: "satellite", name: "Satellite", icon: "earth-outline" },
    { id: "osm", name: "OpenStreetMap", icon: "navigate-outline" },
  ];

  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <TouchableOpacity style={styles.backdrop} onPress={onClose} />
        <View style={styles.sheet}>
          {/* HEADER */}
          <View style={styles.header}>
            <View style={styles.headerTitleRow}>
              <Ionicons name="layers-outline" size={20} color="#2E7D32" />
              <Text style={styles.title}>Layer Panel</Text>
            </View>
            <View style={styles.headerRightRow}>
              {(activePropertyLayers.length > 0 || activeDisasterLayers.length > 0) && (
                <TouchableOpacity onPress={onResetAllLayers} style={{ marginRight: 12 }}>
                  <Text style={styles.resetText}>Reset</Text>
                </TouchableOpacity>
              )}
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close" size={22} color="#111827" />
              </TouchableOpacity>
            </View>
          </View>

          <ScrollView showsVerticalScrollIndicator={false}>
            {/* GROUP 1: PROPERTY LAYERS */}
            <View style={styles.accordionGroup}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setPropertyGroupExpanded(!propertyGroupExpanded)}
                activeOpacity={0.8}
              >
                <View style={styles.accordionTitleRow}>
                  <Ionicons name="business-outline" size={18} color="#2E7D32" />
                  <Text style={styles.groupTitle}>Property Layers</Text>
                  {activePropertyLayers.length > 0 && (
                    <View style={styles.countBadge}>
                      <Text style={styles.countBadgeText}>{activePropertyLayers.length}</Text>
                    </View>
                  )}
                </View>
                <Ionicons
                  name={propertyGroupExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#6B7280"
                />
              </TouchableOpacity>

              {propertyGroupExpanded && (
                <View style={styles.groupGrid}>
                  {PROPERTY_FACILITY_LAYERS.map((layer) => {
                    const isActive = activePropertyLayers.includes(layer.id);
                    return (
                      <TouchableOpacity
                        key={layer.id}
                        style={[
                          styles.chipItem,
                          {
                            backgroundColor: isActive ? "rgba(46, 125, 50, 0.1)" : "#F8FAFC",
                            borderColor: isActive ? "#2E7D32" : "#E5E7EB",
                          },
                        ]}
                        onPress={() => onTogglePropertyLayer(layer.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={layer.icon as any}
                          size={15}
                          color={isActive ? "#2E7D32" : "#6B7280"}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            { color: isActive ? "#2E7D32" : "#111827", fontWeight: isActive ? "700" : "500" },
                          ]}
                        >
                          {layer.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* GROUP 2: DISASTER LAYERS */}
            <View style={styles.accordionGroup}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setDisasterGroupExpanded(!disasterGroupExpanded)}
                activeOpacity={0.8}
              >
                <View style={styles.accordionTitleRow}>
                  <Ionicons name="warning-outline" size={18} color="#DC2626" />
                  <Text style={styles.groupTitle}>Disaster Layers</Text>
                  {activeDisasterLayers.length > 0 && (
                    <View style={[styles.countBadge, { backgroundColor: "rgba(220, 38, 38, 0.12)" }]}>
                      <Text style={[styles.countBadgeText, { color: "#DC2626" }]}>
                        {activeDisasterLayers.length}
                      </Text>
                    </View>
                  )}
                </View>
                <Ionicons
                  name={disasterGroupExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#6B7280"
                />
              </TouchableOpacity>

              {disasterGroupExpanded && (
                <View style={styles.groupGrid}>
                  {DISASTER_LAYERS.map((layer) => {
                    const isActive = activeDisasterLayers.includes(layer.id);
                    return (
                      <TouchableOpacity
                        key={layer.id}
                        style={[
                          styles.chipItem,
                          {
                            backgroundColor: isActive ? "rgba(46, 125, 50, 0.1)" : "#F8FAFC",
                            borderColor: isActive ? "#2E7D32" : "#E5E7EB",
                          },
                        ]}
                        onPress={() => onToggleDisasterLayer(layer.id)}
                        activeOpacity={0.8}
                      >
                        <Ionicons
                          name={layer.icon as any}
                          size={15}
                          color={isActive ? "#2E7D32" : layer.color}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            { color: isActive ? "#2E7D32" : "#111827", fontWeight: isActive ? "700" : "500" },
                          ]}
                        >
                          {layer.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>

            {/* GROUP 3: BASEMAP */}
            <View style={styles.accordionGroup}>
              <TouchableOpacity
                style={styles.accordionHeader}
                onPress={() => setBasemapGroupExpanded(!basemapGroupExpanded)}
                activeOpacity={0.8}
              >
                <View style={styles.accordionTitleRow}>
                  <Ionicons name="map-outline" size={18} color="#2E7D32" />
                  <Text style={styles.groupTitle}>Basemap</Text>
                </View>
                <Ionicons
                  name={basemapGroupExpanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color="#6B7280"
                />
              </TouchableOpacity>

              {basemapGroupExpanded && (
                <View style={styles.baseMapRow}>
                  {baseMapOptions.map((opt) => {
                    const selected = baseMap === opt.id;
                    return (
                      <TouchableOpacity
                        key={opt.id}
                        style={[
                          styles.baseMapCard,
                          {
                            backgroundColor: selected ? "rgba(46, 125, 50, 0.1)" : "#F8FAFC",
                            borderColor: selected ? "#2E7D32" : "#E5E7EB",
                            borderWidth: selected ? 2 : 1,
                          },
                        ]}
                        onPress={() => onSelectBaseMap(opt.id)}
                      >
                        <Ionicons
                          name={opt.icon as any}
                          size={18}
                          color={selected ? "#2E7D32" : "#6B7280"}
                        />
                        <Text
                          style={[
                            styles.baseMapText,
                            { color: selected ? "#2E7D32" : "#111827", fontWeight: selected ? "700" : "500" },
                          ]}
                        >
                          {opt.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          </ScrollView>

          {/* PRIMARY BUTTON */}
          <TouchableOpacity style={styles.applyBtn} onPress={onClose} activeOpacity={0.9}>
            <Text style={styles.applyBtnText}>Apply Layers</Text>
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
  backdrop: { flex: 1 },
  sheet: {
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 24,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "82%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  headerTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  headerRightRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
  },
  resetText: {
    color: "#2E7D32",
    fontWeight: "700",
    fontSize: 13,
  },
  closeBtn: {
    padding: 2,
  },
  accordionGroup: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    overflow: "hidden",
  },
  accordionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 12,
    backgroundColor: "#F8FAFC",
  },
  accordionTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  groupTitle: {
    fontSize: 14,
    fontWeight: "700",
    color: "#111827",
  },
  countBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: "rgba(46, 125, 50, 0.12)",
  },
  countBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#2E7D32",
  },
  groupGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: 12,
    backgroundColor: "#FFFFFF",
  },
  chipItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 7,
    borderRadius: 8,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
  },
  baseMapRow: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    backgroundColor: "#FFFFFF",
  },
  baseMapCard: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: 10,
    gap: 4,
  },
  baseMapText: {
    fontSize: 11,
  },
  applyBtn: {
    backgroundColor: "#2E7D32",
    paddingVertical: 13,
    borderRadius: 10,
    alignItems: "center",
    marginTop: 12,
  },
  applyBtnText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 14,
  },
});
