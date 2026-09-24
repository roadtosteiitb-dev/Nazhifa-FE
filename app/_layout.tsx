import { Stack, useRouter, useSegments } from "expo-router";
import React, { useState, useEffect } from "react";
import "../utils/i18n";

import { ThemeProvider } from "../contexts/ThemeContext";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { CartProvider } from "../contexts/CartContext";
import { LandProvider } from "../contexts/LandContext";
import { BookmarkProvider } from "../contexts/BookmarkContext";
import { StatsProvider } from "../contexts/StatsContext";
import { ActivityProvider } from "../contexts/ActivityContext";
import { ChatProvider } from "../contexts/ChatContext";

// GATE UNTUK MENGATUR ARAH USER
function AuthGate() {
  const { user, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup =
      segments[0] === "(tabsOwner)" ||
      segments[0] === "(tabsBuyer)" ||
      segments[0] === "(tabsAdmin)";

    if (!user) {
      // Jika tidak login tapi berada di group terproteksi, arahkan ke login
      if (inAuthGroup) {
        router.replace("/auth/login");
      }
    } else {
      // Jika sudah login tapi di group guest/auth, arahkan ke home masing-masing
      const inGuestOrAuthGroup =
        segments[0] === "(tabsGuest)" ||
        segments[0] === "auth" ||
        segments[0] === "landing" ||
        (segments as string[]).length === 0;

      if (inGuestOrAuthGroup) {
        if (user.userType === "owner") {
          router.replace("/(tabsOwner)/homeOwner");
        } else if (user.userType === "buyer") {
          router.replace("/(tabsBuyer)/homeBuyer");
        } else if (user.userType === "admin") {
          router.replace("/(tabsAdmin)/homeAdmin");
        }
      }
    }
  }, [user, segments, isLoading]);

  if (isLoading) return null;

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabsGuest)" />
      <Stack.Screen name="(tabsOwner)" />
      <Stack.Screen name="(tabsBuyer)" />
      <Stack.Screen name="(tabsAdmin)" />
      <Stack.Screen name="auth/login" />
      <Stack.Screen name="auth/register" />
    </Stack>
  );
}

export default function RootLayout() {
  const [showLanding, setShowLanding] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setShowLanding(false);
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <ThemeProvider>
      <AuthProvider>
        <LandProvider>
          <BookmarkProvider>
          <CartProvider>
              <StatsProvider>
                <ActivityProvider>
                  <ChatProvider>
                    {showLanding ? (
                      // TAMPILKAN LANDING DULU
                      <Stack screenOptions={{ headerShown: false }}>
                        <Stack.Screen name="landing/index" />
                      </Stack>
                    ) : (
                      // BARU AUTHGATE SETELAH LANDING SELESAI
                      <AuthGate />
                    )}
                  </ChatProvider>
                </ActivityProvider>
              </StatsProvider>

          </CartProvider>
          </BookmarkProvider>
        </LandProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
