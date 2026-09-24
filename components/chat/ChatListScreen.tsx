/**
 * Chat inbox shared by buyers and owners.
 *  - refreshes when the tab gains focus + pull-to-refresh (+ ChatContext background polling)
 *  - search across partner name, property and last message
 *  - "Belum dibaca" filter, relative timestamps, unread badges
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useAuth } from "../../contexts/AuthContext";
import { Conversation, useChat } from "../../contexts/ChatContext";
import { useTheme } from "../../contexts/ThemeContext";
import { avatarColor, formatListTime, getInitials } from "../../utils/chatFormat";

const PRIMARY = "#2E7D32";
const PLACEHOLDER = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800";

type Role = "buyer" | "owner";

const COPY: Record<Role, { title: string; subtitle: string; search: string; emptyTitle: string; emptyText: string; partnerFallback: string }> = {
  buyer: {
    title: "Pesan",
    subtitle: "Tanya langsung ke pemilik properti",
    search: "Cari pemilik, properti, atau pesan…",
    emptyTitle: "Belum ada percakapan",
    emptyText: "Temukan properti yang Anda suka, lalu tekan \"Contact Agent\" untuk bertanya ke pemiliknya.",
    partnerFallback: "Pemilik Properti",
  },
  owner: {
    title: "Pesan",
    subtitle: "Pertanyaan dari calon pembeli",
    search: "Cari pembeli, properti, atau pesan…",
    emptyTitle: "Belum ada pesan",
    emptyText: "Pertanyaan dari calon pembeli tentang properti Anda akan muncul di sini.",
    partnerFallback: "Calon Pembeli",
  },
};

export function ChatListScreen({ role }: { role: Role }) {
  const { user } = useAuth();
  const router = useRouter();
  const { isDark } = useTheme();
  const { conversations, refreshConversations, isLoadingConversations } = useChat();
  const [searchQuery, setSearchQuery] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const copy = COPY[role];

  const c = {
    bg: isDark ? "#0F172A" : "#F8FAFC",
    card: isDark ? "#1E293B" : "#FFFFFF",
    border: isDark ? "#334155" : "#E2E8F0",
    text: isDark ? "#F8FAFC" : "#0F172A",
    muted: "#64748B",
  };

  // Refresh every time the tab is opened
  useFocusEffect(
    useCallback(() => {
      refreshConversations();
    }, [refreshConversations])
  );

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshConversations();
    setRefreshing(false);
  };

  const unreadOf = (item: Conversation) => (role === "buyer" ? item.unreadBuyer : item.unreadOwner) || 0;
  const partnerOf = (item: Conversation) => (role === "buyer" ? item.ownerName : item.buyerName) || copy.partnerFallback;

  const myConversations = useMemo(() => {
    if (!user) return [];
    return conversations
      .filter((item) => (role === "buyer" ? item.buyerId === user.id : item.ownerId === user.id))
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [conversations, user, role]);

  const totalUnread = useMemo(() => myConversations.reduce((sum, item) => sum + unreadOf(item), 0), [myConversations]);
  const unreadChats = useMemo(() => myConversations.filter((item) => unreadOf(item) > 0).length, [myConversations]);

  const filteredChats = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return myConversations.filter((item) => {
      if (unreadOnly && unreadOf(item) === 0) return false;
      if (!q) return true;
      return [partnerOf(item), item.propertyTitle, item.lastMessage].some((v) => (v || "").toLowerCase().includes(q));
    });
  }, [myConversations, searchQuery, unreadOnly]);

  if (!user) return null;

  const openChat = (item: Conversation) =>
    router.push({ pathname: "/ChatRoom", params: { chatId: item.id, propertyId: item.propertyId } });

  const renderItem = ({ item }: { item: Conversation }) => {
    const unread = unreadOf(item);
    const partner = partnerOf(item);
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        style={[styles.chatCard, { backgroundColor: c.card, borderColor: unread > 0 ? PRIMARY + "55" : c.border }]}
        onPress={() => openChat(item)}
      >
        {/* Partner avatar with the property thumbnail tucked in the corner */}
        <View style={styles.avatarBox}>
          <View style={[styles.avatar, { backgroundColor: avatarColor(partner) }]}>
            <Text style={styles.avatarText}>{getInitials(partner)}</Text>
          </View>
          <Image source={{ uri: item.propertyImage || PLACEHOLDER }} style={[styles.propertyThumb, { borderColor: c.card }]} />
        </View>

        <View style={styles.contentContainer}>
          <View style={styles.topRow}>
            <Text style={[styles.partnerName, { color: c.text }]} numberOfLines={1}>{partner}</Text>
            <Text style={[styles.timeText, { color: unread > 0 ? PRIMARY : "#94A3B8" }]}>
              {formatListTime(item.updatedAt)}
            </Text>
          </View>

          <View style={styles.propertyTagRow}>
            <Ionicons name="home" size={11} color={PRIMARY} />
            <Text style={styles.propertyTitle} numberOfLines={1}>{item.propertyTitle || "Properti"}</Text>
          </View>

          <View style={styles.bottomRow}>
            <Text
              style={[styles.lastMessage, { color: unread > 0 ? c.text : c.muted, fontWeight: unread > 0 ? "700" : "400" }]}
              numberOfLines={1}
            >
              {item.lastMessage === "Percakapan dimulai" ? "Belum ada pesan — mulai percakapan" : item.lastMessage}
            </Text>
            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? "99+" : unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.bg }]} edges={["top"]}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.title, { color: c.text }]}>{copy.title}</Text>
          {totalUnread > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalUnread} baru</Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>{copy.subtitle}</Text>
      </View>

      {/* SEARCH */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: c.card, borderColor: c.border }]}>
          <Ionicons name="search-outline" size={18} color={c.muted} style={{ marginRight: 8 }} />
          <TextInput
            placeholder={copy.search}
            placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: c.text }]}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#94A3B8" />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* FILTER CHIPS */}
      {myConversations.length > 0 && (
        <View style={styles.filterRow}>
          {[
            { key: false, label: `Semua (${myConversations.length})` },
            { key: true, label: `Belum dibaca${unreadChats ? ` (${unreadChats})` : ""}` },
          ].map((f) => {
            const active = unreadOnly === f.key;
            return (
              <TouchableOpacity
                key={String(f.key)}
                onPress={() => setUnreadOnly(f.key)}
                style={[styles.filterChip, { backgroundColor: active ? PRIMARY : c.card, borderColor: active ? PRIMARY : c.border }]}
              >
                <Text style={[styles.filterChipText, { color: active ? "#FFF" : c.text }]}>{f.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}

      {/* LIST */}
      {isLoadingConversations && myConversations.length === 0 ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={PRIMARY} />
          <Text style={styles.loadingText}>Memuat percakapan…</Text>
        </View>
      ) : (
        <FlatList
          data={filteredChats}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4, flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[PRIMARY]} tintColor={PRIMARY} />}
          ListEmptyComponent={
            myConversations.length > 0 ? (
              <View style={styles.emptyBox}>
                <Ionicons name={unreadOnly ? "checkmark-done-circle-outline" : "search-outline"} size={48} color="#CBD5E1" />
                <Text style={[styles.emptyTitle, { color: c.text }]}>
                  {unreadOnly ? "Semua pesan sudah dibaca" : "Tidak ditemukan"}
                </Text>
                <Text style={styles.emptyText}>
                  {unreadOnly ? "Tidak ada pesan baru saat ini." : `Tidak ada percakapan yang cocok dengan "${searchQuery}".`}
                </Text>
              </View>
            ) : (
              <View style={styles.emptyBox}>
                <View style={styles.emptyIconWrap}>
                  <Ionicons name="chatbubbles-outline" size={40} color={PRIMARY} />
                </View>
                <Text style={[styles.emptyTitle, { color: c.text }]}>{copy.emptyTitle}</Text>
                <Text style={styles.emptyText}>{copy.emptyText}</Text>
                {role === "buyer" && (
                  <TouchableOpacity style={styles.emptyCta} onPress={() => router.push("/maps")} activeOpacity={0.85}>
                    <Ionicons name="map-outline" size={16} color="#FFF" />
                    <Text style={styles.emptyCtaText}>Jelajahi Properti</Text>
                  </TouchableOpacity>
                )}
              </View>
            )
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 26, fontWeight: "800" },
  subtitle: { fontSize: 13, color: "#64748B", marginTop: 2 },
  headerBadge: { backgroundColor: PRIMARY, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  headerBadgeText: { color: "#FFF", fontSize: 11, fontWeight: "800" },

  searchContainer: { paddingHorizontal: 16, marginBottom: 10 },
  searchBar: { flexDirection: "row", alignItems: "center", borderRadius: 14, paddingHorizontal: 12, height: 44, borderWidth: 1 },
  searchInput: { flex: 1, fontSize: 14 },

  filterRow: { flexDirection: "row", gap: 8, paddingHorizontal: 16, marginBottom: 12 },
  filterChip: { paddingHorizontal: 14, paddingVertical: 7, borderRadius: 18, borderWidth: 1 },
  filterChipText: { fontSize: 12, fontWeight: "700" },

  loadingBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  loadingText: { fontSize: 12, color: "#64748B" },

  chatCard: { flexDirection: "row", alignItems: "center", padding: 12, borderRadius: 16, borderWidth: 1, marginBottom: 10 },
  avatarBox: { width: 56, height: 56, marginRight: 12 },
  avatar: { width: 50, height: 50, borderRadius: 25, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF", fontWeight: "800", fontSize: 17 },
  propertyThumb: { position: "absolute", right: 0, bottom: 0, width: 26, height: 26, borderRadius: 8, borderWidth: 2 },

  contentContainer: { flex: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  partnerName: { fontSize: 15, fontWeight: "800", flex: 1, marginRight: 6 },
  timeText: { fontSize: 11, fontWeight: "700" },
  propertyTagRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, marginBottom: 3 },
  propertyTitle: { fontSize: 12, fontWeight: "600", color: PRIMARY, flex: 1 },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lastMessage: { fontSize: 13, flex: 1, marginRight: 8 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
  badgeText: { color: "#FFF", fontSize: 10, fontWeight: "900" },

  emptyBox: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 36, paddingBottom: 60 },
  emptyIconWrap: { width: 80, height: 80, borderRadius: 40, backgroundColor: PRIMARY + "15", alignItems: "center", justifyContent: "center" },
  emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 16 },
  emptyText: { textAlign: "center", fontSize: 13, color: "#64748B", marginTop: 6, lineHeight: 20 },
  emptyCta: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: PRIMARY, paddingHorizontal: 18, paddingVertical: 11, borderRadius: 12, marginTop: 18 },
  emptyCtaText: { color: "#FFF", fontWeight: "800", fontSize: 13 },
});
