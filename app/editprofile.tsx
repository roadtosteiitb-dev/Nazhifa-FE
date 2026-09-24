import { useTranslation } from "react-i18next";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

const getInitials = (name: string) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

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

export default function EditProfileScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { user, updateUser, saveProfile, uploadPhoto } = useAuth();
  const [saving, setSaving] = useState(false);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [gender, setGender] = useState<"male" | "female" | "other">("male");
  const [genderPickerVisible, setGenderPickerVisible] = useState(false);
  const [avatar, setAvatar] = useState<string | null>(null);
  // Photo picked in this screen but not uploaded yet
  const [pickedPhoto, setPickedPhoto] = useState<ImagePicker.ImagePickerAsset | null>(null);

  // State untuk alamat dan koordinat
  const [address, setAddress] = useState("");
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    if (user) {
      setName(user.fullName || "");
      setEmail(user.email || "");
      setPhone(user.phone || "");
      if (user.dob) setDob(new Date(user.dob));
      if (user.gender) setGender(user.gender);
      if (user.photo) setAvatar(user.photo);
      if (user.address) setAddress(user.address);
      if (user.location)
        setLocation({ latitude: user.location.latitude, longitude: user.location.longitude });
    }
  }, [user]);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert(t("common.warning"), t("editProfile.nameRequired"));
      return;
    }
    setSaving(true);
    try {
      // Server: name / email / phone (+ photo) → users table
      await saveProfile({ fullName: name.trim(), email: email.trim(), phone: phone.trim() });
      if (pickedPhoto) {
        await uploadPhoto({ uri: pickedPhoto.uri, mimeType: pickedPhoto.mimeType, fileName: pickedPhoto.fileName });
      }
      // Device only: fields that have no column in the users table yet
      await updateUser({
        dob: dob.toISOString(),
        gender,
        address,
        location: location || undefined,
      });
      Alert.alert(t("common.success"), t("profile.updateSuccess"));
      router.back();
    } catch (error: any) {
      const errors = error?.response?.data?.errors;
      Alert.alert(
        t("common.failed"),
        errors ? (Object.values(errors).flat() as string[]).join("\n") : t("editProfile.saveFailed")
      );
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    router.back();
  };

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setAvatar(result.assets[0].uri);
      setPickedPhoto(result.assets[0]);
    }
  };

  // Ambil lokasi otomatis
  const getCurrentLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      alert(t("editProfile.locationPermission"));
      return;
    }

    const loc = await Location.getCurrentPositionAsync({});
    const coords = {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
    };
    setLocation(coords);

    // Ambil alamat dari koordinat
    const geocode = await Location.reverseGeocodeAsync(coords);
    if (geocode[0]) {
      const { street, district, city, region } = geocode[0];
      const formatted = `${street || ""} ${district || ""}, ${city || ""}, ${region || ""}`;
      setAddress(formatted.trim());
    }
  };

  // Kalau user tap di peta
  const handleMapPress = async (e: MapPressEvent) => {
    const coords = e.nativeEvent.coordinate;
    setLocation(coords);

    const geocode = await Location.reverseGeocodeAsync(coords);
    if (geocode[0]) {
      const { street, district, city, region } = geocode[0];
      const formatted = `${street || ""} ${district || ""}, ${city || ""}, ${region || ""}`;
      setAddress(formatted.trim());
    }
  };

  return (
    <SafeAreaView style={[styles.safeContainer, { backgroundColor: theme.background }]} edges={["top"]}>
      {/* HEADER ROW */}
      <View style={[styles.headerRow, { borderBottomColor: theme.border, backgroundColor: theme.card }]}>
        <TouchableOpacity onPress={handleCancel} style={styles.backButtonHeader}>
          <Ionicons name="chevron-back" size={26} color={theme.primary} />
        </TouchableOpacity>
        <Text style={[styles.headerTitleText, { color: theme.text }]}>{t("profile.editProfile")}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Avatar Wrapper */}
        <View style={styles.avatarSection}>
          <TouchableOpacity onPress={pickImage} activeOpacity={0.8} style={styles.avatarWrapper}>
            {avatar ? (
              <Image source={{ uri: avatar }} style={[styles.avatar, { borderColor: theme.primary, borderWidth: 2 }]} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: theme.surface, borderColor: theme.border, borderWidth: 1 }]}>
                <Text style={[styles.avatarFallbackText, { color: theme.text }]}>
                  {getInitials(name)}
                </Text>
              </View>
            )}
            <View style={[styles.cameraOverlay, { backgroundColor: theme.primary }]}>
              <Ionicons name="camera" size={16} color="#FFF" />
            </View>
          </TouchableOpacity>
        </View>

        {/* Form Card */}
        <View style={[styles.card, { backgroundColor: theme.card, borderColor: theme.border }]}>
          {/* Full Name */}
          <Text style={[styles.label, { color: theme.text }]}>{t("auth.fullName")}</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            placeholder={t("editProfile.enterName")}
            placeholderTextColor={theme.textSecondary}
            value={name}
            onChangeText={setName}
          />

          {/* Email */}
          <Text style={[styles.label, { color: theme.text }]}>{t("auth.email")}</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            placeholder={t("editProfile.enterEmail")}
            placeholderTextColor={theme.textSecondary}
            keyboardType="email-address"
            value={email}
            onChangeText={setEmail}
          />

          {/* Phone */}
          <Text style={[styles.label, { color: theme.text }]}>{t("auth.phone")}</Text>
          <TextInput
            style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.background }]}
            placeholder={t("editProfile.enterPhone")}
            placeholderTextColor={theme.textSecondary}
            keyboardType="phone-pad"
            value={phone}
            onChangeText={setPhone}
          />

          {/* Address */}
          <Text style={[styles.label, { color: theme.text }]}>{t("auth.address")}</Text>
          <View style={styles.addressRow}>
            <TextInput
              style={[
                styles.addressInput,
                { color: theme.text, borderColor: theme.border, backgroundColor: theme.background },
              ]}
              placeholder={t("editProfile.enterAddress")}
              placeholderTextColor={theme.textSecondary}
              value={address}
              onChangeText={setAddress}
            />
            <TouchableOpacity
              style={[styles.locateButton, { backgroundColor: theme.primary }]}
              onPress={getCurrentLocation}
              activeOpacity={0.8}
            >
              <Ionicons name="locate" size={18} color="#FFF" />
            </TouchableOpacity>
          </View>

          {/* Map View */}
          {location && (
            <View style={[styles.mapWrapper, { borderColor: theme.border }]}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: location.latitude,
                  longitude: location.longitude,
                  latitudeDelta: 0.01,
                  longitudeDelta: 0.01,
                }}
                onPress={handleMapPress}
              >
                <Marker coordinate={location} />
              </MapView>
            </View>
          )}

          {/* Date of Birth */}
          <Text style={[styles.label, { color: theme.text }]}>{t("editProfile.dob")}</Text>
          <TouchableOpacity
            style={[styles.dateButton, { borderColor: theme.border, backgroundColor: theme.background }]}
            onPress={() => setShowDatePicker(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.dateText, { color: theme.text }]}>
              {dob.toLocaleDateString("id-ID")}
            </Text>
            <Ionicons name="calendar-outline" size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          {/* iOS Date Picker in Premium Modal Sheet */}
          {showDatePicker && Platform.OS === "ios" && (
            <Modal transparent visible={showDatePicker} animationType="slide" onRequestClose={() => setShowDatePicker(false)}>
              <View style={styles.modalBackdrop}>
                <View style={[styles.modalSheet, { backgroundColor: theme.card }]}>
                  <View style={[styles.modalHeader, { flexDirection: "row", justifyContent: "space-between", paddingHorizontal: 16, alignItems: "center" }]}>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={{ color: theme.error, fontSize: 16, fontWeight: "600" }}>{t("common.cancel")}</Text>
                    </TouchableOpacity>
                    <Text style={[styles.modalTitle, { color: theme.text }]}>{t("editProfile.chooseDate")}</Text>
                    <TouchableOpacity onPress={() => setShowDatePicker(false)}>
                      <Text style={{ color: theme.primary, fontSize: 16, fontWeight: "600" }}>{t("editProfile.done")}</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={{ paddingVertical: 16 }}>
                    <DateTimePicker
                      value={dob}
                      mode="date"
                      display="spinner"
                      textColor={theme.text}
                      onChange={(event, selectedDate) => {
                        if (selectedDate) setDob(selectedDate);
                      }}
                    />
                  </View>
                </View>
              </View>
            </Modal>
          )}

          {/* Android Date Picker */}
          {showDatePicker && Platform.OS === "android" && (
            <DateTimePicker
              value={dob}
              mode="date"
              display="default"
              onChange={(event, selectedDate) => {
                setShowDatePicker(false);
                if (selectedDate) setDob(selectedDate);
              }}
            />
          )}

          {/* Gender (Custom Dropdown Selector) */}
          <Text style={[styles.label, { color: theme.text }]}>{t("editProfile.gender")}</Text>
          <TouchableOpacity
            style={[styles.dropdownTrigger, { borderColor: theme.border, backgroundColor: theme.background }]}
            onPress={() => setGenderPickerVisible(true)}
            activeOpacity={0.8}
          >
            <Text style={[styles.dropdownTriggerText, { color: theme.text }]}>
              {gender === "male" ? t("editProfile.male") : gender === "female" ? t("editProfile.female") : gender === "other" ? t("editProfile.other") : t("editProfile.chooseGender")}
            </Text>
            <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
          </TouchableOpacity>

          <DropdownPicker
            visible={genderPickerVisible}
            onClose={() => setGenderPickerVisible(false)}
            title={t("editProfile.chooseGender")}
            options={[
              { key: "male", label: t("editProfile.male") },
              { key: "female", label: t("editProfile.female") },
              { key: "other", label: t("editProfile.other") },
            ]}
            selectedValue={gender}
            onSelect={(val) => setGender(val as any)}
            theme={theme}
          />
        </View>

        {/* Buttons */}
        <View style={styles.buttonRow}>
          <TouchableOpacity
            style={[styles.cancelButton, { backgroundColor: theme.surface, borderColor: theme.border }]}
            onPress={handleCancel}
            activeOpacity={0.8}
          >
            <Text style={[styles.cancelButtonText, { color: theme.text }]}>{t("common.cancel")}</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.saveButton, { backgroundColor: theme.primary, opacity: saving ? 0.7 : 1 }]}
            onPress={handleSave}
            disabled={saving}
            activeOpacity={0.8}
          >
            {saving ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.saveButtonText}>{t("profile.saveChanges")}</Text>}
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
  },
  headerRow: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderBottomWidth: 0.5,
    elevation: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 2,
    position: "relative",
  },
  backButtonHeader: {
    position: "absolute",
    left: 12,
    padding: 8,
  },
  headerTitleText: {
    fontSize: 17,
    fontWeight: "700",
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 60,
  },
  avatarSection: {
    alignItems: "center",
    marginBottom: 20,
  },
  avatarWrapper: {
    position: "relative",
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  avatarFallback: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarFallbackText: {
    fontSize: 32,
    fontWeight: "700",
  },
  cameraOverlay: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  card: {
    borderRadius: 16,
    padding: 16,
    borderWidth: 0.5,
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
    marginTop: 4,
  },
  input: {
    borderWidth: 0.5,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 16,
    fontSize: 15,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 16,
  },
  addressInput: {
    flex: 1,
    borderWidth: 0.5,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
    fontSize: 15,
  },
  locateButton: {
    marginLeft: 10,
    width: 48,
    height: 48,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  mapWrapper: {
    width: "100%",
    height: 180,
    borderRadius: 12,
    marginBottom: 16,
    overflow: "hidden",
    borderWidth: 0.5,
  },
  map: {
    width: "100%",
    height: "100%",
  },
  dateButton: {
    borderWidth: 0.5,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dateText: {
    fontSize: 15,
  },
  dropdownTrigger: {
    borderWidth: 0.5,
    height: 48,
    paddingHorizontal: 12,
    borderRadius: 10,
    marginBottom: 16,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  dropdownTriggerText: {
    fontSize: 15,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 0.5,
  },
  cancelButtonText: {
    fontWeight: "700",
    fontSize: 15,
  },
  saveButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  saveButtonText: {
    fontWeight: "700",
    fontSize: 15,
    color: "#FFF",
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
