import React from "react";
import { StyleSheet, Text, TouchableOpacity, View, ViewStyle } from "react-native";
import { useTranslation } from "react-i18next";

const LANGS = [
  { code: "id", label: "ID" },
  { code: "en", label: "EN" },
];

/** Compact ID | EN toggle — usable before login (the choice is persisted by utils/i18n). */
export function LanguageSwitch({ style, color = "#2E7D32" }: { style?: ViewStyle; color?: string }) {
  const { i18n } = useTranslation();
  const current = i18n.language?.startsWith("en") ? "en" : "id";

  return (
    <View style={[styles.wrap, { borderColor: color + "55" }, style]}>
      {LANGS.map((l) => {
        const active = l.code === current;
        return (
          <TouchableOpacity
            key={l.code}
            onPress={() => !active && i18n.changeLanguage(l.code)}
            style={[styles.item, active && { backgroundColor: color }]}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
          >
            <Text style={[styles.text, { color: active ? "#FFFFFF" : color }]}>{l.label}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", borderWidth: 1, borderRadius: 16, padding: 2, backgroundColor: "#FFFFFF" },
  item: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 14 },
  text: { fontSize: 12, fontWeight: "800" },
});
