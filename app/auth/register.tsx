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

export default function Register() {
  const { theme } = useTheme();
  const { register } = useAuth();
  const router = useRouter();

  // 📋 Form states
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [userType, setUserType] = useState<"owner" | "buyer">("buyer");
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [loading, setLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // ================= HANDLE REGISTER =================
  const handleRegister = async () => {
    if (!fullName || !email || !phone || !password || !confirmPassword) {
      Alert.alert("Data belum lengkap", "Mohon lengkapi semua field yang tersedia.");
      return;
    }
    if (password !== confirmPassword) {
      Alert.alert("Password tidak cocok", "Konfirmasi password harus sama dengan kata sandi.");
      return;
    }
    if (!agreeTerms) {
      Alert.alert(
        "Persetujuan diperlukan",
        "Anda harus menyetujui Syarat & Ketentuan untuk mendaftar."
      );
      return;
    }

    try {
      setLoading(true);
      const result = await register({
        fullName,
        email,
        password,
        phone,
        userType,
      });
      setLoading(false);

      if (result.success) {
        Alert.alert("Pendaftaran Berhasil", "Akun Anda telah berhasil dibuat!", [
          {
            text: "OK",
            onPress: () => {
              if (userType === "owner") {
                router.replace("/(tabsOwner)/homeOwner");
              } else {
                router.replace("/(tabsBuyer)/homeBuyer");
              }
            },
          },
        ]);
      } else {
        Alert.alert("Pendaftaran Gagal", result.message || "Gagal membuat akun.");
      }
    } catch (e) {
      setLoading(false);
      Alert.alert("Kesalahan", "Terjadi kesalahan saat melakukan registrasi.");
      console.error(e);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
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
            {/* <Text style={[styles.logoTitle, { color: theme.primary }]}></Text> */}

            <Text style={[styles.title, { color: theme.text }]}>
              Buat Akun Baru
            </Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Temukan dan sewa hunian terbaik dengan mudah dan praktis
            </Text>
          </View>

          {/* ================= FORM ================= */}
          <View style={styles.form}>
            <Input
              placeholder="Nama Lengkap"
              value={fullName}
              onChangeText={setFullName}
              icon="person-outline"
            />

            <Input
              placeholder="Email"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              icon="mail-outline"
            />

            <Input
              placeholder="Nomor Telepon"
              value={phone}
              onChangeText={setPhone}
              keyboardType="phone-pad"
              icon="call-outline"
            />

            <Input
              placeholder="Kata Sandi"
              value={password}
              onChangeText={setPassword}
              isPassword
              icon="lock-closed-outline"
            />

            <Input
              placeholder="Konfirmasi Kata Sandi"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
              isPassword
              icon="lock-closed-outline"
            />

            {/* Dropdown Pilihan Jenis Akun */}
            <View style={styles.dropdownContainer}>
              <Text style={[styles.label, { color: theme.text }]}>Jenis Akun</Text>
              <TouchableOpacity
                style={[
                  styles.dropdownHeader,
                  {
                    backgroundColor: theme.inputBackground || theme.surfaceLight,
                    borderColor: theme.border,
                    borderWidth: theme.borderWidth,
                    borderRadius: theme.borderRadius,
                  },
                ]}
                onPress={() => setDropdownOpen(!dropdownOpen)}
                activeOpacity={0.8}
              >
                <View style={styles.dropdownHeaderLeft}>
                  <Ionicons
                    name="people-outline"
                    size={20}
                    color={theme.textSecondary}
                    style={styles.dropdownIcon}
                  />
                  <Text style={[styles.dropdownValueText, { color: theme.text }]}>
                    {userType === "buyer" ? "Pencari Hunian" : "Pemilik Properti"}
                  </Text>
                </View>
                <Ionicons
                  name={dropdownOpen ? "chevron-up" : "chevron-down"}
                  size={20}
                  color={theme.textSecondary}
                />
              </TouchableOpacity>

              {dropdownOpen && (
                <View
                  style={[
                    styles.dropdownOptionsList,
                    {
                      backgroundColor: theme.card,
                      borderColor: theme.border,
                      borderWidth: theme.borderWidth,
                      borderRadius: theme.borderRadius,
                      shadowColor: theme.shadow || '#000',
                      shadowOffset: theme.shadowOffset,
                      shadowOpacity: theme.shadowOpacity,
                      shadowRadius: theme.shadowRadius,
                      elevation: 3,
                    },
                  ]}
                >
                  <TouchableOpacity
                    style={[
                      styles.dropdownOption,
                      userType === "buyer" && { backgroundColor: theme.primary + "15" },
                    ]}
                    onPress={() => {
                      setUserType("buyer");
                      setDropdownOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="home-outline"
                      size={18}
                      color={userType === "buyer" ? theme.primary : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        { color: theme.text },
                        userType === "buyer" && { color: theme.primary, fontWeight: "600" },
                      ]}
                    >
                      Pencari Hunian
                    </Text>
                  </TouchableOpacity>

                  <View style={[styles.optionDivider, { backgroundColor: theme.border }]} />

                  <TouchableOpacity
                    style={[
                      styles.dropdownOption,
                      userType === "owner" && { backgroundColor: theme.primary + "15" },
                    ]}
                    onPress={() => {
                      setUserType("owner");
                      setDropdownOpen(false);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons
                      name="business-outline"
                      size={18}
                      color={userType === "owner" ? theme.primary : theme.textSecondary}
                    />
                    <Text
                      style={[
                        styles.dropdownOptionText,
                        { color: theme.text },
                        userType === "owner" && { color: theme.primary, fontWeight: "600" },
                      ]}
                    >
                      Pemilik Properti
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>

            {/* Checkbox Syarat & Ketentuan */}
            <TouchableOpacity
              style={styles.checkboxRow}
              onPress={() => setAgreeTerms(!agreeTerms)}
              activeOpacity={0.8}
            >
              <Ionicons
                name={agreeTerms ? "checkbox" : "square-outline"}
                size={22}
                color={agreeTerms ? theme.primary : theme.textSecondary}
              />
              <Text style={[styles.checkboxText, { color: theme.textSecondary }]}>
                Saya menyetujui{" "}
                <Text style={{ color: theme.primary, fontWeight: "600" }}>
                  Syarat & Ketentuan
                </Text>{" "}
                yang berlaku
              </Text>
            </TouchableOpacity>

            {/* REGISTER BUTTON */}
            <TouchableOpacity
              style={[
                styles.registerButton,
                { backgroundColor: theme.primary, borderRadius: theme.borderRadius, opacity: loading ? 0.8 : 1 },
              ]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <Text style={styles.registerText}>Daftar Sekarang</Text>
                  <Ionicons name="arrow-forward-outline" size={18} color="#fff" />
                </>
              )}
            </TouchableOpacity>

            {/* ================= DIVIDER ================= */}
            <View style={styles.dividerRow}>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
              <Text style={[styles.dividerText, { color: theme.textSecondary }]}>
                atau daftar dengan
              </Text>
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
            </View>

            {/* ================= SOCIAL LOGIN ================= */}
            <TouchableOpacity
              style={[styles.socialBtn, { borderColor: theme.border, borderRadius: theme.borderRadius }]}
              onPress={() => Alert.alert("Informasi", "Pendaftaran dengan Google akan segera tersedia.")}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-google" size={20} color="#DB4437" />
              <Text style={[styles.socialText, { color: theme.text }]}>
                Daftar dengan Google
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.socialBtn, { borderColor: theme.border, borderRadius: theme.borderRadius }]}
              onPress={() => Alert.alert("Informasi", "Pendaftaran dengan Apple akan segera tersedia.")}
              activeOpacity={0.8}
            >
              <Ionicons name="logo-apple" size={20} color={theme.text} />
              <Text style={[styles.socialText, { color: theme.text }]}>
                Daftar dengan Apple
              </Text>
            </TouchableOpacity>
          </View>

          {/* ================= FOOTER ================= */}
          <View style={styles.footer}>
            <Text style={[styles.footerText, { color: theme.textSecondary }]}>
              Sudah punya akun?
            </Text>
            <TouchableOpacity onPress={() => router.push("/auth/login")}>
              <Text style={[styles.footerLink, { color: theme.primary }]}>
                {" "}Masuk
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 40,
  },
  header: {
    alignItems: "center",
    marginBottom: 28,
  },
  logo: {
    width: 80,
    height: 80,
    marginBottom: 12,
  },
  logoCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  logoTitle: {
    fontSize: 22,
    fontWeight: "800",
    marginBottom: 12,
    letterSpacing: 0.5,
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
  label: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 8,
    marginTop: 4,
  },
  dropdownContainer: {
    marginBottom: 16,
    position: "relative",
  },
  dropdownHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.2,
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 50,
  },
  dropdownHeaderLeft: {
    flexDirection: "row",
    alignItems: "center",
  },
  dropdownIcon: {
    marginRight: 8,
  },
  dropdownValueText: {
    fontSize: 15,
  },
  dropdownOptionsList: {
    marginTop: 6,
    borderWidth: 1.2,
    borderRadius: 12,
    overflow: "hidden",
  },
  dropdownOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 10,
  },
  dropdownOptionText: {
    fontSize: 15,
  },
  optionDivider: {
    height: 1,
    width: "100%",
  },
  checkboxRow: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 14,
    paddingRight: 16,
    gap: 8,
  },
  checkboxText: {
    fontSize: 13,
    lineHeight: 18,
    flex: 1,
  },
  registerButton: {
    marginTop: 12,
    paddingVertical: 14,
    borderRadius: 14,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  registerText: {
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
