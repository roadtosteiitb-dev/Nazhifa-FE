import React from "react";
import { View, TouchableOpacity, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";

interface FloatingMapControlsProps {
  onMyLocation: () => void;
  onOpenLayers: () => void;
  onResetView: () => void;
  activeLayersCount?: number;
}

export const FloatingMapControls: React.FC<FloatingMapControlsProps> = ({
  onMyLocation,
  onOpenLayers,
  onResetView,
  activeLayersCount = 0,
}) => {
  return (
    <View style={styles.container}>
      {/* 1. MY LOCATION */}
      <TouchableOpacity
        style={styles.button}
        onPress={onMyLocation}
        activeOpacity={0.85}
      >
        <Ionicons name="locate" size={20} color="#2E7D32" />
      </TouchableOpacity>

      {/* 2. LAYERS */}
      <TouchableOpacity
        style={styles.button}
        onPress={onOpenLayers}
        activeOpacity={0.85}
      >
        <Ionicons name="layers" size={20} color="#2E7D32" />
        {activeLayersCount > 0 && (
          <View style={styles.badgeDot} />
        )}
      </TouchableOpacity>

      {/* 3. RESET VIEW */}
      <TouchableOpacity
        style={styles.button}
        onPress={onResetView}
        activeOpacity={0.85}
      >
        <Ionicons name="compass" size={20} color="#2E7D32" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: "absolute",
    right: 16,
    top: 110,
    zIndex: 15,
    gap: 10,
  },
  button: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 3,
  },
  badgeDot: {
    position: "absolute",
    top: 4,
    right: 4,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: "#2E7D32",
    borderWidth: 1.5,
    borderColor: "#FFFFFF",
  },
});
