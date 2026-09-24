import { useTranslation } from "react-i18next";
import React from "react";
import {
  View,
  Text,
  Image,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useBookmark } from "../../contexts/BookmarkContext";
import { useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";

const { width } = Dimensions.get("window");

export default function FavoritesScreen() {
  const { t } = useTranslation();
  const { favorites, toggleFavorite } = useBookmark();
  const router = useRouter();
  const { theme, isDark } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* HEADER */}
      <View style={[styles.header, { backgroundColor: theme.card, borderBottomColor: theme.border }]}>
        <Text style={[styles.title, { color: theme.text }]}>{t("favorites.myFavorites")}</Text>
        <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
          {favorites.length > 0
            ? t("favorites.savedCount", { count: favorites.length })
            : t("favorites.none")}
        </Text>
      </View>

      {/* EMPTY STATE */}
      {favorites.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="heart-dislike-outline" size={70} color={theme.textSecondary} />
          <Text style={[styles.emptyText, { color: theme.text }]}>{t("favorites.emptyTitle")}</Text>
          <Text style={[styles.emptySub, { color: theme.textSecondary }]}>
            {t("favorites.emptyText")}
          </Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ paddingBottom: 120 }}
          showsVerticalScrollIndicator={false}
        >
          {favorites.map((item) => (
            <TouchableOpacity
              key={item.id}
              style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}
              activeOpacity={0.9}
              onPress={() =>
                router.push({
                  pathname: "/product/[id]",
                  params: { id: item.id },
                })
              }
            >
              {item.image ? (
                <Image source={{ uri: item.image }} style={styles.image} />
              ) : (
                <View style={[styles.image, { backgroundColor: theme.surface, alignItems: "center", justifyContent: "center" }]}>
                  <Ionicons name="image-outline" size={32} color={theme.textSecondary} />
                </View>
              )}
              
              <View style={styles.info}>
                <Text style={[styles.name, { color: theme.text }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={styles.locRow}>
                  <Ionicons name="location-outline" size={14} color={theme.textSecondary} />
                  <Text style={[styles.location, { color: theme.textSecondary }]} numberOfLines={1}>
                    {item.location}
                  </Text>
                </View>
                <Text style={[styles.price, { color: theme.primary }]}>
                  Rp{item.price?.toLocaleString("id-ID")}{" "}
                  <Text style={[styles.unit, { color: theme.textSecondary }]}>
                    {(item.forSale ?? (item as any).isForSale) ? "/ha" : "/tahun"}
                  </Text>
                </Text>
              </View>

              {/* ❤️ Unfavorite Button */}
              <TouchableOpacity
                style={[styles.favoriteBtn, { 
                  backgroundColor: isDark ? "#3A1E1E" : "#FEE2E2", 
                  borderLeftColor: isDark ? "#5C2E2E" : "#FCA5A5" 
                }]}
                onPress={() => toggleFavorite(item).catch(() => Alert.alert(t("common.failed"), t("favorites.removeFailed")))}
              >
                <Ionicons name="heart-dislike" size={22} color="#EF4444" />
                <Text style={styles.unfavText}>{t("favorites.remove")}</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  title: {
    fontSize: 22,
    fontWeight: "800",
  },
  subtitle: {
    fontSize: 13,
    marginTop: 2,
  },
  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 80,
    paddingHorizontal: 24,
  },
  emptyText: {
    marginTop: 14,
    fontSize: 16,
    fontWeight: "600",
  },
  emptySub: {
    textAlign: "center",
    marginTop: 6,
    fontSize: 13,
  },
  card: {
    flexDirection: "row",
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 12,
    elevation: 3,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 2 },
    overflow: "hidden",
    borderWidth: 0.5,
  },
  image: {
    width: width * 0.3,
    height: width * 0.25,
  },
  info: {
    flex: 1,
    padding: 10,
    justifyContent: "center",
  },
  name: {
    fontWeight: "700",
    fontSize: 15,
    marginBottom: 2,
  },
  locRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  location: {
    fontSize: 12,
    marginLeft: 4,
    flex: 1,
  },
  price: {
    fontSize: 14,
    fontWeight: "700",
  },
  unit: {
    fontSize: 12,
  },
  favoriteBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
    borderLeftWidth: 1,
  },
  unfavText: {
    fontSize: 10,
    color: "#EF4444",
    marginTop: 2,
    fontWeight: "600",
  },
});
