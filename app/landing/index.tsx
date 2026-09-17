import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect, useRef } from "react";
import { Animated, Image, StyleSheet, Text, View } from "react-native";

export default function LandingPage() {
  const router = useRouter();

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Fade in
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    // Floating loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: -10,
          duration: 1800,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 1800,
          useNativeDriver: true,
        }),
      ])
    ).start();

    const timer = setTimeout(() => {
      router.replace("/(tabsGuest)/homeGuest");
    }, 3000);

    return () => clearTimeout(timer);
  }, [fadeAnim, floatAnim, router]);

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ translateY: floatAnim }],
          },
        ]}
      >
        <Image
          source={require("../../assets/images/logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />

        <Text style={styles.title}>titikhuni</Text>

        <Text style={styles.subtitle}>
          Temukan & Sewakan Properti dengan Mudah
        </Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#FFFFFF",
  },
  content: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 24,
  },
  logo: {
    width: 120,
    height: 120,
    marginBottom: 20,
  },
  title: {
    fontSize: 38,
    fontWeight: "800",
    color: "#0F172A",
    letterSpacing: 0.8,
  },
  subtitle: {
    fontSize: 14,
    marginTop: 8,
    color: "#64748B",
    textAlign: "center",
    opacity: 0.9,
  },
});
