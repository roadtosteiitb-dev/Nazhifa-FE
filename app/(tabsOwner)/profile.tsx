import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  Alert,
  Image,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import i18n from "../../utils/i18n";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";

interface DropdownPickerProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  options: { key: string; label: string }[];
  selectedValue: string;
  onSelect: (value: string) => void;
  theme: any;
}

function DropdownPicker({
  visible,
  onClose,
  title,
  options,
  selectedValue,
  onSelect,
  theme,
}: DropdownPickerProps) {
  return (
    <Modal
      transparent
      visible={visible}
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.modalBackdrop}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={[styles.modalSheet, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
          <View style={styles.modalHeader}>
            <View style={[styles.modalHandle, { backgroundColor: theme.textSecondary + "30" }]} />
            <Text style={[styles.modalTitle, { color: theme.text }]}>{title}</Text>
          </View>
          <ScrollView style={styles.modalOptions}>
            {options.map((item) => {
              const isSelected = selectedValue === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.modalOptionItem,
                    { borderBottomColor: theme.border + "30" },
                    isSelected && { backgroundColor: theme.primary + "15" }
                  ]}
                  onPress={() => {
                    onSelect(item.key);
                    onClose();
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: isSelected ? theme.primary : theme.text, fontWeight: isSelected ? "700" : "500" }]}>
                    {item.label}
                  </Text>
                  {isSelected && (
                    <Ionicons name="checkmark" size={20} color={theme.primary} />
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

export default function Profile() {
  const { t } = useTranslation();
  const { theme, themeMode, toggleTheme } = useTheme();
  const { user, logout, updateUser } = useAuth();
  const router = useRouter();
  const [uploading, setUploading] = useState(false);

  // States untuk dropdown picker
  const [langPickerVisible, setLangPickerVisible] = useState(false);
  const [themePickerVisible, setThemePickerVisible] = useState(false);

  // ======= GANTI BAHASA =======
  const handleLanguageChange = async (lang: string) => {
    try {
      if (!i18n.isInitialized) {
        console.warn("i18n belum siap");
        return;
      }
      await i18n.changeLanguage(lang);
      await AsyncStorage.setItem("@lokatani:language", lang);
    } catch (error) {
      console.error("Gagal mengubah bahasa:", error);
    }
  };

  // ======= LOGOUT =======
  const handleLogout = () => {
    Alert.alert(t("auth.logout"), `${t("auth.logout")}?`, [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("common.confirm"),
        onPress: async () => {
          await logout();
        },
      },
    ]);
  };

  // ======= PILIH FOTO DARI GALERI =======
  const pickImage = async () => {
    const permissionResult =
      await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(t("common.error"), "Permission to access gallery is required!");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setUploading(true);
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await updateUser({ photo: base64Image });
      setUploading(false);
      Alert.alert(t("common.success"), t("profile.updateSuccess"));
    }
  };

  // ======= AMBIL FOTO DARI KAMERA =======
  const takePhoto = async () => {
    const permissionResult = await ImagePicker.requestCameraPermissionsAsync();
    if (!permissionResult.granted) {
      Alert.alert(t("common.error"), "Permission to access camera is required!");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.5,
      base64: true,
    });
    if (!result.canceled && result.assets[0].base64) {
      setUploading(true);
      const base64Image = `data:image/jpeg;base64,${result.assets[0].base64}`;
      await updateUser({ photo: base64Image });
      setUploading(false);
      Alert.alert(t("common.success"), t("profile.updateSuccess"));
    }
  };

  const handleChangePhoto = () => {
    Alert.alert(t("profile.changePhoto"), "", [
      { text: "Kamera", onPress: takePhoto },
      { text: "Galeri", onPress: pickImage },
      { text: t("common.cancel"), style: "cancel" },
    ]);
  };

  const getLangLabel = (code: string) => {
    return code === "id" ? "Bahasa Indonesia" : "English";
  };

  const getThemeLabel = (mode: string) => {
    if (mode === "light") return "Mode Terang";
    if (mode === "dark") return "Mode Gelap";
    return "Ikuti Sistem";
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text }]}>
            {t("profile.title")}
          </Text>
        </View>

        {/* Foto Profil */}
        <View style={styles.profileSection}>
          <TouchableOpacity onPress={handleChangePhoto} disabled={uploading} activeOpacity={0.85}>
            <View style={[styles.avatarContainer, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
              {user?.photo ? (
                <Image source={{ uri: user.photo }} style={styles.avatar} />
              ) : (
                <Ionicons name="person" size={50} color={theme.primary} />
              )}
              <View style={[styles.cameraIcon, { backgroundColor: theme.primary }]}>
                <Ionicons name="camera" size={15} color="#FFFFFF" />
              </View>
            </View>
          </TouchableOpacity>

          <Text style={[styles.name, { color: theme.text }]}>
            {user?.fullName || "User"}
          </Text>
          <Text style={[styles.email, { color: theme.textSecondary }]}>
            {user?.email || "example@email.com"}
          </Text>
          <View style={[styles.badge, { backgroundColor: theme.primary + "15" }]}>
            <Text style={[styles.badgeText, { color: theme.primary }]}>
              {user?.userType === "owner" ? t("auth.owner") : user?.userType === "buyer" ? t("auth.buyer") : "User"}
            </Text>
          </View>
        </View>

        {/* === KELOMPOK INFORMASI PRIBADI === */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            {t("profile.personalInformation")}
          </Text>
          <View style={[styles.menuGroup, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="person-outline" size={20} color={theme.primary} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Nama Lengkap</Text>
              </View>
              <Text style={[styles.menuItemValue, { color: theme.textSecondary }]} numberOfLines={1}>
                {user?.fullName || "-"}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="mail-outline" size={20} color={theme.primary} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Email</Text>
              </View>
              <Text style={[styles.menuItemValue, { color: theme.textSecondary }]} numberOfLines={1}>
                {user?.email || "-"}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="call-outline" size={20} color={theme.primary} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>No. Telepon</Text>
              </View>
              <Text style={[styles.menuItemValue, { color: theme.textSecondary }]}>
                {user?.phone || "-"}
              </Text>
            </View>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="location-outline" size={20} color={theme.primary} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>Alamat</Text>
              </View>
              <Text style={[styles.menuItemValue, { color: theme.textSecondary }]} numberOfLines={1}>
                {user?.address || "-"}
              </Text>
            </View>
          </View>
        </View>

        {/* === KELOMPOK PENGATURAN APLIKASI === */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.textSecondary }]}>
            {t("profile.settings") || "PENGATURAN"}
          </Text>
          <View style={[styles.menuGroup, { backgroundColor: theme.card, borderColor: theme.border }]}>
            {/* Edit Profil */}
            <TouchableOpacity style={styles.menuItem} onPress={() => router.push("/editprofile")} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="create-outline" size={20} color={theme.primary} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>{t("profile.editProfile")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Pilihan Bahasa */}
            <TouchableOpacity style={styles.menuItem} onPress={() => setLangPickerVisible(true)} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="language-outline" size={20} color={theme.primary} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>{t("profile.language")}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{getLangLabel(i18n.language)}</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
              </View>
            </TouchableOpacity>
            <View style={[styles.divider, { backgroundColor: theme.border }]} />

            {/* Pilihan Tema */}
            <TouchableOpacity style={styles.menuItem} onPress={() => setThemePickerVisible(true)} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="color-palette-outline" size={20} color={theme.primary} />
                <Text style={[styles.menuItemText, { color: theme.text }]}>{t("profile.theme")}</Text>
              </View>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                <Text style={{ color: theme.textSecondary, fontSize: 14 }}>{getThemeLabel(themeMode)}</Text>
                <Ionicons name="chevron-forward" size={18} color={theme.textLight} />
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* === KELOMPOK AKSI === */}
        <View style={[styles.section, { marginBottom: 40 }]}>
          <View style={[styles.menuGroup, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <TouchableOpacity style={styles.menuItem} onPress={handleLogout} activeOpacity={0.7}>
              <View style={styles.menuItemLeft}>
                <Ionicons name="log-out-outline" size={20} color={theme.error} />
                <Text style={[styles.menuItemText, { color: theme.error, fontWeight: "700" }]}>{t("auth.logout")}</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.error + "80"} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Dropdowns */}
        <DropdownPicker
          visible={langPickerVisible}
          onClose={() => setLangPickerVisible(false)}
          title="Pilih Bahasa"
          options={[
            { key: "id", label: "Bahasa Indonesia" },
            { key: "en", label: "English" },
          ]}
          selectedValue={i18n.language}
          onSelect={handleLanguageChange}
          theme={theme}
        />

        <DropdownPicker
          visible={themePickerVisible}
          onClose={() => setThemePickerVisible(false)}
          title="Pilih Tema"
          options={[
            { key: "light", label: "Mode Terang" },
            { key: "dark", label: "Mode Gelap" },
            { key: "system", label: "Ikuti Sistem" },
          ]}
          selectedValue={themeMode}
          onSelect={(mode) => toggleTheme(mode as any)}
          theme={theme}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
  },
  profileSection: {
    alignItems: "center",
    paddingVertical: 16,
  },
  avatarContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    position: "relative",
  },
  avatar: {
    width: 98,
    height: 98,
    borderRadius: 49,
  },
  cameraIcon: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 2,
    borderColor: "#FFFFFF",
  },
  name: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 4,
  },
  email: {
    fontSize: 14,
    marginBottom: 8,
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: 12,
    fontWeight: "700",
  },
  section: {
    paddingHorizontal: 16,
    marginTop: 16,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 8,
    marginLeft: 4,
  },
  menuGroup: {
    borderRadius: 16,
    borderWidth: 0.5,
    overflow: "hidden",
  },
  menuItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 16,
    minHeight: 52,
  },
  menuItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: "500",
  },
  menuItemValue: {
    fontSize: 14,
    maxWidth: "55%",
  },
  divider: {
    height: 0.5,
    marginLeft: 48,
  },
  // Modal Bottom Sheet Picker Styles
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingBottom: 40,
    maxHeight: "50%",
  },
  modalHeader: {
    alignItems: "center",
    paddingVertical: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  modalHandle: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    marginBottom: 8,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalOptions: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  modalOptionItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderRadius: 8,
    marginVertical: 2,
  },
  modalOptionText: {
    fontSize: 15,
  },
});
