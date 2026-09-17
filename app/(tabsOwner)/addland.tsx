import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Dimensions,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { useLands, Land } from "../../contexts/LandContext";

const { width } = Dimensions.get("window");

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

export default function AddProperty() {
  const router = useRouter();
  const { theme } = useTheme();
  const { user } = useAuth();
  const { setLands, addNotification } = useLands();

  const [step, setStep] = useState(1);

  const [form, setForm] = useState({
    image: "",
    listingType: "Dijual", // "Dijual" or "Disewa"
    propertyType: "Rumah", // "Rumah" or "Apartemen"
    title: "",
    price: "",
    description: "",
    facilities: [] as string[],

    // Specific specs for Rumah
    landSize: "",        // Luas Tanah (m2)
    buildingSize: "",    // Luas Bangunan (m2)
    floors: "",          // Jumlah Lantai
    bedrooms: "",        // Kamar Tidur
    bathrooms: "",       // Kamar Mandi
    electricity: "",     // Daya Listrik (VA)
    certificate: "SHM",  // Sertifikat (SHM, HGB, dll)
    garage: "",          // Garasi / Carport

    // Specific specs for Apartemen
    unitSize: "",        // Luas Unit (m2)
    unitFloor: "",       // Lantai Ke-
    unitType: "Studio",  // Tipe Unit (Studio, 1BR, 2BR, 3BR+)
    furnished: "unfurnished", // furnished, semi, unfurnished

    // Location
    address: "",
    latitude: -7.7956,   // Default Yogyakarta center
    longitude: 110.3695,

    // Legal Document Verification
    certificateImage: "",
  });

  // Dropdown Picker Visibility States
  const [certPickerVisible, setCertPickerVisible] = useState(false);
  const [unitTypePickerVisible, setUnitTypePickerVisible] = useState(false);
  const [furnishedPickerVisible, setFurnishedPickerVisible] = useState(false);

  /* ================= IMAGE PICKER ================= */
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Izin Diperlukan", "Mohon izinkan akses galeri untuk mengunggah foto.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
      base64: true,
    });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      const uri = res.assets[0].uri;
      setForm((p) => ({ ...p, image: uri }));
    }
  };

  const pickCertificateImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Izin Diperlukan", "Mohon izinkan akses galeri untuk mengunggah sertifikat.");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      quality: 0.7,
      allowsEditing: true,
      base64: true,
    });

    if (!res.canceled && res.assets && res.assets.length > 0) {
      const uri = res.assets[0].uri;
      setForm((p) => ({ ...p, certificateImage: uri }));
    }
  };

  /* ================= AUTO LOCATION DETECTION ================= */
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert("Izin Ditolak", "Izin lokasi ditolak. Anda dapat memposisikan pin secara manual.");
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      
      const geo = await Location.reverseGeocodeAsync(coords);
      let addressStr = "Lokasi terdeteksi";
      if (geo[0]) {
        const { street, district, city, region } = geo[0];
        addressStr = `${street || ""} ${district || ""}, ${city || ""}, ${region || ""}`.trim().replace(/^,|,$/g, "");
      }

      setForm((p) => ({
        ...p,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: addressStr || "Yogyakarta, Indonesia",
      }));
    } catch (e) {
      console.warn("Gagal mendapatkan lokasi:", e);
    }
  };

  useEffect(() => {
    getCurrentLocation();
  }, []);

  const handleMapPress = async (e: MapPressEvent) => {
    const coords = e.nativeEvent.coordinate;
    setForm((p) => ({ ...p, latitude: coords.latitude, longitude: coords.longitude }));
    try {
      const geo = await Location.reverseGeocodeAsync(coords);
      if (geo[0]) {
        const { street, district, city, region } = geo[0];
        const formatted = `${street || ""} ${district || ""}, ${city || ""}, ${region || ""}`.trim().replace(/^,|,$/g, "");
        setForm((p) => ({ ...p, address: formatted || "Lokasi terpilih" }));
      }
    } catch (err) {
      console.warn(err);
    }
  };

  /* ================= SUBMIT / PUBLISH ================= */
  const handlePublish = () => {
    if (!form.title.trim()) return Alert.alert("Peringatan", "Harap masukkan judul properti!");
    if (!form.price.trim()) return Alert.alert("Peringatan", "Harap masukkan harga!");
    if (!form.address.trim()) return Alert.alert("Peringatan", "Harap masukkan alamat lokasi!");

    const cleanPrice = parseFloat(form.price.replace(/[^\d]/g, ""));
    if (isNaN(cleanPrice)) return Alert.alert("Peringatan", "Harap masukkan harga yang valid!");

    const newId = Date.now().toString();

    // Differentiate area spec values
    const propertyArea =
      form.propertyType === "Rumah"
        ? {
            land: form.landSize ? `${form.landSize} m²` : "-",
            building: form.buildingSize ? `${form.buildingSize} m²` : "-",
          }
        : {
            building: form.unitSize ? `${form.unitSize} m²` : "-",
          };

    const newLand: Land = {
      id: newId,
      name: form.title,
      location: form.address,
      price: cleanPrice,
      isForSale: form.listingType === "Dijual",
      type: form.propertyType === "Rumah" ? "house" : "apartment",
      status: "Pending",
      owner: user?.fullName || "Owner",
      description: form.description || "Tidak ada deskripsi properti.",
      image: form.image || "https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800",
      images: form.image
        ? [form.image]
        : ["https://images.unsplash.com/photo-1570129477492-45c003edd2be?w=800"],
      area: propertyArea,
      facilities: form.facilities,
      coords: [{ latitude: form.latitude, longitude: form.longitude }],
      center: { latitude: form.latitude, longitude: form.longitude },

      // Rumah properties
      floors: form.propertyType === "Rumah" && form.floors ? parseInt(form.floors) : undefined,
      bedrooms: form.bedrooms ? parseInt(form.bedrooms) : undefined,
      bathrooms: form.bathrooms ? parseInt(form.bathrooms) : undefined,
      electricity: form.propertyType === "Rumah" && form.electricity ? parseInt(form.electricity) : undefined,
      certificate: form.propertyType === "Rumah" ? form.certificate : undefined,
      garage: form.propertyType === "Rumah" ? form.garage : undefined,
      // Apartemen properties
      unitFloor: form.propertyType === "Apartemen" && form.unitFloor ? parseInt(form.unitFloor) : undefined,
      unitType: form.propertyType === "Apartemen" ? form.unitType : undefined,
      furnished: form.propertyType === "Apartemen" ? (form.furnished as any) : undefined,

      // Legal Document Verification
      certificateImage: form.certificateImage || "https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?w=800&q=80",
      createdAt: new Date().toISOString().split("T")[0],
    };

    setLands((prev) => [newLand, ...prev]);

    // Send owner notification
    if (addNotification) {
      addNotification(newId, form.title, "submitted", user?.fullName || "Owner");
    }

    Alert.alert("Sukses", "Properti Anda berhasil diajukan dan sedang menunggu persetujuan administrator!", [
      {
        text: "OK",
        onPress: () => {
          router.replace("/(tabsOwner)/homeOwner");
        },
      },
    ]);
  };

  /* ================= UTILITY CONTROLS ================= */
  const toggleFacility = (facility: string) => {
    setForm((p) => {
      const exists = p.facilities.includes(facility);
      if (exists) {
        return { ...p, facilities: p.facilities.filter((f) => f !== facility) };
      } else {
        return { ...p, facilities: [...p.facilities, facility] };
      }
    });
  };

  /* ================= RENDER STEPS ================= */
  const StepIndicator = () => (
    <View style={styles.stepperContainer}>
      {[1, 2, 3].map((s) => (
        <React.Fragment key={s}>
          <View style={[styles.stepItem, step === s && { borderColor: theme.primary }]}>
            <View style={[styles.stepDot, step >= s ? { backgroundColor: theme.primary } : { backgroundColor: theme.border }]}>
              <Text style={styles.stepNumberText}>{s}</Text>
            </View>
            <Text style={[styles.stepLabel, { color: step === s ? theme.text : theme.textSecondary }]}>
              {s === 1 ? "Dasar" : s === 2 ? "Detail" : "Lokasi"}
            </Text>
          </View>
          {s < 3 && <View style={[styles.stepConnector, { backgroundColor: step > s ? theme.primary : theme.border }]} />}
        </React.Fragment>
      ))}
    </View>
  );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: theme.background }]} edges={["top"]}>
      {/* HEADER */}
      <View style={[styles.header, { borderBottomColor: theme.border }]}>
        <TouchableOpacity
          onPress={() => (step === 1 ? router.back() : setStep(step - 1))}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={24} color={theme.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.text }]}>Tambah Properti</Text>
        <View style={{ width: 40 }} />
      </View>

      <StepIndicator />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ================= STEP 1: INFORMASI DASAR ================= */}
        {step === 1 && (
          <View style={styles.formContainer}>
            {/* Foto Upload */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Foto Properti</Text>
            <TouchableOpacity
              style={[styles.imageBox, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={pickImage}
              activeOpacity={0.8}
            >
              {form.image ? (
                <Image source={{ uri: form.image }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="camera-outline" size={36} color={theme.textSecondary} />
                  <Text style={[styles.uploadText, { color: theme.textSecondary }]}>Unggah Foto Hunian</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Dokumen Sertifikat SHM Upload */}
            <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 12 }]}>Berkas Sertifikat SHM / Legalitas</Text>
            <TouchableOpacity
              style={[styles.imageBox, { backgroundColor: theme.surface, borderColor: theme.border, height: 100 }]}
              onPress={pickCertificateImage}
              activeOpacity={0.8}
            >
              {form.certificateImage ? (
                <Image source={{ uri: form.certificateImage }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="document-text-outline" size={28} color={theme.primary} />
                  <Text style={[styles.uploadText, { color: theme.primary, fontWeight: "700" }]}>Unggah Scan Sertifikat (SHM)</Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>Hanya dapat dilihat oleh Administrator</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Listing Type & Property Type */}
            <View style={styles.row}>
              <View style={styles.flexHalf}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Tipe Transaksi</Text>
                <View style={[styles.segmentRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {["Dijual", "Disewa"].map((t) => {
                    const active = form.listingType === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.segmentBtn, active && { backgroundColor: theme.primary }]}
                        onPress={() => setForm({ ...form, listingType: t })}
                      >
                        <Text style={[styles.segmentText, { color: active ? "#FFF" : theme.textSecondary }]}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.flexHalf}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>Tipe Hunian</Text>
                <View style={[styles.segmentRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {["Rumah", "Apartemen"].map((t) => {
                    const active = form.propertyType === t;
                    return (
                      <TouchableOpacity
                        key={t}
                        style={[styles.segmentBtn, active && { backgroundColor: theme.primary }]}
                        onPress={() => setForm({ ...form, propertyType: t })}
                      >
                        <Text style={[styles.segmentText, { color: active ? "#FFF" : theme.textSecondary }]}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Judul Properti */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Judul Iklan</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
              placeholder="Contoh: Rumah Minimalis Modern Dekat UGM"
              placeholderTextColor={theme.textLight}
              value={form.title}
              onChangeText={(text) => setForm({ ...form, title: text })}
            />

            {/* Harga */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              Harga {form.listingType === "Disewa" ? "(per Bulan)" : "(Rp)"}
            </Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
              placeholder={form.listingType === "Disewa" ? "Contoh: 3500000" : "Contoh: 1200000000"}
              placeholderTextColor={theme.textLight}
              keyboardType="numeric"
              value={form.price}
              onChangeText={(text) => setForm({ ...form, price: text })}
            />

            {/* Deskripsi */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Deskripsi Hunian</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
              placeholder="Tuliskan spesifikasi lengkap, kelebihan hunian, dsb..."
              placeholderTextColor={theme.textLight}
              multiline
              numberOfLines={4}
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
            />

            {/* Fasilitas Checkbox list */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>Fasilitas</Text>
            <View style={styles.facilitiesGrid}>
              {["AC", "Carport", "Garasi", "Garden", "Swimming Pool", "Gym", "Access Card", "Security 24h", "Kitchen Set", "Balkon"].map((fac) => {
                const active = form.facilities.includes(fac);
                return (
                  <TouchableOpacity
                    key={fac}
                    style={[styles.facilityChip, { borderColor: theme.border, backgroundColor: active ? theme.primary + "15" : theme.card }]}
                    onPress={() => toggleFacility(fac)}
                    activeOpacity={0.8}
                  >
                    <Ionicons
                      name={active ? "checkbox" : "square-outline"}
                      size={18}
                      color={active ? theme.primary : theme.textSecondary}
                    />
                    <Text style={[styles.facilityText, { color: active ? theme.primary : theme.text, fontWeight: active ? "700" : "400" }]}>
                      {fac}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Next Button */}
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={() => setStep(2)}>
              <Text style={styles.actionBtnText}>Lanjut ke Detail</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ================= STEP 2: SPESIFIKASI RUMAH / APARTEMEN ================= */}
        {step === 2 && (
          <View style={styles.formContainer}>
            <Text style={[styles.stepTitle, { color: theme.text }]}>Detail Hunian ({form.propertyType})</Text>

            {form.propertyType === "Rumah" ? (
              /* ================= INPUT RUMAH ================= */
              <View>
                <View style={styles.row}>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Luas Tanah (m²)</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                      placeholder="Contoh: 120"
                      keyboardType="numeric"
                      value={form.landSize}
                      onChangeText={(text) => setForm({ ...form, landSize: text })}
                    />
                  </View>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Luas Bangunan (m²)</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                      placeholder="Contoh: 90"
                      keyboardType="numeric"
                      value={form.buildingSize}
                      onChangeText={(text) => setForm({ ...form, buildingSize: text })}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Kamar Tidur</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                      placeholder="Jumlah KT"
                      keyboardType="numeric"
                      value={form.bedrooms}
                      onChangeText={(text) => setForm({ ...form, bedrooms: text })}
                    />
                  </View>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Kamar Mandi</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                      placeholder="Jumlah KM"
                      keyboardType="numeric"
                      value={form.bathrooms}
                      onChangeText={(text) => setForm({ ...form, bathrooms: text })}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Jumlah Lantai</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                      placeholder="Contoh: 2"
                      keyboardType="numeric"
                      value={form.floors}
                      onChangeText={(text) => setForm({ ...form, floors: text })}
                    />
                  </View>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Daya Listrik (VA)</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                      placeholder="Contoh: 2200"
                      keyboardType="numeric"
                      value={form.electricity}
                      onChangeText={(text) => setForm({ ...form, electricity: text })}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Sertifikat</Text>
                    <TouchableOpacity
                      style={[styles.selectTrigger, { borderColor: theme.border, backgroundColor: theme.card }]}
                      onPress={() => setCertPickerVisible(true)}
                    >
                      <Text style={{ color: theme.text, fontSize: 14 }}>{form.certificate}</Text>
                      <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Kapasitas Garasi</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                      placeholder="Contoh: 1 Mobil"
                      value={form.garage}
                      onChangeText={(text) => setForm({ ...form, garage: text })}
                    />
                  </View>
                </View>

                <DropdownPicker
                  visible={certPickerVisible}
                  onClose={() => setCertPickerVisible(false)}
                  title="Pilih Sertifikat"
                  options={[
                    { key: "SHM", label: "SHM - Hak Milik" },
                    { key: "HGB", label: "HGB - Hak Guna Bangunan" },
                    { key: "Lainnya", label: "Sertifikat Lainnya" },
                  ]}
                  selectedValue={form.certificate}
                  onSelect={(val) => setForm({ ...form, certificate: val })}
                  theme={theme}
                />
              </View>
            ) : (
              /* ================= INPUT APARTEMEN ================= */
              <View>
                <View style={styles.row}>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Luas Unit (m²)</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                      placeholder="Contoh: 45"
                      keyboardType="numeric"
                      value={form.unitSize}
                      onChangeText={(text) => setForm({ ...form, unitSize: text })}
                    />
                  </View>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Lantai Ke-</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                      placeholder="Contoh: 12"
                      keyboardType="numeric"
                      value={form.unitFloor}
                      onChangeText={(text) => setForm({ ...form, unitFloor: text })}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Kamar Tidur</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                      placeholder="Jumlah KT"
                      keyboardType="numeric"
                      value={form.bedrooms}
                      onChangeText={(text) => setForm({ ...form, bedrooms: text })}
                    />
                  </View>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Kamar Mandi</Text>
                    <TextInput
                      style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
                      placeholder="Jumlah KM"
                      keyboardType="numeric"
                      value={form.bathrooms}
                      onChangeText={(text) => setForm({ ...form, bathrooms: text })}
                    />
                  </View>
                </View>

                <View style={styles.row}>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Tipe Unit</Text>
                    <TouchableOpacity
                      style={[styles.selectTrigger, { borderColor: theme.border, backgroundColor: theme.card }]}
                      onPress={() => setUnitTypePickerVisible(true)}
                    >
                      <Text style={{ color: theme.text, fontSize: 14 }}>{form.unitType}</Text>
                      <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                  <View style={styles.flexHalf}>
                    <Text style={[styles.fieldLabel, { color: theme.text }]}>Furnished</Text>
                    <TouchableOpacity
                      style={[styles.selectTrigger, { borderColor: theme.border, backgroundColor: theme.card }]}
                      onPress={() => setFurnishedPickerVisible(true)}
                    >
                      <Text style={{ color: theme.text, fontSize: 14 }}>
                        {form.furnished === "furnished" ? "Full Furnished" : form.furnished === "semi" ? "Semi Furnished" : "Unfurnished"}
                      </Text>
                      <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                    </TouchableOpacity>
                  </View>
                </View>

                <DropdownPicker
                  visible={unitTypePickerVisible}
                  onClose={() => setUnitTypePickerVisible(false)}
                  title="Pilih Tipe Unit"
                  options={[
                    { key: "Studio", label: "Studio" },
                    { key: "1BR", label: "1BR (1 Kamar)" },
                    { key: "2BR", label: "2BR (2 Kamar)" },
                    { key: "3BR+", label: "3BR+ (3 Kamar atau Lebih)" },
                  ]}
                  selectedValue={form.unitType}
                  onSelect={(val) => setForm({ ...form, unitType: val })}
                  theme={theme}
                />

                <DropdownPicker
                  visible={furnishedPickerVisible}
                  onClose={() => setFurnishedPickerVisible(false)}
                  title="Pilih Kondisi Furnish"
                  options={[
                    { key: "furnished", label: "Fully Furnished" },
                    { key: "semi", label: "Semi Furnished" },
                    { key: "unfurnished", label: "Unfurnished" },
                  ]}
                  selectedValue={form.furnished}
                  onSelect={(val) => setForm({ ...form, furnished: val })}
                  theme={theme}
                />
              </View>
            )}

            {/* Navigation buttons */}
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn, { borderColor: theme.border }]}
                onPress={() => setStep(1)}
              >
                <Text style={[styles.cancelBtnText, { color: theme.text }]}>Kembali</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.flex2, { backgroundColor: theme.primary }]}
                onPress={() => setStep(3)}
              >
                <Text style={styles.actionBtnText}>Lanjut ke Lokasi</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* ================= STEP 3: LOKASI & PUBLISH ================= */}
        {step === 3 && (
          <View style={styles.formContainer}>
            <Text style={[styles.stepTitle, { color: theme.text }]}>Tentukan Lokasi Hunian</Text>
            <Text style={[styles.stepSub, { color: theme.textSecondary }]}>Geser marker di peta ke lokasi properti yang sesuai</Text>

            {/* Map */}
            <View style={[styles.mapWrapper, { borderColor: theme.border }]}>
              <MapView
                style={styles.map}
                initialRegion={{
                  latitude: form.latitude,
                  longitude: form.longitude,
                  latitudeDelta: 0.02,
                  longitudeDelta: 0.02,
                }}
                onPress={handleMapPress}
              >
                <Marker
                  draggable
                  coordinate={{ latitude: form.latitude, longitude: form.longitude }}
                  onDragEnd={(e) => {
                    const coords = e.nativeEvent.coordinate;
                    handleMapPress({ nativeEvent: { coordinate: coords } } as any);
                  }}
                />
              </MapView>
            </View>

            {/* Address Row and Locate Button */}
            <View style={styles.addressRow}>
              <TextInput
                style={[
                  styles.addressInput,
                  { color: theme.text, borderColor: theme.border, backgroundColor: theme.card },
                ]}
                placeholder="Alamat lengkap hunian..."
                placeholderTextColor={theme.textLight}
                value={form.address}
                onChangeText={(text) => setForm({ ...form, address: text })}
              />
              <TouchableOpacity
                style={[styles.locateButton, { backgroundColor: theme.primary }]}
                onPress={getCurrentLocation}
                activeOpacity={0.8}
              >
                <Ionicons name="locate" size={18} color="#FFF" />
              </TouchableOpacity>
            </View>

            {/* Action buttons */}
            <View style={styles.buttonGroup}>
              <TouchableOpacity
                style={[styles.actionBtn, styles.cancelBtn, { borderColor: theme.border }]}
                onPress={() => setStep(2)}
              >
                <Text style={[styles.cancelBtnText, { color: theme.text }]}>Kembali</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.flex2, { backgroundColor: theme.primary }]}
                onPress={handlePublish}
              >
                <Text style={styles.actionBtnText}>Publish Hunian</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  header: {
    height: 56,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  scrollContent: {
    paddingBottom: 40,
  },
  // Stepper UI
  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 14,
    paddingHorizontal: 24,
  },
  stepItem: {
    alignItems: "center",
    width: 60,
  },
  stepDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  stepNumberText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  stepLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 4,
  },
  stepConnector: {
    flex: 1,
    height: 2,
    marginHorizontal: 8,
  },
  formContainer: {
    paddingHorizontal: 16,
  },
  fieldLabel: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 6,
    marginTop: 12,
  },
  imageBox: {
    height: 180,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
    borderWidth: 1,
    borderStyle: "dashed",
  },
  uploadedImage: {
    width: "100%",
    height: "100%",
    borderRadius: 12,
  },
  uploadPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  uploadText: {
    fontSize: 13,
    marginTop: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  flexHalf: {
    flex: 1,
    marginHorizontal: 4,
  },
  segmentRow: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 6,
  },
  segmentText: {
    fontSize: 12,
    fontWeight: "600",
  },
  input: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: 12,
    padding: 14,
    fontSize: 14,
    backgroundColor: "#fff",
    marginBottom: 12,
  },
  textArea: {
    height: 100,
    textAlignVertical: "top",
  },
  facilitiesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 8,
  },
  facilityChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
  facilityText: {
    fontSize: 12,
  },
  actionBtn: {
    padding: 16,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 20,
  },
  actionBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 16,
    marginTop: 8,
  },
  stepSub: {
    fontSize: 12,
    marginBottom: 16,
  },
  selectTrigger: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
  },
  buttonGroup: {
    flexDirection: "row",
    gap: 12,
    marginTop: 20,
  },
  cancelBtn: {
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
  },
  cancelBtnText: {
    fontWeight: "600",
  },
  flex2: {
    flex: 2,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    paddingVertical: 14,
  },
  mapWrapper: {
    height: 200,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    marginBottom: 12,
  },
  map: {
    height: "100%",
    width: "100%",
  },
  addressRow: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    marginTop: 12,
  },
  addressInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
  },
  locateButton: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
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
