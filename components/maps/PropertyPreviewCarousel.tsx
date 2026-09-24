/**
 * PropertyPreviewCarousel — interactive popup shown when a property marker is tapped.
 *
 *  - Swipe left/right to move between properties (the map follows the active card)
 *  - Tap the photo to cycle through the property's photos
 *  - Live disaster-risk summary from GET /api/lands/{id}/risk
 *  - Actions: detail page, road navigation, share
 */
import { useTranslation } from "react-i18next";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { Land } from "../../contexts/LandContext";
import { BackendRiskApiResponse, DISASTER_LAYERS, NUMERIC_RISK_MAP } from "../../data/riskData";
import { fetchRiskAnalysis } from "../../services/RiskService";
import { openExternalDirections } from "../gis/RouteModal";

const { width: SCREEN_W } = Dimensions.get("window");
const CARD_W = SCREEN_W - 40;
const GAP = 10;
const SNAP = CARD_W + GAP;
const SIDE = (SCREEN_W - CARD_W) / 2;

const PLACEHOLDER = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800";
const SALE = "#2E7D32";
const RENT = "#2563EB";

const TYPE_ICON: Record<string, keyof typeof Ionicons.glyphMap> = {
  house: "home",
  apartment: "business",
  villa: "leaf",
};

type RiskState = BackendRiskApiResponse | "loading" | "error";

const RISK_KEY: Record<number, string> = { 1: "risk.lowRisk", 2: "risk.mediumRisk", 3: "risk.highRisk" };

interface Props {
  properties: Land[]; // only properties with coordinates
  activeId: string;
  onChangeActive: (id: string) => void;
  onClose: () => void;
  onOpenDetail: (id: string) => void;
}

const formatArea = (v?: string) => {
  if (!v || v === "-") return null;
  return /^\d+([.,]\d+)?$/.test(v.trim()) ? `${v.trim()} m²` : v;
};

export function PropertyPreviewCarousel({ properties, activeId, onChangeActive, onClose, onOpenDetail }: Props) {
  const { t } = useTranslation();
  const listRef = useRef<FlatList<Land>>(null);
  const slideY = useRef(new Animated.Value(320)).current;
  const [risks, setRisks] = useState<Record<string, RiskState>>({});

  const activeIndex = useMemo(
    () => Math.max(0, properties.findIndex((p) => p.id === activeId)),
    [properties, activeId]
  );

  // Slide in on mount
  useEffect(() => {
    Animated.spring(slideY, { toValue: 0, useNativeDriver: true, tension: 60, friction: 9 }).start();
  }, [slideY]);

  // Keep the carousel on the active card when it changes from outside (marker tap)
  useEffect(() => {
    listRef.current?.scrollToIndex({ index: activeIndex, animated: true });
  }, [activeIndex]);

  // Lazy-load disaster risk for the active card (and neighbours, so swiping feels instant)
  const requested = useRef(new Set<string>());
  const loadRisk = useCallback((id: string, force = false) => {
    if (requested.current.has(id) && !force) return;
    requested.current.add(id);
    setRisks((p) => ({ ...p, [id]: "loading" }));
    fetchRiskAnalysis(id)
      .then((r) => setRisks((p) => ({ ...p, [id]: r })))
      .catch(() => setRisks((p) => ({ ...p, [id]: "error" })));
  }, []);

  useEffect(() => {
    [activeIndex, activeIndex + 1, activeIndex - 1].forEach((i) => {
      const p = properties[i];
      if (p) loadRisk(p.id);
    });
  }, [activeIndex, properties, loadRisk]);

  const handleClose = () => {
    Animated.timing(slideY, { toValue: 320, duration: 180, useNativeDriver: true }).start(onClose);
  };

  const onScrollEnd = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const index = Math.round(e.nativeEvent.contentOffset.x / SNAP);
    const p = properties[Math.min(Math.max(index, 0), properties.length - 1)];
    if (p && p.id !== activeId) onChangeActive(p.id);
  };

  const goTo = (delta: number) => {
    const p = properties[activeIndex + delta];
    if (p) onChangeActive(p.id);
  };

  return (
    <Animated.View style={[styles.wrap, { transform: [{ translateY: slideY }] }]} pointerEvents="box-none">
      {/* Top bar: counter + prev/next + close */}
      <View style={styles.topBar} pointerEvents="box-none">
        <View style={styles.counterPill}>
          <TouchableOpacity onPress={() => goTo(-1)} disabled={activeIndex === 0} hitSlop={8}>
            <Ionicons name="chevron-back" size={18} color={activeIndex === 0 ? "#CBD5E1" : "#111827"} />
          </TouchableOpacity>
          <Text style={styles.counterText}>
            {activeIndex + 1} / {properties.length}
          </Text>
          <TouchableOpacity
            onPress={() => goTo(1)}
            disabled={activeIndex >= properties.length - 1}
            hitSlop={8}
          >
            <Ionicons
              name="chevron-forward"
              size={18}
              color={activeIndex >= properties.length - 1 ? "#CBD5E1" : "#111827"}
            />
          </TouchableOpacity>
        </View>
        <TouchableOpacity style={styles.closeBtn} onPress={handleClose} hitSlop={8}>
          <Ionicons name="close" size={20} color="#111827" />
        </TouchableOpacity>
      </View>

      <FlatList
        ref={listRef}
        data={properties}
        keyExtractor={(p) => p.id}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={SNAP}
        decelerationRate="fast"
        contentContainerStyle={{ paddingHorizontal: SIDE }}
        ItemSeparatorComponent={() => <View style={{ width: GAP }} />}
        getItemLayout={(_, index) => ({ length: SNAP, offset: SNAP * index, index })}
        initialScrollIndex={activeIndex}
        onMomentumScrollEnd={onScrollEnd}
        onScrollToIndexFailed={() => {}}
        renderItem={({ item }) => (
          <PreviewCard
            land={item}
            isActive={item.id === activeId}
            risk={risks[item.id]}
            onRetryRisk={() => loadRisk(item.id, true)}
            onOpenDetail={() => onOpenDetail(item.id)}
          />
        )}
      />
    </Animated.View>
  );
}

/* ───────────────────────── Card ───────────────────────── */
function PreviewCard({
  land,
  isActive,
  risk,
  onRetryRisk,
  onOpenDetail,
}: {
  land: Land;
  isActive: boolean;
  risk?: RiskState;
  onRetryRisk: () => void;
  onOpenDetail: () => void;
}) {
  const images = useMemo(() => {
    const list = [...(land.images ?? [])];
    if (land.image && !list.includes(land.image)) list.unshift(land.image);
    return list.length ? list : [PLACEHOLDER];
  }, [land.image, land.images]);
  const [imgIndex, setImgIndex] = useState(0);
  const { t } = useTranslation();

  const isRent = land.isForSale === false;
  const accent = isRent ? RENT : SALE;
  const typeKey = land.type ?? "house";

  const specs = [
    land.bedrooms ? { icon: "bed-outline" as const, text: t("property.bedroomsShort", { count: land.bedrooms }) } : null,
    land.bathrooms ? { icon: "water-outline" as const, text: t("property.bathroomsShort", { count: land.bathrooms }) } : null,
    formatArea(land.area?.land) ? { icon: "resize-outline" as const, text: `${t("property.landAreaShort")} ${formatArea(land.area?.land)}` } : null,
    formatArea(land.area?.building)
      ? { icon: "cube-outline" as const, text: `${t("property.buildingAreaShort")} ${formatArea(land.area?.building)}` }
      : null,
  ].filter(Boolean) as { icon: keyof typeof Ionicons.glyphMap; text: string }[];

  const handleShare = () => {
    const coords = land.center ? `\nhttps://maps.google.com/?q=${land.center.latitude},${land.center.longitude}` : "";
    Share.share({
      message: `${land.name} • Rp ${(land.price ?? 0).toLocaleString("id-ID")}${isRent ? t("property.perMonthShort") : ""}\n📍 ${land.location}${coords}`,
    }).catch(() => {});
  };

  return (
    <View style={[styles.card, isActive && { borderColor: accent }]}>
      {/* Photo — tap to cycle */}
      <TouchableOpacity
        activeOpacity={0.95}
        onPress={() => setImgIndex((i) => (i + 1) % images.length)}
        style={styles.photoWrap}
      >
        <Image source={{ uri: images[imgIndex] }} style={styles.photo} />
        <View style={styles.photoBadges}>
          <View style={[styles.badge, { backgroundColor: accent }]}>
            <Text style={styles.badgeText}>{isRent ? t("property.forRentBadge") : t("property.forSaleBadge")}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: "rgba(17,24,39,0.75)" }]}>
            <Ionicons name={TYPE_ICON[typeKey] ?? "home"} size={11} color="#FFF" />
            <Text style={styles.badgeText}>{t(`property.type.${typeKey}`, { defaultValue: typeKey })}</Text>
          </View>
        </View>
        {images.length > 1 && (
          <View style={styles.dots}>
            {images.slice(0, 6).map((_, i) => (
              <View key={i} style={[styles.dot, i === imgIndex % 6 && styles.dotActive]} />
            ))}
            <Text style={styles.photoCount}>
              {imgIndex + 1}/{images.length}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      <View style={styles.body}>
        <Text style={styles.title} numberOfLines={1}>{land.name}</Text>
        <View style={styles.locRow}>
          <Ionicons name="location-outline" size={13} color="#6B7280" />
          <Text style={styles.locText} numberOfLines={1}>{land.location}</Text>
        </View>

        <Text style={[styles.price, { color: accent }]}>
          Rp {(land.price ?? 0).toLocaleString("id-ID")}
          {isRent && <Text style={styles.priceUnit}> {t("property.perMonth")}</Text>}
        </Text>

        {specs.length > 0 && (
          <View style={styles.specRow}>
            {specs.map((s) => (
              <View key={s.text} style={styles.specChip}>
                <Ionicons name={s.icon} size={12} color="#374151" />
                <Text style={styles.specText}>{s.text}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Disaster risk */}
        <View style={styles.riskRow}>
          {risk === undefined || risk === "loading" ? (
            <View style={styles.riskLoading}>
              <ActivityIndicator size="small" color="#9CA3AF" />
              <Text style={styles.riskMuted}>{t("risk.analyzing")}</Text>
            </View>
          ) : risk === "error" ? (
            <TouchableOpacity style={styles.riskLoading} onPress={onRetryRisk}>
              <Ionicons name="refresh" size={14} color="#DC2626" />
              <Text style={[styles.riskMuted, { color: "#DC2626" }]}>{t("risk.loadErrorTap")}</Text>
            </TouchableOpacity>
          ) : (
            <>
              <View style={[styles.overallRisk, { backgroundColor: NUMERIC_RISK_MAP[risk.overallRisk].bg }]}>
                <Ionicons name="shield-checkmark" size={12} color={NUMERIC_RISK_MAP[risk.overallRisk].color} />
                <Text style={[styles.overallRiskText, { color: NUMERIC_RISK_MAP[risk.overallRisk].color }]}>
                  {t(RISK_KEY[risk.overallRisk])}
                </Text>
              </View>
              {DISASTER_LAYERS.map((d) => {
                const level = risk.risk[d.keyName as keyof typeof risk.risk] ?? 1;
                return (
                  <View
                    key={d.id}
                    style={[styles.riskDot, { backgroundColor: NUMERIC_RISK_MAP[level].bg, borderColor: NUMERIC_RISK_MAP[level].dotColor }]}
                  >
                    <Text style={styles.riskEmoji}>{d.emoji}</Text>
                  </View>
                );
              })}
            </>
          )}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: accent }]} onPress={onOpenDetail} activeOpacity={0.85}>
            <Text style={styles.primaryBtnText}>{t("common.viewDetail")}</Text>
            <Ionicons name="arrow-forward" size={14} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.iconBtn}
            onPress={() => land.center && openExternalDirections(land.center)}
            activeOpacity={0.8}
          >
            <Ionicons name="navigate" size={18} color={accent} />
            <Text style={[styles.iconBtnText, { color: accent }]}>{t("common.route")}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconBtn} onPress={handleShare} activeOpacity={0.8}>
            <Ionicons name="share-social-outline" size={18} color="#374151" />
            <Text style={styles.iconBtnText}>{t("common.share")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 16, zIndex: 50, elevation: 50 },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SIDE,
    marginBottom: 8,
  },
  counterPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 18,
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  counterText: { fontSize: 12, fontWeight: "700", color: "#111827", minWidth: 40, textAlign: "center" },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  card: {
    width: CARD_W,
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 2,
    borderColor: "transparent",
    overflow: "hidden",
    elevation: 6,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
  },
  photoWrap: { height: 130, backgroundColor: "#E5E7EB" },
  photo: { width: "100%", height: "100%" },
  photoBadges: { position: "absolute", top: 10, left: 10, flexDirection: "row", gap: 6 },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
  badgeText: { color: "#FFF", fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },
  dots: {
    position: "absolute",
    bottom: 8,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.35)",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  dot: { width: 5, height: 5, borderRadius: 2.5, backgroundColor: "rgba(255,255,255,0.5)" },
  dotActive: { backgroundColor: "#FFFFFF", width: 12 },
  photoCount: { color: "#FFF", fontSize: 10, fontWeight: "700", marginLeft: 4 },
  body: { padding: 12 },
  title: { fontSize: 15, fontWeight: "800", color: "#111827" },
  locRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 2 },
  locText: { flex: 1, fontSize: 12, color: "#6B7280" },
  price: { fontSize: 17, fontWeight: "800", marginTop: 6 },
  priceUnit: { fontSize: 12, fontWeight: "600", color: "#6B7280" },
  specRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 8 },
  specChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F3F4F6",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  specText: { fontSize: 11, fontWeight: "600", color: "#374151" },
  riskRow: { flexDirection: "row", alignItems: "center", gap: 5, marginTop: 10, minHeight: 26 },
  riskLoading: { flexDirection: "row", alignItems: "center", gap: 6 },
  riskMuted: { fontSize: 11, color: "#6B7280" },
  overallRisk: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    marginRight: 2,
  },
  overallRiskText: { fontSize: 11, fontWeight: "800" },
  riskDot: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  riskEmoji: { fontSize: 11 },
  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  primaryBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    paddingVertical: 11,
  },
  primaryBtnText: { color: "#FFF", fontWeight: "800", fontSize: 13 },
  iconBtn: {
    width: 62,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    paddingVertical: 5,
  },
  iconBtnText: { fontSize: 10, fontWeight: "700", color: "#374151", marginTop: 1 },
});
