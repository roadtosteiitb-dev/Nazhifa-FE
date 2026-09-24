import { useTranslation } from "react-i18next";
import i18n from "../../utils/i18n";
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
  ActivityIndicator,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import MapView, { Marker, MapPressEvent } from "react-native-maps";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { useLands } from "../../contexts/LandContext";
import api from "../../services/apiClient";

const { width } = Dimensions.get("window");

const MAX_PHOTOS = 10;

type PropertyType = "house" | "apartment" | "villa";

const PROPERTY_TYPES: PropertyType[] = ["house", "apartment", "villa"];

const propertyTypeLabel = (key: PropertyType) => i18n.t(`property.type.${key}`);

const FURNISHED_KEYS = ["furnished", "semi", "unfurnished"];

type PickedImage = { uri: string; name: string; type: string };

const toPickedImage = (asset: ImagePicker.ImagePickerAsset): PickedImage => {
  const name = asset.fileName || asset.uri.split("/").pop() || `photo_${Date.now()}.jpg`;
  return { uri: asset.uri, name, type: asset.mimeType || "image/jpeg" };
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

export default function AddProperty() {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme } = useTheme();
  const { refreshLands } = useLands();

  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    images: [] as PickedImage[],
    listingType: "Dijual", // "Dijual" or "Disewa"
    propertyType: "house" as PropertyType,
    title: "",
    price: "",
    description: "",

    // Informasi Properti — 1:1 with columns of the `lands` table
    landArea: "",        // land_area (m², rumah & villa)
    buildingArea: "",    // building_area (m², luas unit untuk apartemen)
    floors: "",          // floors (rumah & villa)
    bedrooms: "",        // bedrooms
    bathrooms: "",       // bathrooms
    electricity: "",     // electricity (VA)
    certificate: "SHM",  // certificate
    garage: "",          // garage
    unitFloor: "",       // unit_floor (apartemen)
    unitType: "Studio",  // unit_type (apartemen)
    furnished: "unfurnished", // furnished: furnished | semi | unfurnished

    // Location
    address: "",
    latitude: -7.7956,   // Default Yogyakarta center
    longitude: 110.3695,

    // Legal Document Verification
    certificateImage: null as PickedImage | null,
  });

  // Dropdown Picker Visibility States
  const [certPickerVisible, setCertPickerVisible] = useState(false);
  const [unitTypePickerVisible, setUnitTypePickerVisible] = useState(false);
  const [furnishedPickerVisible, setFurnishedPickerVisible] = useState(false);
  const [typePickerVisible, setTypePickerVisible] = useState(false);

  const isApartment = form.propertyType === "apartment";

  type InfoField = "landArea" | "buildingArea" | "floors" | "bedrooms" | "bathrooms"
    | "electricity" | "garage" | "unitFloor";

  const renderField = (
    label: string,
    key: InfoField,
    placeholder: string,
    keyboardType: "default" | "number-pad" = "default"
  ) => (
    <>
      <Text style={[styles.fieldLabel, { color: theme.text }]}>{label}</Text>
      <TextInput
        style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
        placeholder={placeholder}
        placeholderTextColor={theme.textLight}
        keyboardType={keyboardType}
        value={form[key]}
        onChangeText={(text) =>
          setForm((p) => ({ ...p, [key]: keyboardType === "number-pad" ? text.replace(/[^\d]/g, "") : text }))
        }
      />
    </>
  );

  /* ================= IMAGE PICKER ================= */
  const pickImages = async () => {
    const remaining = MAX_PHOTOS - form.images.length;
    if (remaining <= 0) {
      Alert.alert(t("addProperty.photoLimitTitle"), t("addProperty.photoLimit", { max: MAX_PHOTOS }));
      return;
    }
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("addProperty.permissionTitle"), t("addProperty.galleryPermissionPhoto"));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsMultipleSelection: true,
      selectionLimit: remaining,
      orderedSelection: true,
      quality: 0.7,
    });
    if (!res.canceled && res.assets && res.assets.length > 0) {
      const picked = res.assets.map(toPickedImage);
      setForm((p) => ({ ...p, images: [...p.images, ...picked].slice(0, MAX_PHOTOS) }));
    }
  };

  const removeImage = (index: number) => {
    setForm((p) => ({ ...p, images: p.images.filter((_, i) => i !== index) }));
  };

  const makeCover = (index: number) => {
    setForm((p) => {
      const images = [...p.images];
      const [cover] = images.splice(index, 1);
      return { ...p, images: [cover, ...images] };
    });
  };

  const pickCertificateImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t("addProperty.permissionTitle"), t("addProperty.galleryPermissionCert"));
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      quality: 0.7,
      allowsEditing: true,
    });

    if (!res.canceled && res.assets && res.assets.length > 0) {
      setForm((p) => ({ ...p, certificateImage: toPickedImage(res.assets[0]) }));
    }
  };

  /* ================= AUTO LOCATION DETECTION ================= */
  const getCurrentLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(t("addProperty.permissionDenied"), t("addProperty.locationDenied"));
        return;
      }

      const loc = await Location.getCurrentPositionAsync({});
      const coords = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
      
      const geo = await Location.reverseGeocodeAsync(coords);
      let addressStr = t("addProperty.locationDetected");
      if (geo[0]) {
        const { street, district, city, region } = geo[0];
        addressStr = `${street || ""} ${district || ""}, ${city || ""}, ${region || ""}`.trim().replace(/^,|,$/g, "");
      }

      setForm((p) => ({
        ...p,
        latitude: coords.latitude,
        longitude: coords.longitude,
        address: addressStr || t("addProperty.locationDetected"),
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
        setForm((p) => ({ ...p, address: formatted || t("addProperty.locationSelected") }));
      }
    } catch (err) {
      console.warn(err);
    }
  };

  /* ================= SUBMIT / PUBLISH ================= */
  const handlePublish = async () => {
    if (isSubmitting) return;
    if (form.images.length === 0) return Alert.alert(t("common.warning"), t("addProperty.needPhoto"));
    if (!form.title.trim()) return Alert.alert(t("common.warning"), t("addProperty.needTitle"));
    if (!form.price.trim()) return Alert.alert(t("common.warning"), t("addProperty.needPrice"));
    if (!form.address.trim()) return Alert.alert(t("common.warning"), t("addProperty.needAddress"));

    const cleanPrice = parseFloat(form.price.replace(/[^\d]/g, ""));
    if (isNaN(cleanPrice)) return Alert.alert(t("common.warning"), t("addProperty.invalidPrice"));

    const body = new FormData();
    const append = (key: string, value?: string | number | null) => {
      if (value !== undefined && value !== null && value !== "") body.append(key, String(value));
    };

    append("name", form.title.trim());
    append("location", form.address.trim());
    append("price", cleanPrice);
    append("isForSale", form.listingType === "Dijual" ? "1" : "0");
    append("type", form.propertyType);
    append("description", form.description.trim() || t("addProperty.noDescription"));
    append("latitude", form.latitude);
    append("longitude", form.longitude);
    append("buildingArea", form.buildingArea);
    append("bedrooms", form.bedrooms);
    append("bathrooms", form.bathrooms);
    append("electricity", form.electricity);
    append("certificate", form.certificate);
    append("garage", form.garage.trim());
    append("furnished", form.furnished);

    if (isApartment) {
      append("unitFloor", form.unitFloor);
      append("unitType", form.unitType);
    } else {
      append("landArea", form.landArea);
      append("floors", form.floors);
    }

    // React Native FormData accepts { uri, name, type } objects as files
    form.images.forEach((img) => body.append("images[]", img as any));
    if (form.certificateImage) body.append("certificateImage", form.certificateImage as any);

    try {
      setIsSubmitting(true);
      await api.post("/lands", body, {
        headers: { "Content-Type": "multipart/form-data" },
        transformRequest: (data) => data,
        timeout: 120000,
      });
      await refreshLands();

      Alert.alert(t("common.success"), t("addProperty.submitted"), [
        { text: t("common.ok"), onPress: () => router.replace("/(tabsOwner)/homeOwner") },
      ]);
    } catch (error: any) {
      const errors = error.response?.data?.errors;
      const msg = errors
        ? (Object.values(errors).flat() as string[]).join("\n")
        : error.response?.data?.message || error.message || t("addProperty.submitFailed");
      Alert.alert(t("common.failed"), msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  /* ================= RENDER STEPS ================= */
  const StepIndicator = () => (
    <View style={styles.stepperContainer}>
      {[1, 2].map((s) => (
        <React.Fragment key={s}>
          <View style={[styles.stepItem, step === s && { borderColor: theme.primary }]}>
            <View style={[styles.stepDot, step >= s ? { backgroundColor: theme.primary } : { backgroundColor: theme.border }]}>
              <Text style={styles.stepNumberText}>{s}</Text>
            </View>
            <Text style={[styles.stepLabel, { color: step === s ? theme.text : theme.textSecondary }]}>
              {s === 1 ? t("addProperty.stepInfo") : t("addProperty.stepLocation")}
            </Text>
          </View>
          {s < 2 && <View style={[styles.stepConnector, { backgroundColor: step > s ? theme.primary : theme.border }]} />}
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
        <Text style={[styles.headerTitle, { color: theme.text }]}>{t("addProperty.title")}</Text>
        <View style={{ width: 40 }} />
      </View>

      <StepIndicator />

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* ================= STEP 1: INFORMASI DASAR ================= */}
        {step === 1 && (
          <View style={styles.formContainer}>
            {/* Foto Upload */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              Foto Properti ({form.images.length}/{MAX_PHOTOS})
            </Text>
            {form.images.length === 0 ? (
              <TouchableOpacity
                style={[styles.imageBox, { backgroundColor: theme.surface, borderColor: theme.border }]}
                onPress={pickImages}
                activeOpacity={0.8}
              >
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="images-outline" size={36} color={theme.textSecondary} />
                  <Text style={[styles.uploadText, { color: theme.textSecondary }]}>{t("addProperty.uploadPhotos")}</Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>Pilih hingga {MAX_PHOTOS} foto sekaligus</Text>
                </View>
              </TouchableOpacity>
            ) : (
              <>
                <View style={styles.photoGrid}>
                  {form.images.map((img, index) => (
                    <TouchableOpacity
                      key={`${img.uri}-${index}`}
                      style={[styles.photoTile, { borderColor: theme.border }]}
                      onPress={() => index > 0 && makeCover(index)}
                      activeOpacity={index > 0 ? 0.8 : 1}
                    >
                      <Image source={{ uri: img.uri }} style={styles.uploadedImage} />
                      {index === 0 && (
                        <View style={[styles.coverBadge, { backgroundColor: theme.primary }]}>
                          <Text style={styles.coverBadgeText}>{t("addProperty.cover")}</Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.removePhotoBtn}
                        onPress={() => removeImage(index)}
                        hitSlop={8}
                      >
                        <Ionicons name="close" size={14} color="#FFF" />
                      </TouchableOpacity>
                    </TouchableOpacity>
                  ))}
                  {form.images.length < MAX_PHOTOS && (
                    <TouchableOpacity
                      style={[styles.photoTile, styles.addPhotoTile, { borderColor: theme.border, backgroundColor: theme.surface }]}
                      onPress={pickImages}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="add" size={28} color={theme.textSecondary} />
                      <Text style={{ fontSize: 11, color: theme.textSecondary }}>{t("addProperty.add")}</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <Text style={{ fontSize: 11, color: theme.textSecondary, marginBottom: 8 }}>
                  {t("addProperty.tapToCover")}
                </Text>
              </>
            )}

            {/* Dokumen Sertifikat SHM Upload */}
            <Text style={[styles.fieldLabel, { color: theme.text, marginTop: 12 }]}>{t("addProperty.certificateFile")}</Text>
            <TouchableOpacity
              style={[styles.imageBox, { backgroundColor: theme.surface, borderColor: theme.border, height: 100 }]}
              onPress={pickCertificateImage}
              activeOpacity={0.8}
            >
              {form.certificateImage ? (
                <Image source={{ uri: form.certificateImage.uri }} style={styles.uploadedImage} />
              ) : (
                <View style={styles.uploadPlaceholder}>
                  <Ionicons name="document-text-outline" size={28} color={theme.primary} />
                  <Text style={[styles.uploadText, { color: theme.primary, fontWeight: "700" }]}>{t("addProperty.uploadCertificate")}</Text>
                  <Text style={{ fontSize: 11, color: theme.textSecondary }}>{t("addProperty.adminOnly")}</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Listing Type & Property Type */}
            <View style={styles.row}>
              <View style={styles.flexHalf}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>{t("maps.transactionType")}</Text>
                <View style={[styles.segmentRow, { backgroundColor: theme.surface, borderColor: theme.border }]}>
                  {["Dijual", "Disewa"].map((lt) => {
                    const active = form.listingType === lt;
                    return (
                      <TouchableOpacity
                        key={lt}
                        style={[styles.segmentBtn, active && { backgroundColor: theme.primary }]}
                        onPress={() => setForm({ ...form, listingType: lt })}
                      >
                        <Text style={[styles.segmentText, { color: active ? "#FFF" : theme.textSecondary }]}>
                          {lt === "Dijual" ? t("property.forSale") : t("property.forRent")}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              <View style={styles.flexHalf}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>{t("addProperty.propertyType")}</Text>
                <TouchableOpacity
                  style={[styles.selectTrigger, styles.typeTrigger, { borderColor: theme.border, backgroundColor: theme.card }]}
                  onPress={() => setTypePickerVisible(true)}
                >
                  <Text style={{ color: theme.text, fontSize: 13, fontWeight: "600" }}>
                    {propertyTypeLabel(form.propertyType)}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <DropdownPicker
              visible={typePickerVisible}
              onClose={() => setTypePickerVisible(false)}
              title={t("addProperty.choosePropertyType")}
              options={PROPERTY_TYPES.map((key) => ({ key, label: t(`property.type.${key}`) }))}
              selectedValue={form.propertyType}
              onSelect={(val) => setForm((p) => ({ ...p, propertyType: val as PropertyType }))}
              theme={theme}
            />

            {/* Judul Properti */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>{t("addProperty.listingTitle")}</Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
              placeholder={t("addProperty.listingTitlePlaceholder")}
              placeholderTextColor={theme.textLight}
              value={form.title}
              onChangeText={(text) => setForm({ ...form, title: text })}
            />

            {/* Harga */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>
              {t("addProperty.price")} {form.listingType === "Disewa" ? t("addProperty.perMonthParen") : "(Rp)"}
            </Text>
            <TextInput
              style={[styles.input, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
              placeholder={t("addProperty.example", { value: form.listingType === "Disewa" ? "3500000" : "1200000000" })}
              placeholderTextColor={theme.textLight}
              keyboardType="numeric"
              value={form.price}
              onChangeText={(text) => setForm({ ...form, price: text })}
            />

            {/* Deskripsi */}
            <Text style={[styles.fieldLabel, { color: theme.text }]}>{t("addProperty.description")}</Text>
            <TextInput
              style={[styles.input, styles.textArea, { color: theme.text, borderColor: theme.border, backgroundColor: theme.card }]}
              placeholder={t("addProperty.descriptionPlaceholder")}
              placeholderTextColor={theme.textLight}
              multiline
              numberOfLines={4}
              value={form.description}
              onChangeText={(text) => setForm({ ...form, description: text })}
            />

            {/* ================= INFORMASI PROPERTI (kolom tabel lands) ================= */}
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              {t("productDetail.propertyInfo")} ({propertyTypeLabel(form.propertyType)})
            </Text>

            <View style={styles.row}>
              {!isApartment && (
                <View style={styles.flexHalf}>
                  {renderField(t("addProperty.landArea"), "landArea", t("addProperty.example", { value: "120" }), "number-pad")}
                </View>
              )}
              <View style={styles.flexHalf}>
                {renderField(isApartment ? t("addProperty.unitArea") : t("addProperty.buildingArea"), "buildingArea", t("addProperty.example", { value: "90" }), "number-pad")}
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.flexHalf}>
                {renderField(t("productDetail.bedrooms"), "bedrooms", t("addProperty.bedroomsPlaceholder"), "number-pad")}
              </View>
              <View style={styles.flexHalf}>
                {renderField(t("productDetail.bathrooms"), "bathrooms", t("addProperty.bathroomsPlaceholder"), "number-pad")}
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.flexHalf}>
                {isApartment
                  ? renderField(t("addProperty.unitFloor"), "unitFloor", t("addProperty.example", { value: "12" }), "number-pad")
                  : renderField(t("addProperty.floors"), "floors", t("addProperty.example", { value: "2" }), "number-pad")}
              </View>
              <View style={styles.flexHalf}>
                {renderField(t("addProperty.electricity"), "electricity", t("addProperty.example", { value: "2200" }), "number-pad")}
              </View>
            </View>

            <View style={styles.row}>
              <View style={styles.flexHalf}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>{t("productDetail.certificate")}</Text>
                <TouchableOpacity
                  style={[styles.selectTrigger, { borderColor: theme.border, backgroundColor: theme.card }]}
                  onPress={() => setCertPickerVisible(true)}
                >
                  <Text style={{ color: theme.text, fontSize: 14 }}>{form.certificate}</Text>
                  <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
              <View style={styles.flexHalf}>
                <Text style={[styles.fieldLabel, { color: theme.text }]}>{t("addProperty.furnished")}</Text>
                <TouchableOpacity
                  style={[styles.selectTrigger, { borderColor: theme.border, backgroundColor: theme.card }]}
                  onPress={() => setFurnishedPickerVisible(true)}
                >
                  <Text style={{ color: theme.text, fontSize: 14 }}>
                    {t(`property.furnishedOption.${form.furnished}`)}
                  </Text>
                  <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.row}>
              {isApartment && (
                <View style={styles.flexHalf}>
                  <Text style={[styles.fieldLabel, { color: theme.text }]}>{t("addProperty.unitType")}</Text>
                  <TouchableOpacity
                    style={[styles.selectTrigger, { borderColor: theme.border, backgroundColor: theme.card }]}
                    onPress={() => setUnitTypePickerVisible(true)}
                  >
                    <Text style={{ color: theme.text, fontSize: 14 }}>{form.unitType}</Text>
                    <Ionicons name="chevron-down" size={18} color={theme.textSecondary} />
                  </TouchableOpacity>
                </View>
              )}
              <View style={styles.flexHalf}>
                {renderField(isApartment ? t("addProperty.parking") : t("addProperty.garage"), "garage", t("addProperty.garagePlaceholder"))}
              </View>
            </View>

            <DropdownPicker
              visible={certPickerVisible}
              onClose={() => setCertPickerVisible(false)}
              title={t("addProperty.chooseCertificate")}
              options={[
                { key: "SHM", label: t("addProperty.certSHM") },
                { key: "HGB", label: t("addProperty.certHGB") },
                { key: "Lainnya", label: t("addProperty.certOther") },
              ]}
              selectedValue={form.certificate}
              onSelect={(val) => setForm((p) => ({ ...p, certificate: val }))}
              theme={theme}
            />

            <DropdownPicker
              visible={unitTypePickerVisible}
              onClose={() => setUnitTypePickerVisible(false)}
              title={t("addProperty.chooseUnitType")}
              options={[
                { key: "Studio", label: "Studio" },
                { key: "1BR", label: t("addProperty.unit1BR") },
                { key: "2BR", label: t("addProperty.unit2BR") },
                { key: "3BR+", label: t("addProperty.unit3BR") },
              ]}
              selectedValue={form.unitType}
              onSelect={(val) => setForm((p) => ({ ...p, unitType: val }))}
              theme={theme}
            />

            <DropdownPicker
              visible={furnishedPickerVisible}
              onClose={() => setFurnishedPickerVisible(false)}
              title={t("addProperty.chooseFurnished")}
              options={FURNISHED_KEYS.map((key) => ({ key, label: t(`property.furnishedOption.${key}`) }))}
              selectedValue={form.furnished}
              onSelect={(val) => setForm((p) => ({ ...p, furnished: val }))}
              theme={theme}
            />

            {/* Next Button */}
            <TouchableOpacity style={[styles.actionBtn, { backgroundColor: theme.primary }]} onPress={() => setStep(2)}>
              <Text style={styles.actionBtnText}>{t("addProperty.nextToLocation")}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ================= STEP 2: LOKASI & PUBLISH ================= */}
        {step === 2 && (
          <View style={styles.formContainer}>
            <Text style={[styles.stepTitle, { color: theme.text }]}>{t("addProperty.locationTitle")}</Text>
            <Text style={[styles.stepSub, { color: theme.textSecondary }]}>{t("addProperty.locationSub")}</Text>

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
                placeholder={t("addProperty.addressPlaceholder")}
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
                onPress={() => setStep(1)}
              >
                <Text style={[styles.cancelBtnText, { color: theme.text }]}>{t("common.back")}</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.actionBtn, styles.flex2, { backgroundColor: theme.primary, opacity: isSubmitting ? 0.7 : 1 }]}
                onPress={handlePublish}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.actionBtnText}>{t("addProperty.publish")}</Text>
                )}
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
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  photoTile: {
    width: (width - 32 - 16) / 3,
    aspectRatio: 1,
    borderRadius: 12,
    borderWidth: 1,
    overflow: "hidden",
  },
  addPhotoTile: {
    borderStyle: "dashed",
    alignItems: "center",
    justifyContent: "center",
  },
  coverBadge: {
    position: "absolute",
    left: 6,
    bottom: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  coverBadgeText: {
    color: "#FFF",
    fontSize: 10,
    fontWeight: "700",
  },
  removePhotoBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 4,
  },
  typeTrigger: {
    paddingVertical: 9,
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
