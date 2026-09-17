import React, { useEffect, useRef, useState, useMemo } from "react";
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Image,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useLands } from "../contexts/LandContext";
import { useTheme } from "../contexts/ThemeContext";
import { useChat, Message } from "../contexts/ChatContext";

const PRIMARY = "#2E7D32";

const getInitials = (name: string) => {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
};

export default function ChatRoom() {
  const { user } = useAuth();
  const { theme, isDark } = useTheme();
  const { lands } = useLands();
  const { conversations, getMessagesForConversation, sendMessage, markAsRead } = useChat();
  const router = useRouter();
  const params = useLocalSearchParams();

  const chatId = params.chatId ? String(params.chatId) : "";
  const propertyId = params.propertyId ? String(params.propertyId) : "";

  const scrollRef = useRef<FlatList>(null);

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState((params.autoMessage as string) || "");
  const [isLoading, setIsLoading] = useState(true);

  // Find active conversation from ChatContext
  const activeConversation = useMemo(() => {
    if (chatId) {
      return conversations.find((c) => c.id === chatId);
    }
    if (propertyId && user) {
      return conversations.find(
        (c) =>
          c.propertyId === propertyId &&
          (c.buyerId === user.id || c.ownerId === user.id || c.ownerName === user.fullName)
      );
    }
    return undefined;
  }, [conversations, chatId, propertyId, user]);

  // Property info summary
  const property = useMemo(() => {
    const found = lands.find((p) => String(p.id) === (propertyId || activeConversation?.propertyId));
    if (found) return found;
    if (activeConversation) {
      return {
        id: activeConversation.propertyId,
        name: activeConversation.propertyTitle,
        image: activeConversation.propertyImage,
        price: activeConversation.propertyPrice,
        location: activeConversation.propertyLocation,
        owner: activeConversation.ownerName,
        status: activeConversation.propertyStatus,
      };
    }
    return {
      id: "unknown",
      name: "Properti tidak ditemukan",
      image: "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=1200&q=80",
      price: 0,
      location: "Yogyakarta",
      owner: params.ownerName ? String(params.ownerName) : "Pemilik Properti",
      status: "Approved",
    };
  }, [lands, propertyId, activeConversation, params.ownerName]);

  const userRole: "buyer" | "owner" = user?.userType === "owner" ? "owner" : "buyer";
  const partnerName = userRole === "buyer" 
    ? (activeConversation?.ownerName || property.owner || "Pemilik Properti")
    : (activeConversation?.buyerName || "Calon Pembeli");

  const isAvailableForChat = property.status === "Approved" || property.status === "Sold";

  const loadMessages = async () => {
    if (!activeConversation) return;
    try {
      const msgs = await getMessagesForConversation(activeConversation.id);
      setMessages(msgs);
    } catch (e) {
      console.warn("Message fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  };

  // Mark as read
  useEffect(() => {
    if (activeConversation) {
      markAsRead(activeConversation.id, userRole);
    }
  }, [activeConversation?.id, userRole]);

  // HTTP Polling: 5 seconds interval
  useEffect(() => {
    loadMessages();

    if (!activeConversation) return;

    const intervalId = setInterval(() => {
      loadMessages();
    }, 5000);

    return () => {
      clearInterval(intervalId);
    };
  }, [activeConversation?.id]);

  useEffect(() => {
    if (messages.length > 0) {
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    }
  }, [messages.length]);

  if (!user) return null;

  const handleSend = async () => {
    if (!input.trim() || !activeConversation) return;

    const textToSend = input.trim();
    setInput("");

    try {
      const newMsg = await sendMessage({
        conversationId: activeConversation.id,
        senderId: user.id,
        senderRole: userRole,
        senderName: user.fullName || "Pengguna Lokatani",
        text: textToSend,
      });

      setMessages((prev) => [...prev, newMsg]);
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 50);
    } catch (e) {
      console.warn("Send message error:", e);
    }
  };

  const renderMessage = ({ item }: { item: Message }) => {
    const isMe = item.senderId === user.id || item.senderRole === userRole;

    return (
      <View style={[styles.messageRow, isMe ? styles.right : styles.left]}>
        <View
          style={[
            styles.bubble,
            isMe
              ? [styles.myBubble, { backgroundColor: PRIMARY }]
              : [styles.otherBubble, { backgroundColor: isDark ? "#1E293B" : "#F1F5F9" }],
          ]}
        >
          <Text style={[styles.messageText, { color: isMe ? "#FFFFFF" : (isDark ? "#F8FAFC" : "#0F172A") }]}>
            {item.text}
          </Text>
          <View style={styles.timeRow}>
            <Text style={[styles.timeText, { color: isMe ? "rgba(255, 255, 255, 0.75)" : "#94A3B8" }]}>
              {item.time || "10:00"}
            </Text>
            {isMe && (
              <Ionicons
                name="checkmark-done"
                size={14}
                color={item.status === "read" ? "#86EFAC" : "rgba(255, 255, 255, 0.75)"}
                style={{ marginLeft: 3 }}
              />
            )}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" }]} edges={["top", "left", "right"]}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        keyboardVerticalOffset={0}
      >
        {/* ===== HEADER ===== */}
        <View style={[styles.header, { borderBottomColor: isDark ? "#1E293B" : "#E2E8F0", backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
            <Ionicons name="chevron-back" size={26} color={PRIMARY} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.avatarWrapper}>
              <View style={[styles.avatarCircle, { backgroundColor: PRIMARY }]}>
                <Text style={styles.avatarText}>{getInitials(partnerName)}</Text>
              </View>
              <View style={styles.onlineDot} />
            </View>
            <View>
              <Text style={[styles.headerTitle, { color: isDark ? "#F8FAFC" : "#0F172A" }]} numberOfLines={1}>
                {partnerName}
              </Text>
              <Text style={styles.headerSubTitle}>
                {userRole === "buyer" ? "Pemilik Properti" : "Calon Pembeli"}
              </Text>
            </View>
          </View>

          <TouchableOpacity style={styles.headerOptionBtn}>
            <Ionicons name="ellipsis-vertical" size={20} color={isDark ? "#94A3B8" : "#64748B"} />
          </TouchableOpacity>
        </View>

        {/* ===== TOP PROPERTY INFORMATION SUMMARY CARD ===== */}
        <View style={styles.propertyCardWrapper}>
          <View
            style={[
              styles.propertyCard,
              {
                backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
                borderColor: isDark ? "#334155" : "#E2E8F0",
              },
            ]}
          >
            <Image
              source={{ uri: property.image || "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800" }}
              style={styles.propertyImage}
            />
            <View style={{ flex: 1, justifyContent: "center", marginRight: 8 }}>
              <View style={styles.propertyHeaderRow}>
                <Text style={[styles.propertyTitle, { color: isDark ? "#F8FAFC" : "#0F172A" }]} numberOfLines={1}>
                  {property.name}
                </Text>
              </View>
              <Text style={styles.propertyPrice}>
                Rp {(property.price || 0).toLocaleString("id-ID")}
              </Text>
              <View style={styles.locationRow}>
                <Ionicons name="location" size={11} color="#64748B" />
                <Text style={styles.locationText} numberOfLines={1}>
                  {property.location || "Yogyakarta"}
                </Text>
              </View>
            </View>

            <TouchableOpacity
              style={styles.viewPropertyBtn}
              onPress={() => router.push(`/product/${property.id}`)}
              activeOpacity={0.85}
            >
              <Text style={styles.viewPropertyBtnText}>Lihat Properti</Text>
              <Ionicons name="arrow-forward" size={12} color="#FFF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ===== MESSAGES LIST ===== */}
        {isLoading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="small" color={PRIMARY} />
            <Text style={[styles.loadingText, { color: "#64748B" }]}>Memuat pesan...</Text>
          </View>
        ) : (
          <FlatList
            ref={scrollRef}
            data={messages}
            keyExtractor={(i) => i.id}
            renderItem={renderMessage}
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
          />
        )}

        {/* ===== INPUT BAR & RESTRICTIONS NOTICE ===== */}
        {!isAvailableForChat ? (
          <View style={[styles.restrictionBanner, { backgroundColor: "#FEE2E2", borderColor: "#FCA5A5" }]}>
            <Ionicons name="alert-circle-outline" size={20} color="#EF4444" style={{ marginRight: 8 }} />
            <Text style={styles.restrictionText}>
              Properti ini sedang tidak tersedia untuk komunikasi.
            </Text>
          </View>
        ) : (
          <View style={[styles.inputBar, { borderTopColor: isDark ? "#1E293B" : "#E2E8F0", backgroundColor: isDark ? "#1E293B" : "#FFFFFF" }]}>
            <View style={[styles.inputWrapper, { backgroundColor: isDark ? "#0F172A" : "#F1F5F9", borderColor: isDark ? "#334155" : "#E2E8F0" }]}>
              <TextInput
                placeholder="Tulis pesan..."
                value={input}
                onChangeText={setInput}
                style={[
                  styles.input,
                  {
                    color: isDark ? "#F8FAFC" : "#0F172A",
                  },
                ]}
                placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                multiline
                maxLength={500}
              />

              {input.trim().length > 0 && (
                <TouchableOpacity
                  style={[styles.sendBtn, { backgroundColor: PRIMARY }]}
                  onPress={handleSend}
                  activeOpacity={0.85}
                >
                  <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              )}
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backBtn: { padding: 4 },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatarWrapper: { position: "relative" },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  onlineDot: {
    position: "absolute",
    bottom: 0,
    right: 0,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: "#22C55E",
    borderWidth: 2,
    borderColor: "#FFF",
  },
  headerTitle: { fontSize: 16, fontWeight: "800" },
  headerSubTitle: { fontSize: 11, color: "#64748B", marginTop: 1 },
  headerOptionBtn: { padding: 4 },

  propertyCardWrapper: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 4 },
  propertyCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 10,
    borderRadius: 14,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
  },
  propertyImage: { width: 64, height: 64, borderRadius: 10, marginRight: 12 },
  propertyHeaderRow: { flexDirection: "row", alignItems: "center" },
  propertyTitle: { fontSize: 14, fontWeight: "800" },
  propertyPrice: { fontSize: 14, fontWeight: "900", color: PRIMARY, marginVertical: 2 },
  locationRow: { flexDirection: "row", alignItems: "center", gap: 2 },
  locationText: { fontSize: 11, color: "#64748B" },
  viewPropertyBtn: {
    backgroundColor: PRIMARY,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  viewPropertyBtnText: { color: "#FFF", fontSize: 11, fontWeight: "800" },

  loadingBox: { flex: 1, justifyContent: "center", alignItems: "center" },
  loadingText: { marginTop: 8, fontSize: 12, fontWeight: "600" },

  messageRow: { marginBottom: 12, maxWidth: "80%" },
  left: { alignSelf: "flex-start" },
  right: { alignSelf: "flex-end" },
  bubble: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: 16 },
  myBubble: { borderBottomRightRadius: 2, shadowColor: PRIMARY, shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.2, shadowRadius: 3, elevation: 1 },
  otherBubble: { borderBottomLeftRadius: 2, borderWidth: 0.5, borderColor: "#E2E8F0" },
  messageText: { fontSize: 14, lineHeight: 21, fontWeight: "500" },
  timeRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 4 },
  timeText: { fontSize: 10, fontWeight: "600" },

  restrictionBanner: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  restrictionText: { color: "#EF4444", fontSize: 12, fontWeight: "700", flex: 1 },

  inputBar: { paddingHorizontal: 12, paddingVertical: 6, borderTopWidth: 1 },
  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 12,
    paddingVertical: 2,
  },
  input: { flex: 1, fontSize: 14, maxHeight: 100, paddingVertical: 4 },
  sendBtn: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center", marginLeft: 6 },
});
