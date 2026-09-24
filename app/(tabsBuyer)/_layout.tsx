import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";
import { useTheme } from "../../contexts/ThemeContext";
import { BookmarkProvider, useBookmark } from "../../contexts/BookmarkContext";
import { LandProvider } from "../../contexts/LandContext"; // ✅ Tambahkan ini agar data lahan global tersedia
import { useChat } from "../../contexts/ChatContext";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function BuyerTabs() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { favorites } = useBookmark();
  const { totalUnread } = useChat();
  const insets = useSafeAreaInsets();

  const favoriteCount = favorites.length;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopColor: theme.border,
          borderTopWidth: 1,
          height: insets.bottom > 0 ? 84 : 64,
          paddingBottom: insets.bottom > 0 ? insets.bottom - 6 : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: "600",
        },
      }}
    >
      {/* 🏡 Beranda */}
      <Tabs.Screen
        name="homeBuyer"
        options={{
          title: t("home.title") || "Beranda",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 💖 Favorit */}
      <Tabs.Screen
        name="favorites"
        options={{
          title: t("favorites.title") || "Favorit",
          tabBarIcon: ({ color, size }) => (
            <View>
              <Ionicons name="heart-outline" size={size} color={color} />
              {favoriteCount > 0 && (
                <View
                  style={[styles.badge, { backgroundColor: theme.primary }]}
                >
                  <Text style={styles.badgeText}>
                    {favoriteCount > 99 ? "99+" : favoriteCount}
                  </Text>
                </View>
              )}
            </View>
          ),
        }}
      />

                {/* Chat*/}
        <Tabs.Screen
          name="chat"
          options={{
            title: 'Chat',
            tabBarBadge: totalUnread > 0 ? (totalUnread > 99 ? "99+" : totalUnread) : undefined,
            tabBarBadgeStyle: { backgroundColor: "#DC2626", color: "#FFFFFF", fontSize: 10, fontWeight: "800" },
            tabBarIcon: ({ color, size }) => (
            <Ionicons name="chatbubble-ellipses-outline" color={color} size={size} />
            ),
          }}
        />
      
      {/* 👤 Profil */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t("profile.title") || "Profil",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

export default function PembeliLayout() {
  return (
    <BookmarkProvider>
        {/* ✅ Bungkus agar data tanah tersedia di semua tab */}
        <LandProvider>
          <BuyerTabs />
        </LandProvider>
    </BookmarkProvider>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: "absolute",
    right: -8,
    top: -4,
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 4,
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "bold",
  },
});
