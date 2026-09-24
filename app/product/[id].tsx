import { useTranslation } from "react-i18next";
import i18n from "../../utils/i18n";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Marker, PROVIDER_GOOGLE } from "react-native-maps";
import { SafeAreaView } from "react-native-safe-area-context";

import { DisasterDonutChart } from "../../components/gis/DisasterDonutChart";
import { RouteModal, openExternalDirections } from "../../components/gis/RouteModal";
import { useAuth } from "../../contexts/AuthContext";
import { useChat } from "../../contexts/ChatContext";
import { useBookmark } from "../../contexts/BookmarkContext";
import {
  BackendRiskApiResponse,
  DISASTER_LAYERS,
  NUMERIC_RISK_MAP,
  NumericRiskCode,
} from "../../data/riskData";
import { fetchLandById, ApiLand } from "../../services/PropertyService";
import { fetchRiskAnalysis } from "../../services/RiskService";
import { fetchNearestFacilities, NearestFacility } from "../../services/FacilityService";

const { width: screenWidth } = Dimensions.get("window");
const PLACEHOLDER_IMAGE = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800";

// Risk level 1/2/3 → translation key + emoji
const RISK_KEY: Record<number, string> = { 1: "risk.lowRisk", 2: "risk.mediumRisk", 3: "risk.highRisk" };
const RISK_EMOJI: Record<number, string> = { 1: "🟢", 2: "🟡", 3: "🔴" };

// land_area / building_area are stored as plain numbers ("160"); older rows may already include the unit
const formatArea = (value?: string | null) => {
  if (!value) return "—";
  return /^\d+([.,]\d+)?$/.test(value.trim()) ? `${value.trim()} m²` : value;
};

/* ─── Loading Skeleton Component ─────────────────────────────────────────── */
const SectionSkeleton = ({ lines = 3 }: { lines?: number }) => (
  <View style={{ gap: 8, padding: 4 }}>
    {Array.from({ length: lines }).map((_, i) => (
      <View
        key={i}
        style={{
          height: 14,
          borderRadius: 7,
          backgroundColor: "#E5E7EB",
          width: i === lines - 1 ? "60%" : "100%",
        }}
      />
    ))}
  </View>
);

/* ─── Error Section Component ─────────────────────────────────────────────── */
const SectionError = ({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) => (
  <View style={styles.sectionErrorBox}>
    <Ionicons name="warning-outline" size={20} color="#DC2626" />
    <Text style={styles.sectionErrorText}>{message}</Text>
    <TouchableOpacity onPress={onRetry} style={styles.sectionRetryBtn}>
      <Text style={styles.sectionRetryText}>{i18n.t("common.retry")}</Text>
    </TouchableOpacity>
  </View>
);

/* ─── Main Component ──────────────────────────────────────────────────────── */
export default function ProductDetail() {
  const { t } = useTranslation();
  const router = useRouter();
  const params = useLocalSearchParams();
  const idParam = params.id ? String(params.id) : "";

  const { user } = useAuth();
  const { getOrCreateConversation } = useChat();
  const { isFavorite, toggleFavorite } = useBookmark();
  const isBuyerOrGuest = !user || (user.userType !== "owner" && user.userType !== "admin");

  // ── Property detail from GET /api/lands/{id} ──
  const [property, setProperty] = useState<ApiLand | null>(null);
  const [isLoadingProperty, setIsLoadingProperty] = useState(true);
  const [propertyError, setPropertyError] = useState<string | null>(null);

  // ── Risk from GET /api/lands/{id}/risk ──
  const [riskData, setRiskData] = useState<BackendRiskApiResponse | null>(null);
  const [isLoadingRisk, setIsLoadingRisk] = useState(true);
  const [riskError, setRiskError] = useState<string | null>(null);

  // ── Facilities from GET /api/lands/{id}/facilities ──
  const [facilities, setFacilities] = useState<NearestFacility[]>([]);
  const [isLoadingFacilities, setIsLoadingFacilities] = useState(true);
  const [facilitiesError, setFacilitiesError] = useState<string | null>(null);

  // ── UI state ──
  const [selectedImage, setSelectedImage] = useState<string | undefined>(undefined);
  const [descExpanded, setDescExpanded] = useState(false);

  /* ── Fetch property detail ── */
  const loadProperty = async () => {
    if (!idParam) return;
    setIsLoadingProperty(true);
    setPropertyError(null);
    try {
      const data = await fetchLandById(idParam);
      setProperty(data);
    } catch (err: any) {
      console.error("Property fetch error:", err);
      setPropertyError(t("productDetail.loadError"));
    } finally {
      setIsLoadingProperty(false);
    }
  };

  /* ── Fetch risk analysis ── */
  const loadRisk = async () => {
    if (!idParam) return;
    setIsLoadingRisk(true);
    setRiskError(null);
    try {
      const data = await fetchRiskAnalysis(idParam);
      setRiskData(data);
    } catch (err: any) {
      console.error("Risk fetch error:", err);
      setRiskError(t("productDetail.riskLoadError"));
    } finally {
      setIsLoadingRisk(false);
    }
  };

  /* ── Fetch nearest facilities ── */
  const loadFacilities = async () => {
    if (!idParam) return;
    setIsLoadingFacilities(true);
    setFacilitiesError(null);
    try {
      const data = await fetchNearestFacilities(idParam);
      setFacilities(data);
    } catch (err: any) {
      console.error("Facilities fetch error:", err);
      setFacilitiesError(t("productDetail.facilitiesLoadError"));
    } finally {
      setIsLoadingFacilities(false);
    }
  };

  useEffect(() => {
    if (!idParam) return;
    loadProperty();
    loadRisk();
    loadFacilities();
  }, [idParam]);

  /* ── Guard: inaccessible property ── */
  useEffect(() => {
    if (property && isBuyerOrGuest && property.status !== "Approved" && property.status !== "Sold") {
      Alert.alert(
        t("productDetail.unavailableTitle"),
        t("productDetail.unavailableText"),
        [{ text: t("common.back"), onPress: () => router.back() }]
      );
    }
  }, [property, isBuyerOrGuest]);

  /* ── Bookmark (server-backed via BookmarkContext) ── */
  const isBookmarked = isFavorite(idParam);

  const toggleBookmark = async () => {
    if (!user) {
      Alert.alert(t("common.loginRequired"), t("favorites.loginToSave"), [
        { text: t("common.later"), style: "cancel" },
        { text: t("auth.login"), onPress: () => router.push("/auth/login") },
      ]);
      return;
    }
    try {
      await toggleFavorite(idParam);
    } catch {
      Alert.alert(t("common.failed"), t("favorites.updateFailed"));
    }
  };

  /* ── Share ── */
  const handleShare = async () => {
    if (!property) return;
    try {
      await Share.share({
        message: `${property.name} (${property.location}) • Rp ${(property.price ?? 0).toLocaleString("id-ID")}`,
      });
    } catch {}
  };

  /* ── Route/Contact ── */
  const [routeFacility, setRouteFacility] = useState<NearestFacility | null>(null);

  // Facility "Route" button → in-app road route from the property to that facility
  const handleFacilityRoute = (fac: NearestFacility) => {
    if (!property?.center) {
      Alert.alert(t("common.route"), t("productDetail.noCoordinates"));
      return;
    }
    setRouteFacility(fac);
  };

  // Footer "View Route" → navigation from the user's current location to the property
  const handleViewRoute = () => {
    if (!property?.center) {
      Alert.alert(t("common.route"), t("productDetail.noCoordinates"));
      return;
    }
    openExternalDirections(property.center);
  };

  const [isOpeningChat, setIsOpeningChat] = useState(false);

  const handleContactAgent = async () => {
    if (!property || isOpeningChat) return;
    if (!user) {
      Alert.alert(t("common.loginRequired"), t("productDetail.loginToChat"), [
        { text: t("common.later"), style: "cancel" },
        { text: t("auth.login"), onPress: () => router.push("/auth/login") },
      ]);
      return;
    }
    if (property.ownerId && property.ownerId === user.id) {
      Alert.alert(t("productDetail.ownPropertyTitle"), t("productDetail.ownPropertyText"));
      return;
    }
    setIsOpeningChat(true);
    try {
      const conv = await getOrCreateConversation({
        buyerId: user.id,
        buyerName: user.fullName || "",
        ownerId: property.ownerId || "owner",
        ownerName: property.owner || t("chat.propertyOwner"),
        propertyId: String(property.id),
        propertyTitle: property.name,
        propertyImage: property.image || PLACEHOLDER_IMAGE,
        propertyPrice: property.price || 0,
        propertyLocation: property.location || "Yogyakarta",
        propertyStatus: property.status || "Approved",
      });
      router.push({
        pathname: "/ChatRoom",
        params: {
          chatId: conv.id,
          propertyId: String(property.id),
          propertyTitle: property.name,
          ownerName: conv.ownerName,
        },
      });
    } catch (error: any) {
      Alert.alert(
        t("productDetail.chatOpenError"),
        error?.response?.data?.error || t("common.connectionError")
      );
    } finally {
      setIsOpeningChat(false);
    }
  };

  /* ── Derived values ── */
  const imageList: string[] = [
    ...(property?.images ?? []),
    ...(property?.image ? [property.image] : []),
  ].filter(Boolean) as string[];
  if (imageList.length === 0) imageList.push(PLACEHOLDER_IMAGE);

  const heroImage = selectedImage || imageList[0];

  const riskApiResponse: BackendRiskApiResponse = riskData ?? {
    overallRisk: 1 as NumericRiskCode,
    risk: { flood: 1, landslide: 1, eruption: 1, extreme_weather: 1, drought: 1, liquefaction: 1 },
    distribution: { low: 6, medium: 0, high: 0 },
  };
  const overallRiskInfo = NUMERIC_RISK_MAP[riskApiResponse.overallRisk] ?? NUMERIC_RISK_MAP[1];

  /* ── Loading/Error screen for main property ── */
  if (isLoadingProperty) {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <View style={[styles.topHeader]}>
          <TouchableOpacity style={styles.circleBackBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 12 }}>
          <ActivityIndicator size="large" color="#2E7D32" />
          <Text style={{ fontSize: 14, color: "#6B7280" }}>{t("productDetail.loading")}</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (propertyError || !property) {
    return (
      <SafeAreaView style={styles.safeContainer}>
        <View style={styles.topHeader}>
          <TouchableOpacity style={styles.circleBackBtn} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={20} color="#111827" />
          </TouchableOpacity>
        </View>
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 32 }}>
          <Ionicons name="cloud-offline-outline" size={48} color="#9CA3AF" />
          <Text style={{ fontSize: 16, fontWeight: "700", color: "#374151", textAlign: "center" }}>
            {propertyError ?? t("productDetail.notFound")}
          </Text>
          <TouchableOpacity onPress={loadProperty} style={styles.sectionRetryBtn}>
            <Text style={styles.sectionRetryText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  /* ── Full render ── */
  return (
    <SafeAreaView style={styles.safeContainer}>
      {/* HEADER BAR */}
      <View style={styles.topHeader}>
        <TouchableOpacity style={styles.circleBackBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={20} color="#111827" />
        </TouchableOpacity>

        <View style={styles.topHeaderRight}>
          <TouchableOpacity style={styles.circleBackBtn} onPress={toggleBookmark}>
            <Ionicons
              name={isBookmarked ? "heart" : "heart-outline"}
              size={20}
              color={isBookmarked ? "#DC2626" : "#111827"}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.circleBackBtn} onPress={handleShare}>
            <Ionicons name="share-social-outline" size={18} color="#111827" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 100 }}>

        {/* =========================================
            SECTION 1: HERO IMAGE & PRIMARY METADATA
           ========================================= */}
        <View style={styles.heroWrap}>
          <Image source={{ uri: heroImage }} style={styles.heroImage} />

          {imageList.length > 1 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.thumbScroll}
              contentContainerStyle={{ gap: 8, paddingHorizontal: 16 }}
            >
              {imageList.map((imgUrl, idx) => {
                const isActive = imgUrl === heroImage;
                return (
                  <TouchableOpacity
                    key={`${imgUrl}-${idx}`}
                    onPress={() => setSelectedImage(imgUrl)}
                    activeOpacity={0.85}
                    style={[styles.thumbCard, { borderColor: isActive ? "#2E7D32" : "#FFFFFF" }]}
                  >
                    <Image source={{ uri: imgUrl }} style={styles.thumbImage} />
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>

        <View style={styles.sectionContainer}>
          <Text style={styles.propertyTitle}>{property.name}</Text>

          <View style={styles.addressRow}>
            <Ionicons name="location-outline" size={16} color="#6B7280" />
            <Text style={styles.addressText}>{property.location}</Text>
          </View>

          <View style={styles.priceRow}>
            <Text style={styles.priceText}>
              Rp {(property.price ?? 0).toLocaleString("id-ID")}
            </Text>
            <View style={styles.transBadge}>
              <Text style={styles.transBadgeText}>
                {property.isForSale ? t("property.forSaleBadge") : t("property.forRentBadge")}
              </Text>
            </View>
          </View>
        </View>

        {/* =========================================
            SECTION 2: PROPERTY INFORMATION
           ========================================= */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="information-circle-outline" size={18} color="#2E7D32" />
            <Text style={styles.cardSectionTitle}>{t("productDetail.propertyInfo")}</Text>
          </View>

          <View style={styles.specsGrid}>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>{t("productDetail.type")}</Text>
              <Text style={styles.specVal}>{property.type ? t(`property.type.${property.type}`, { defaultValue: property.type }).toUpperCase() : "—"}</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>{t("productDetail.landArea")}</Text>
              <Text style={styles.specVal}>{formatArea(property.area?.land)}</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>{t("productDetail.buildingArea")}</Text>
              <Text style={styles.specVal}>{formatArea(property.area?.building)}</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>{t("productDetail.bedrooms")}</Text>
              <Text style={styles.specVal}>{property.bedrooms ?? "—"}</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>{t("productDetail.bathrooms")}</Text>
              <Text style={styles.specVal}>{property.bathrooms ?? "—"}</Text>
            </View>
            <View style={styles.specBox}>
              <Text style={styles.specLabel}>{t("productDetail.garage")}</Text>
              <Text style={styles.specVal}>{property.garage ?? "—"}</Text>
            </View>
            <View style={[styles.specBox, { width: "100%" }]}>
              <Text style={styles.specLabel}>{t("productDetail.certificate")}</Text>
              <Text style={styles.specVal}>{property.certificate ?? "—"}</Text>
            </View>
            {property.owner && (
              <View style={[styles.specBox, { width: "100%" }]}>
                <Text style={styles.specLabel}>{t("productDetail.owner")}</Text>
                <Text style={styles.specVal}>{property.owner}</Text>
              </View>
            )}
          </View>

          {property.description ? (
            <>
              <Text style={[styles.specLabel, { marginTop: 12 }]}>{t("productDetail.description")}</Text>
              <Text style={styles.descText} numberOfLines={descExpanded ? undefined : 3}>
                {property.description}
              </Text>
              <TouchableOpacity onPress={() => setDescExpanded(!descExpanded)}>
                <Text style={styles.readMoreBtn}>{descExpanded ? t("productDetail.collapse") : t("productDetail.readMore")}</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </View>

        {/* =========================================
            SECTION 3: INTERACTIVE MINI MAP
           ========================================= */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="map-outline" size={18} color="#2E7D32" />
            <Text style={styles.cardSectionTitle}>{t("productDetail.miniMap")}</Text>
          </View>

          {property.center ? (
            <>
              <View style={styles.miniMapWrap}>
                <MapView
                  provider={PROVIDER_GOOGLE}
                  style={StyleSheet.absoluteFillObject}
                  initialRegion={{
                    latitude: property.center.latitude,
                    longitude: property.center.longitude,
                    latitudeDelta: 0.012,
                    longitudeDelta: 0.012,
                  }}
                  pitchEnabled={false}
                  rotateEnabled={false}
                  scrollEnabled={false}
                  zoomEnabled={false}
                >
                  <Marker coordinate={property.center} title={property.name} />
                </MapView>

                <TouchableOpacity
                  style={styles.fullscreenMapBtn}
                  onPress={() => router.push({ pathname: "/maps", params: { focusId: String(property.id) } })}
                  activeOpacity={0.85}
                >
                  <Ionicons name="expand-outline" size={14} color="#FFFFFF" />
                  <Text style={styles.fullscreenMapText}>{t("productDetail.fullscreenMap")}</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.coordsRow}>
                <Ionicons name="compass-outline" size={14} color="#6B7280" />
                <Text style={styles.coordsText}>
                  {t("productDetail.coordinates")}: {property.center.latitude.toFixed(4)},{" "}
                  {property.center.longitude.toFixed(4)}
                </Text>
              </View>
            </>
          ) : (
            <View style={styles.sectionErrorBox}>
              <Ionicons name="map-outline" size={20} color="#9CA3AF" />
              <Text style={styles.sectionErrorText}>
                {t("productDetail.noCoordinates")}
              </Text>
            </View>
          )}
        </View>

        {/* =========================================
            SECTION 4: ACCESSIBILITY ANALYSIS (pgRouting)
           ========================================= */}
        <View style={styles.cardSection}>
          <View style={styles.sectionHeaderRow}>
            <Ionicons name="navigate-outline" size={18} color="#2E7D32" />
            <Text style={styles.cardSectionTitle}>{t("productDetail.accessibility")}</Text>
          </View>
          <Text style={styles.sectionSubTitle}>
            {t("productDetail.accessibilitySub")}
          </Text>

          {isLoadingFacilities ? (
            <SectionSkeleton lines={4} />
          ) : facilitiesError ? (
            <SectionError message={facilitiesError} onRetry={loadFacilities} />
          ) : facilities.length === 0 ? (
            <View style={styles.sectionErrorBox}>
              <Ionicons name="location-outline" size={20} color="#9CA3AF" />
              <Text style={styles.sectionErrorText}>
                {t("productDetail.noFacilities")}
              </Text>
            </View>
          ) : (
            <View style={styles.facilityList}>
              {facilities.map((fac, idx) => (
                <View key={`${fac.name}-${idx}`} style={styles.facilityCard}>
                  <View style={styles.facilityIconBox}>
                    <Ionicons name={fac.icon as any} size={18} color="#2E7D32" />
                  </View>

                  <View style={styles.facilityMetaCol}>
                    <Text style={styles.facilityCategoryText}>{t(`facilityCategory.${fac.category}`, { defaultValue: fac.category })}</Text>
                    <Text style={styles.facilityNameText} numberOfLines={1}>
                      {fac.name}
                    </Text>
                    <Text style={styles.facilityDistText}>
                      📍 {fac.distanceKm} km • ⏱ ~{t("route.minutes", { count: fac.travelTimeMinutes })}
                    </Text>
                  </View>

                  <TouchableOpacity
                    style={styles.routeBtn}
                    onPress={() => handleFacilityRoute(fac)}
                    activeOpacity={0.8}
                  >
                    <Ionicons name="git-network-outline" size={14} color="#2E7D32" />
                    <Text style={styles.routeBtnText}>{t("common.route")}</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* =========================================
            SECTION 5: DISASTER RISK ANALYSIS (InaRISK & PostGIS)
           ========================================= */}
        <View style={styles.cardSection}>

          {/* 1. OVERALL DISASTER RISK CARD */}
          <View style={styles.overallRiskCard}>
            <View style={styles.overallRiskHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.overallTitle}>{t("productDetail.riskTitle")}</Text>
                <Text style={styles.overallSubtitle}>
                  {t("productDetail.riskSubtitle")}
                </Text>
              </View>
            </View>

            {isLoadingRisk ? (
              <View style={{ marginTop: 12 }}>
                <SectionSkeleton lines={2} />
              </View>
            ) : riskError ? (
              <View style={{ marginTop: 12 }}>
                <SectionError message={riskError} onRetry={loadRisk} />
              </View>
            ) : (
              <View style={styles.overallStatusRow}>
                <Text style={styles.overallStatusLabel}>{t("productDetail.overallStatus")}</Text>
                <View style={[styles.overallBadge, { backgroundColor: overallRiskInfo.bg }]}>
                  <Text style={[styles.overallBadgeText, { color: overallRiskInfo.color }]}>
                    {RISK_EMOJI[riskApiResponse.overallRisk] ?? "🟢"} {t("productDetail.riskArea", { level: t(RISK_KEY[riskApiResponse.overallRisk] ?? "risk.lowRisk") })}
                  </Text>
                </View>
              </View>
            )}

            <Text style={styles.overallDesc}>
              {t("productDetail.riskNote")}
            </Text>
          </View>

          {/* 2. DISASTER DETAIL CARDS */}
          <Text style={styles.subSectionTitle}>{t("productDetail.exposureCards")}</Text>
          {isLoadingRisk ? (
            <SectionSkeleton lines={3} />
          ) : riskError ? (
            <SectionError message={riskError} onRetry={loadRisk} />
          ) : (
            <View style={styles.disasterGrid}>
              {DISASTER_LAYERS.map((layer) => {
                const numericVal: NumericRiskCode =
                  (riskApiResponse.risk as any)[layer.keyName] ?? 1;
                const riskInfo = NUMERIC_RISK_MAP[numericVal];

                return (
                  <View key={layer.id} style={styles.disasterCard}>
                    <View style={styles.disasterHeader}>
                      <View style={styles.disasterTitleRow}>
                        <Text style={styles.disasterEmoji}>{layer.emoji}</Text>
                        <Text style={styles.disasterName}>{t(`layers.${layer.id}`)}</Text>
                      </View>
                      <View style={[styles.miniRiskBadge, { backgroundColor: riskInfo.bg }]}>
                        <Text style={[styles.miniRiskBadgeText, { color: riskInfo.color }]}>
                          {RISK_EMOJI[numericVal]} {t(RISK_KEY[numericVal])}
                        </Text>
                      </View>
                    </View>

                    <Text style={styles.disasterCardDesc}>{t(`layers.desc.${layer.id}`)}</Text>

                    <TouchableOpacity
                      style={styles.viewOnMapBtn}
                      onPress={() => router.push({ pathname: "/maps", params: { focusId: String(property.id) } })}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.viewOnMapText}>{t("productDetail.viewOnMap")}</Text>
                      <Ionicons name="arrow-forward" size={12} color="#2E7D32" />
                    </TouchableOpacity>
                  </View>
                );
              })}
            </View>
          )}

          {/* 3. DISASTER RISK DISTRIBUTION (DONUT CHART) */}
          {!isLoadingRisk && !riskError && (
            <DisasterDonutChart distribution={riskApiResponse.distribution} />
          )}

          {/* 4. SPATIAL RISK SUMMARY — derived from backend riskApiResponse */}
          {!isLoadingRisk && !riskError && (
            <>
              <Text style={styles.subSectionTitle}>{t("productDetail.spatialSummary")}</Text>
              <View style={styles.spatialSummaryBox}>
                {DISASTER_LAYERS.map((layer) => {
                  const numericVal: NumericRiskCode =
                    (riskApiResponse.risk as any)[layer.keyName] ?? 1;
                  const isLow = numericVal === 1;
                  const riskText = t(RISK_KEY[numericVal]);

                  return (
                    <View key={`summary-${layer.id}`} style={styles.spatialSummaryRow}>
                      <Text style={[styles.summaryIcon, { color: isLow ? "#16A34A" : "#EAB308" }]}>
                        {isLow ? "✓" : "⚠"}
                      </Text>
                      <Text style={styles.summaryText}>
                        {t(`layers.${layer.id}`)}: {riskText}
                      </Text>
                    </View>
                  );
                })}
              </View>
            </>
          )}

          {/* 5. DATA SOURCE ATTRIBUTION */}
          <View style={styles.sourceAttributionFooter}>
            <Ionicons name="information-circle-outline" size={14} color="#6B7280" />
            <Text style={styles.sourceAttributionText}>
              {t("productDetail.dataSource")}
            </Text>
          </View>
        </View>

      </ScrollView>

      {/* =========================================
          SECTION 7: BOTTOM ACTION BAR (STICKY)
         ========================================= */}
      <View style={styles.stickyFooter}>
        <TouchableOpacity style={styles.footerIconBtn} onPress={toggleBookmark}>
          <Ionicons
            name={isBookmarked ? "bookmark" : "bookmark-outline"}
            size={18}
            color={isBookmarked ? "#2E7D32" : "#4B5563"}
          />
          <Text style={styles.footerIconText}>{t("common.save")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.footerIconBtn} onPress={handleShare}>
          <Ionicons name="share-social-outline" size={18} color="#4B5563" />
          <Text style={styles.footerIconText}>{t("common.share")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.secondaryActionBtn} onPress={handleViewRoute}>
          <Ionicons name="navigate" size={16} color="#2E7D32" />
          <Text style={styles.secondaryActionText}>{t("productDetail.viewRoute")}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.primaryActionBtn} onPress={handleContactAgent} disabled={isOpeningChat}>
          {isOpeningChat ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Ionicons name="chatbubble-ellipses" size={16} color="#FFFFFF" />
          )}
          <Text style={styles.primaryActionText}>{t("productDetail.contactAgent")}</Text>
        </TouchableOpacity>
      </View>

      {property.center && (
        <RouteModal
          visible={!!routeFacility}
          onClose={() => setRouteFacility(null)}
          landId={String(property.id)}
          propertyName={property.name}
          propertyCoords={property.center}
          facility={routeFacility}
        />
      )}
    </SafeAreaView>
  );
}

/* ─── Styles (preserved exactly from original) ──────────────────────────── */
const styles = StyleSheet.create({
  safeContainer: {
    flex: 1,
    backgroundColor: "#F8FAFC",
  },
  topHeader: {
    position: "absolute",
    top: 45,
    left: 16,
    right: 16,
    zIndex: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  topHeaderRight: {
    flexDirection: "row",
    gap: 8,
  },
  circleBackBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.15,
    shadowRadius: 2,
  },
  heroWrap: {
    width: "100%",
    height: 270,
    backgroundColor: "#E5E7EB",
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  thumbScroll: {
    position: "absolute",
    bottom: 12,
    left: 0,
    right: 0,
  },
  thumbCard: {
    width: 54,
    height: 40,
    borderRadius: 6,
    borderWidth: 2,
    overflow: "hidden",
    backgroundColor: "#FFFFFF",
  },
  thumbImage: {
    width: "100%",
    height: "100%",
  },
  sectionContainer: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
  },
  propertyTitle: {
    fontSize: 22,
    fontWeight: "800",
    color: "#111827",
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 4,
  },
  addressText: {
    fontSize: 13,
    color: "#6B7280",
    flex: 1,
  },
  priceRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 10,
  },
  priceText: {
    fontSize: 22,
    fontWeight: "900",
    color: "#2E7D32",
  },
  transBadge: {
    backgroundColor: "rgba(46, 125, 50, 0.12)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  transBadgeText: {
    color: "#2E7D32",
    fontSize: 11,
    fontWeight: "800",
  },
  cardSection: {
    backgroundColor: "#FFFFFF",
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  cardSectionTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: "#111827",
  },
  sectionSubTitle: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
    marginBottom: 10,
  },
  specsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginTop: 10,
  },
  specBox: {
    width: "31%",
    backgroundColor: "#F8FAFC",
    padding: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  specLabel: {
    fontSize: 10,
    color: "#6B7280",
    fontWeight: "600",
  },
  specVal: {
    fontSize: 12,
    fontWeight: "800",
    color: "#111827",
    marginTop: 2,
  },
  descText: {
    fontSize: 13,
    color: "#4B5563",
    lineHeight: 18,
    marginTop: 4,
  },
  readMoreBtn: {
    color: "#2E7D32",
    fontSize: 12,
    fontWeight: "700",
    marginTop: 4,
  },
  miniMapWrap: {
    height: 140,
    borderRadius: 10,
    overflow: "hidden",
    marginTop: 8,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  fullscreenMapBtn: {
    position: "absolute",
    right: 8,
    bottom: 8,
    backgroundColor: "#2E7D32",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  fullscreenMapText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
  coordsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 8,
  },
  coordsText: {
    fontSize: 11,
    color: "#6B7280",
  },
  facilityList: {
    gap: 8,
  },
  facilityCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 10,
  },
  facilityIconBox: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "rgba(46, 125, 50, 0.1)",
    justifyContent: "center",
    alignItems: "center",
  },
  facilityMetaCol: {
    flex: 1,
  },
  facilityCategoryText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#2E7D32",
  },
  facilityNameText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
  },
  facilityDistText: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 2,
  },
  routeBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: "#2E7D32",
    gap: 4,
  },
  routeBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D32",
  },
  overallRiskCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    marginBottom: 16,
  },
  overallRiskHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  overallTitle: {
    fontSize: 16,
    fontWeight: "900",
    color: "#111827",
  },
  overallSubtitle: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 3,
    lineHeight: 15,
  },
  overallStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 12,
    marginBottom: 8,
  },
  overallStatusLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  overallBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  overallBadgeText: {
    fontSize: 11,
    fontWeight: "800",
  },
  overallDesc: {
    fontSize: 11,
    color: "#4B5563",
    fontStyle: "italic",
    lineHeight: 16,
  },
  subSectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 10,
  },
  disasterGrid: {
    gap: 10,
    marginBottom: 14,
  },
  disasterCard: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  disasterHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  disasterTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  disasterEmoji: {
    fontSize: 16,
  },
  disasterName: {
    fontSize: 13,
    fontWeight: "800",
    color: "#111827",
  },
  miniRiskBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
  },
  miniRiskBadgeText: {
    fontSize: 10,
    fontWeight: "800",
  },
  disasterCardDesc: {
    fontSize: 11,
    color: "#6B7280",
    marginTop: 6,
    lineHeight: 15,
  },
  viewOnMapBtn: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-end",
    gap: 4,
    marginTop: 8,
  },
  viewOnMapText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#2E7D32",
  },
  spatialSummaryBox: {
    backgroundColor: "#F8FAFC",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    gap: 6,
    marginBottom: 14,
  },
  spatialSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  summaryIcon: {
    fontSize: 14,
    fontWeight: "900",
  },
  summaryText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#374151",
  },
  sourceAttributionFooter: {
    flexDirection: "row",
    gap: 6,
    alignItems: "flex-start",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  sourceAttributionText: {
    fontSize: 10,
    color: "#6B7280",
    lineHeight: 14,
    flex: 1,
  },
  stickyFooter: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#FFFFFF",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    gap: 8,
    elevation: 8,
  },
  footerIconBtn: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 8,
  },
  footerIconText: {
    fontSize: 10,
    color: "#4B5563",
    marginTop: 2,
  },
  secondaryActionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#2E7D32",
    gap: 4,
  },
  secondaryActionText: {
    color: "#2E7D32",
    fontSize: 12,
    fontWeight: "800",
  },
  primaryActionBtn: {
    flex: 1.2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: "#2E7D32",
    gap: 4,
  },
  primaryActionText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "800",
  },
  /* Error/Skeleton styles */
  sectionErrorBox: {
    alignItems: "center",
    gap: 8,
    paddingVertical: 16,
  },
  sectionErrorText: {
    fontSize: 12,
    color: "#6B7280",
    textAlign: "center",
  },
  sectionRetryBtn: {
    backgroundColor: "#2E7D32",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 6,
  },
  sectionRetryText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
});
