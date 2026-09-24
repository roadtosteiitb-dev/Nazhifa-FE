import { useTranslation } from "react-i18next";
import { LanguageSwitch } from "../../components/common/LanguageSwitch";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Input } from "../../components/common/Input";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

export default function Login() {
  const { t } = useTranslation();
  const { theme } = useTheme();
  const { login } = useAuth();
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // ================= HANDLE LOGIN =================
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert(t("auth.incompleteTitle"), t("auth.emailPasswordRequired"));
      return;
    }

    try {
      setLoading(true);

      // Login lewat AuthContext
      const result = await login(email, password);

      setLoading(false);

      if (result.success && result.user) {
        const role = result.user.userType;

        // ================= REDIRECT ROLE =================
        if (role === "owner") {
          router.replace("/(tabsOwner)/homeOwner");
        } else if (role === "buyer") {
          router.replace("/(tabsBuyer)/homeBuyer");
        } else if (role === "admin") {
          router.replace("/(tabsAdmin)/homeAdmin");
        } else {
          Alert.alert(t("common.error"), t("auth.unknownRole"));
        }
      } else {
        Alert.alert(t("auth.loginFailed"), result.message || t("auth.loginError"));
      }
    } catch (e) {
      setLoading(false);
      Alert.alert(t("common.error"), t("auth.genericError"));
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <LanguageSwitch style={{ position: "absolute", top: 52, right: 16, zIndex: 10 }} color={theme.primary} />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ================= HEADER ================= */}
          <View style={styles.header}>
            <Image
              source={require("../../assets/images/logo.png")}
              style={styles.logo}
              resizeMode="contain"
            />

            <Text style={[styles.title, { color: theme.text }]}>
              {t("auth.welcomeBack")}
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              {t("auth.loginSubtitle")}
            </Text>
          </View>

          {/* ================= FORM ================= */}
          <View style={styles.form}>
            <Input
              placeholder={t("auth.email")}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
            />

            {/* PASSWORD WITH TOGGLE */}
            <View style={{ marginTop: 14 }}>
              <Input
                placeholder={t("auth.password")}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                icon="lock-closed-outline"
              />
              <TouchableOpacity
                style={styles.eyeButton}
                onPress={() => setShowPassword(!showPassword)}
              >
                <Ionicons
                  name={showPassword ? "eye-off-outline" : "eye-outline"}
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>
            </View>

            {/* FORGOT PASSWORD */}
            <TouchableOpacity
              style={styles.forgot}
              onPress={() =>
                Alert.alert(t("auth.forgotPasswordTitle"), t("auth.forgotPasswordSoon"))
              }
            >
              <Text style={[styles.forgotText, { color: theme.primary }]}>
                {t("auth.forgotPassword")}
              </Text>
            </TouchableOpacity>

            {/* LOGIN BUTTON */}
            <TouchableOpacity
              style={[
                styles.loginButton,
                { backgroundColor: theme.primary, borderRadius: theme.borderRadius, opacity: loading ? 0.8 : 1 },
              ]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.loginText}>{t("auth.login")}</Text>
                  <Ionicons name="arrow-forward-outline" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            {/* ================= DIVIDER ================= */}
            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.textSecondary }]}>
                {t("auth.orContinueWith")}
              </Text>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
            </View>

            {/* ================= SOCIAL LOGIN ================= */}
            <TouchableOpacity style={[styles.socialBtn, { borderColor: theme.border, borderRadius: theme.borderRadius }]}>
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={[styles.socialText, { color: theme.text }]}>
                {t("auth.loginWithGoogle")}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.socialBtn, { borderColor: theme.border, borderRadius: theme.borderRadius }]}>
              <Ionicons name="logo-apple" size={20} color={theme.text} />
              <Text style={[styles.socialText, { color: theme.text }]}>
                {t("auth.loginWithApple")}
              </Text>
            </TouchableOpacity>
          </View>

          {/* ================= FOOTER ================= */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              {t("auth.dontHaveAccount")}
            </Text>
            <TouchableOpacity onPress={() => router.push("/auth/register")}>
              <Text style={[styles.footerLink, { color: theme.primary }]}>
                {" "}{t("auth.registerNow")}
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  container: { flex: 1 },

  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingBottom: 40,
  },

  header: {
    alignItems: "center",
    marginBottom: 36,
  },

  logo: {
    width: 80,
    height: 80,
    marginBottom: 16,
  },

  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },

  title: {
    fontSize: 24,
    fontWeight: "700",
    marginBottom: 6,
    textAlign: "center",
  },

  subtitle: {
    fontSize: 14,
    textAlign: "center",
    lineHeight: 20,
  },

  form: {
    width: "100%",
  },

  eyeButton: {
    position: "absolute",
    right: 14,
    top: 14,
  },

  forgot: {
    alignItems: "flex-end",
    marginTop: 10,
  },

  forgotText: {
    fontSize: 13,
    fontWeight: "500",
  },

  loginButton: {
    marginTop: 18,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },

  loginText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
  },

  dividerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 24,
  },

  divider: {
    flex: 1,
    height: 1,
  },

  dividerText: {
    fontSize: 12,
    marginHorizontal: 10,
  },

  socialBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    gap: 10,
  },

  socialText: {
    fontSize: 14,
    fontWeight: "600",
  },

  footer: {
    flexDirection: "row",
    justifyContent: "center",
    marginTop: 18,
  },

  footerText: {
    fontSize: 14,
  },

  footerLink: {
    fontSize: 14,
    fontWeight: "700",
  },
});
