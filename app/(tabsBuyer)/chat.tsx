import React, { useState, useMemo, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  TextInput,
  Image,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { SafeAreaView } from "react-native-safe-area-context";
import { useChat, Conversation } from "../../contexts/ChatContext";

const PRIMARY = "#2E7D32";

const getInitials = (name: string) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export default function BuyerChatList() {
  const { user } = useAuth();
  const router = useRouter();
  const { theme, isDark } = useTheme();
  const { conversations, refreshConversations } = useChat();
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    refreshConversations();
  }, [refreshConversations]);

  const buyerConversations = useMemo(() => {
    if (!user) return [];
    return conversations
      .filter((c) => c.buyerId === user.id || !c.buyerId || user.userType === "buyer")
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }, [conversations, user]);

  const totalUnread = useMemo(() => {
    return buyerConversations.reduce((sum, item) => sum + (item.unreadBuyer || 0), 0);
  }, [buyerConversations]);

  const filteredChats = useMemo(() => {
    return buyerConversations.filter((item) => {
      const search = searchQuery.toLowerCase();
      return (
        item.ownerName.toLowerCase().includes(search) ||
        item.propertyTitle.toLowerCase().includes(search) ||
        item.lastMessage.toLowerCase().includes(search)
      );
    });
  }, [buyerConversations, searchQuery]);

  if (!user) return null;

  const renderItem = ({ item }: { item: Conversation }) => {
    const unread = item.unreadBuyer || 0;

    return (
      <TouchableOpacity
        activeOpacity={0.88}
        style={[
          styles.chatCard,
          {
            backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
            borderColor: isDark ? "#334155" : "#E2E8F0",
          },
        ]}
        onPress={() =>
          router.push({
            pathname: "/ChatRoom",
            params: {
              chatId: item.id,
              propertyId: item.propertyId,
              propertyTitle: item.propertyTitle,
              ownerName: item.ownerName,
            },
          })
        }
      >
        {/* Thumbnail Image */}
        <View style={styles.imageContainer}>
          <Image
            source={{ uri: item.propertyImage || "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800" }}
            style={styles.propertyThumb}
          />
          {unread > 0 && <View style={styles.cardUnreadDot} />}
        </View>

        {/* Content Details */}
        <View style={styles.contentContainer}>
          <View style={styles.topRow}>
            <Text style={[styles.partnerName, { color: isDark ? "#F8FAFC" : "#0F172A" }]} numberOfLines={1}>
              {item.ownerName || "Pemilik Properti"}
            </Text>
            <Text style={[styles.timeText, { color: unread > 0 ? PRIMARY : "#94A3B8" }]}>
              {item.lastMessageTime}
            </Text>
          </View>

          <View style={styles.propertyTagRow}>
            <Ionicons name="business" size={11} color={PRIMARY} />
            <Text style={styles.propertyTitle} numberOfLines={1}>
              {item.propertyTitle}
            </Text>
          </View>

          <View style={styles.bottomRow}>
            <Text
              style={[
                styles.lastMessage,
                {
                  color: unread > 0 ? (isDark ? "#F8FAFC" : "#0F172A") : "#64748B",
                  fontWeight: unread > 0 ? "700" : "400",
                },
              ]}
              numberOfLines={1}
            >
              {item.lastMessage}
            </Text>

            {unread > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" }]}>
      {/* HEADER */}
      <View style={styles.header}>
        <View style={styles.headerTitleRow}>
          <Text style={[styles.title, { color: isDark ? "#F8FAFC" : "#0F172A" }]}>Pesan Pembeli</Text>
          {totalUnread > 0 && (
            <View style={styles.headerBadge}>
              <Text style={styles.headerBadgeText}>{totalUnread} Baru</Text>
            </View>
          )}
        </View>
        <Text style={styles.subtitle}>Komunikasi langsung dengan pemilik properti</Text>
      </View>

      {/* SEARCH BAR */}
      <View style={styles.searchContainer}>
        <View style={[styles.searchBar, { backgroundColor: isDark ? "#1E293B" : "#FFFFFF", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
          <Ionicons name="search-outline" size={18} color="#64748B" style={{ marginRight: 8 }} />
          <TextInput
            placeholder="Cari pesan atau pemilik..."
            placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
            value={searchQuery}
            onChangeText={setSearchQuery}
            style={[styles.searchInput, { color: isDark ? "#F8FAFC" : "#0F172A" }]}
          />
        </View>
      </View>

      {/* CHAT LIST */}
      <FlatList
        data={filteredChats}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100, paddingTop: 4 }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyBox}>
            <Ionicons name="chatbubbles-outline" size={56} color="#CBD5E1" />
            <Text style={[styles.emptyTitle, { color: isDark ? "#F8FAFC" : "#0F172A" }]}>Belum ada percakapan</Text>
            <Text style={styles.emptyText}>
              Mulai percakapan dari halaman detail properti untuk menanyakan informasi lebih lanjut!
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 12 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  title: { fontSize: 24, fontWeight: "800" },
  subtitle: { fontSize: 13, color: "#64748B", marginTop: 2 },
  headerBadge: { backgroundColor: PRIMARY, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  headerBadgeText: { color: "#FFF", fontSize: 11, fontWeight: "800" },

  searchContainer: { paddingHorizontal: 20, marginBottom: 16 },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 14,
    paddingHorizontal: 12,
    height: 44,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 3,
    elevation: 1,
  },
  searchInput: { flex: 1, fontSize: 14 },

  chatCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 12,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  imageContainer: { position: "relative", marginRight: 14 },
  propertyThumb: { width: 56, height: 56, borderRadius: 12 },
  cardUnreadDot: {
    position: "absolute",
    top: -2,
    right: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: PRIMARY,
    borderWidth: 2,
    borderColor: "#FFF",
  },

  contentContainer: { flex: 1 },
  topRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  partnerName: { fontSize: 15, fontWeight: "800", flex: 1, marginRight: 6 },
  timeText: { fontSize: 11, fontWeight: "700" },
  propertyTagRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2, marginBottom: 4 },
  propertyTitle: { fontSize: 12, fontWeight: "700", color: PRIMARY },
  bottomRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  lastMessage: { fontSize: 13, flex: 1, marginRight: 8 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, backgroundColor: PRIMARY, justifyContent: "center", alignItems: "center", paddingHorizontal: 6 },
  badgeText: { color: "#FFF", fontSize: 10, fontWeight: "900" },

  emptyBox: { alignItems: "center", justifyContent: "center", marginTop: 80, paddingHorizontal: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 16 },
  emptyText: { textAlign: "center", fontSize: 13, color: "#64748B", marginTop: 6, lineHeight: 20 },
});
