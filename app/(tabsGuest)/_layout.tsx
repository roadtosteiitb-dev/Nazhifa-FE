import { useTranslation } from "react-i18next";
import React from "react";
import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { useAuth } from "../../contexts/AuthContext";
import { useRouter } from "expo-router";
import { TouchableOpacity } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export default function GuestLayout() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { user } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.primary,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: {
          backgroundColor: theme.surface,
          borderTopWidth: 0.5,
          borderTopColor: "#E5E7EB",
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
      {/* 🏠 Halaman utama */}
      <Tabs.Screen
        name="homeGuest"
        options={{
          title: t("tabs.home"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />

      {/* 👤 Profil / Harus login */}
      <Tabs.Screen
        name="profile"
        options={{
          title: t("tabs.profile"),
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="person-outline" size={size} color={color} />
          ),
          // 🚪 jika user belum login, intercept tab press → arahkan ke login
          tabBarButton: (props) => (
            <TouchableOpacity
              {...props}
              onPress={() => {
                if (!user) {
                  router.push("/auth/login");
                } else {
                  router.push("/(tabsGuest)/profile");
                }
              }}
            />
          ),
        }}
      />
    </Tabs>
  );
}
