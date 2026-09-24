import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
  FlatList,
  Image,
  KeyboardAvoidingView,
  NativeScrollEvent,
  NativeSyntheticEvent,
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
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Haptics from "expo-haptics";
import { useAuth } from "../contexts/AuthContext";
import { useLands } from "../contexts/LandContext";
import { useTheme } from "../contexts/ThemeContext";
import { useChat, Message } from "../contexts/ChatContext";
import { avatarColor, dayKey, formatClock, formatDayLabel, getInitials } from "../utils/chatFormat";

const PRIMARY = "#2E7D32";
const PLACEHOLDER = "https://images.unsplash.com/photo-1501785888041-af3ef285b470?w=800";
const POLL_MS = 4000;
const MAX_LEN = 1000;
const GROUP_GAP_MS = 5 * 60 * 1000; // messages closer than this from the same sender are grouped

type LocalStatus = "sending" | "failed";
type ChatMessage = Message & { localStatus?: LocalStatus };
type Row =
  | { kind: "day"; key: string; label: string }
  | { kind: "msg"; key: string; msg: ChatMessage; isMe: boolean; first: boolean; last: boolean };

const QUICK_REPLIES: Record<"buyer" | "owner", string[]> = {
  buyer: [
    "Halo, apakah properti ini masih tersedia?",
    "Apakah harganya masih bisa nego?",
    "Bisakah saya survei lokasi minggu ini?",
    "Bagaimana status sertifikatnya?",
    "Apakah bisa KPR?",
  ],
  owner: [
    "Halo, properti masih tersedia 😊",
    "Kapan Anda bisa survei lokasi?",
    "Harga masih bisa dinegosiasikan.",
    "Sertifikat SHM, siap balik nama.",
    "Terima kasih atas minatnya!",
  ],
};

const STATUS_LABEL: Record<string, { text: string; color: string; bg: string }> = {
  Approved: { text: "Tersedia", color: "#16A34A", bg: "#DCFCE7" },
  Sold: { text: "Terjual", color: "#64748B", bg: "#E2E8F0" },
  Pending: { text: "Menunggu verifikasi", color: "#CA8A04", bg: "#FEF9C3" },
  Rejected: { text: "Ditolak", color: "#DC2626", bg: "#FEE2E2" },
  Archived: { text: "Diarsipkan", color: "#64748B", bg: "#E2E8F0" },
};

export default function ChatRoom() {
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { lands } = useLands();
  const { conversations, refreshConversations, getMessagesForConversation, sendMessage, markAsRead } = useChat();
  const router = useRouter();
  const params = useLocalSearchParams<{ chatId?: string; propertyId?: string; ownerName?: string; autoMessage?: string }>();

  const chatId = params.chatId ? String(params.chatId) : "";
  const listRef = useRef<FlatList<Row>>(null);
  const inputRef = useRef<TextInput>(null);

  const [serverMessages, setServerMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState(params.autoMessage ? String(params.autoMessage) : "");
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [showQuickReplies, setShowQuickReplies] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [newWhileScrolled, setNewWhileScrolled] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const atBottomRef = useRef(true);

  const c = {
    bg: isDark ? "#0F172A" : "#F1F5F9",
    surface: isDark ? "#1E293B" : "#FFFFFF",
    border: isDark ? "#334155" : "#E2E8F0",
    text: isDark ? "#F8FAFC" : "#0F172A",
    muted: "#64748B",
    otherBubble: isDark ? "#1E293B" : "#FFFFFF",
  };

  /* ── Conversation / property / roles ── */
  const conversation = useMemo(() => conversations.find((cv) => cv.id === chatId), [conversations, chatId]);

  // A conversation opened right after "Contact Agent" may not be in the list yet
  useEffect(() => {
    if (chatId && !conversation) refreshConversations();
  }, [chatId, !!conversation]);

  const propertyId = conversation?.propertyId || (params.propertyId ? String(params.propertyId) : "");
  const land = lands.find((l) => String(l.id) === propertyId);
  const property = {
    id: propertyId,
    name: land?.name ?? conversation?.propertyTitle ?? "Properti",
    image: land?.image ?? conversation?.propertyImage ?? PLACEHOLDER,
    price: land?.price ?? conversation?.propertyPrice ?? 0,
    location: land?.location ?? conversation?.propertyLocation ?? "",
    status: land?.status ?? conversation?.propertyStatus,
    isForSale: land?.isForSale ?? true,
  };

  const myRole: "buyer" | "owner" =
    conversation ? (conversation.ownerId === user?.id ? "owner" : "buyer") : user?.userType === "owner" ? "owner" : "buyer";
  const partnerName =
    myRole === "buyer"
      ? conversation?.ownerName || (params.ownerName ? String(params.ownerName) : "") || "Pemilik Properti"
      : conversation?.buyerName || "Calon Pembeli";

  // Unknown status (property not loaded) should not block the chat
  const canChat = !property.status || property.status === "Approved" || property.status === "Sold";

  /* ── Loading & polling ── */
  const lastIncomingCount = useRef(0);

  const loadMessages = useCallback(async () => {
    if (!chatId) return;
    try {
      const msgs = await getMessagesForConversation(chatId);
      // A poll that started before our last send finished may not contain it yet — keep it
      setServerMessages((prev) => {
        const ids = new Set(msgs.map((m) => m.id));
        const justSent = prev.filter(
          (m) => !ids.has(m.id) && m.senderId === user?.id && Date.now() - new Date(m.createdAt).getTime() < 15000
        );
        return justSent.length ? [...msgs, ...justSent] : msgs;
      });
      setLoadError(false);

      // New messages from the other side → mark read, and tell the user if they're scrolled up
      const incoming = msgs.filter((m) => m.senderId !== user?.id).length;
      if (incoming > lastIncomingCount.current) {
        if (lastIncomingCount.current > 0 && !atBottomRef.current) {
          setNewWhileScrolled((n) => n + (incoming - lastIncomingCount.current));
        }
        markAsRead(chatId);
      }
      lastIncomingCount.current = incoming;
    } catch {
      setLoadError(true);
    } finally {
      setIsLoading(false);
    }
  }, [chatId, user?.id, getMessagesForConversation, markAsRead]);

  // Poll only while this screen is focused and the app is in the foreground
  useFocusEffect(
    useCallback(() => {
      loadMessages();
      markAsRead(chatId);
      let timer: ReturnType<typeof setInterval> | null = setInterval(loadMessages, POLL_MS);
      const sub = AppState.addEventListener("change", (s) => {
        if (s === "active") {
          loadMessages();
          if (!timer) timer = setInterval(loadMessages, POLL_MS);
        } else if (timer) {
          clearInterval(timer);
          timer = null;
        }
      });
      return () => {
        if (timer) clearInterval(timer);
        sub.remove();
      };
    }, [loadMessages, chatId])
  );

  /* ── Rows for the (inverted) list: day separators + grouping ── */
  const rows: Row[] = useMemo(() => {
    const all: ChatMessage[] = [...serverMessages, ...pending];
    const out: Row[] = [];
    let prevDay = "";
    all.forEach((msg, i) => {
      const day = dayKey(msg.createdAt);
      if (day !== prevDay) {
        out.push({ kind: "day", key: `day-${day}-${i}`, label: formatDayLabel(msg.createdAt) });
        prevDay = day;
      }
      const isMe = msg.senderId === user?.id || (!msg.senderId && msg.senderRole === myRole);
      const prev = all[i - 1];
      const next = all[i + 1];
      const sameAs = (o?: ChatMessage) =>
        !!o &&
        (o.senderId === msg.senderId) &&
        dayKey(o.createdAt) === day &&
        Math.abs(new Date(o.createdAt).getTime() - new Date(msg.createdAt).getTime()) < GROUP_GAP_MS;
      out.push({ kind: "msg", key: msg.id, msg, isMe, first: !sameAs(prev), last: !sameAs(next) });
    });
    return out.reverse(); // inverted list → newest first
  }, [serverMessages, pending, user?.id, myRole]);

  const hasMessages = serverMessages.length + pending.length > 0;

  /* ── Sending (optimistic) ── */
  const deliver = async (msg: ChatMessage) => {
    try {
      const saved = await sendMessage({
        conversationId: chatId,
        senderId: user!.id,
        senderRole: myRole,
        senderName: user!.fullName || "Pengguna",
        text: msg.text,
      });
      setServerMessages((prev) => (prev.some((m) => m.id === saved.id) ? prev : [...prev, saved]));
      setPending((prev) => prev.filter((p) => p.id !== msg.id));
    } catch {
      setPending((prev) => prev.map((p) => (p.id === msg.id ? { ...p, localStatus: "failed" } : p)));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  };

  const send = (text: string) => {
    const clean = text.trim();
    if (!clean || !user || !chatId) return;
    const now = new Date().toISOString();
    const temp: ChatMessage = {
      id: `local-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      conversationId: chatId,
      senderId: user.id,
      senderRole: myRole,
      senderName: user.fullName || "",
      text: clean,
      time: formatClock(now),
      createdAt: now,
      status: "sent",
      localStatus: "sending",
    };
    setPending((prev) => [...prev, temp]);
    setShowQuickReplies(false);
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    deliver(temp);
  };

  const handleSend = () => {
    if (!input.trim()) return;
    send(input);
    setInput("");
  };

  const retry = (msg: ChatMessage) => {
    setPending((prev) => prev.map((p) => (p.id === msg.id ? { ...p, localStatus: "sending" } : p)));
    deliver(msg);
  };

  const showToast = (text: string) => {
    setToast(text);
    setTimeout(() => setToast(null), 1600);
  };

  const onLongPress = (msg: ChatMessage) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (msg.localStatus === "failed") {
      Alert.alert("Pesan gagal terkirim", msg.text, [
        { text: "Hapus", style: "destructive", onPress: () => setPending((p) => p.filter((x) => x.id !== msg.id)) },
        { text: "Salin", onPress: () => Clipboard.setStringAsync(msg.text).then(() => showToast("Pesan disalin")) },
        { text: "Kirim ulang", onPress: () => retry(msg) },
      ]);
      return;
    }
    Clipboard.setStringAsync(msg.text).then(() => showToast("Pesan disalin"));
  };

  /* ── Scroll handling (inverted: offset 0 = newest) ── */
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const y = e.nativeEvent.contentOffset.y;
    const atBottom = y < 120;
    atBottomRef.current = atBottom;
    setShowJump(y > 400);
    if (atBottom && newWhileScrolled) setNewWhileScrolled(0);
  };

  const jumpToLatest = () => {
    listRef.current?.scrollToOffset({ offset: 0, animated: true });
    setNewWhileScrolled(0);
  };

  if (!user) return null;

  /* ── Renderers ── */
  const renderRow = ({ item }: { item: Row }) => {
    if (item.kind === "day") {
      return (
        <View style={styles.dayRow}>
          <View style={[styles.dayPill, { backgroundColor: isDark ? "#1E293B" : "#E2E8F0" }]}>
            <Text style={[styles.dayText, { color: isDark ? "#CBD5E1" : "#475569" }]}>{item.label}</Text>
          </View>
        </View>
      );
    }
    const { msg, isMe, first, last } = item;
    const failed = msg.localStatus === "failed";
    return (
      <View style={[styles.messageRow, isMe ? styles.right : styles.left, { marginTop: first ? 10 : 2 }]}>
        <TouchableOpacity
          activeOpacity={0.8}
          onLongPress={() => onLongPress(msg)}
          onPress={failed ? () => retry(msg) : undefined}
          delayLongPress={300}
          style={[
            styles.bubble,
            isMe
              ? { backgroundColor: failed ? "#FEE2E2" : PRIMARY, borderBottomRightRadius: last ? 4 : 18, borderTopRightRadius: first ? 18 : 6 }
              : { backgroundColor: c.otherBubble, borderColor: c.border, borderWidth: isDark ? 0 : 1, borderBottomLeftRadius: last ? 4 : 18, borderTopLeftRadius: first ? 18 : 6 },
          ]}
        >
          <Text style={[styles.messageText, { color: isMe ? (failed ? "#991B1B" : "#FFFFFF") : c.text }]}>{msg.text}</Text>
          <View style={styles.metaRow}>
            <Text style={[styles.timeText, { color: isMe ? (failed ? "#B91C1C" : "rgba(255,255,255,0.75)") : "#94A3B8" }]}>
              {formatClock(msg.createdAt) || msg.time}
            </Text>
            {isMe &&
              (msg.localStatus === "sending" ? (
                <Ionicons name="time-outline" size={12} color="rgba(255,255,255,0.75)" style={styles.statusIcon} />
              ) : failed ? (
                <Ionicons name="alert-circle" size={13} color="#DC2626" style={styles.statusIcon} />
              ) : msg.status === "read" ? (
                <Ionicons name="checkmark-done" size={14} color="#86EFAC" style={styles.statusIcon} />
              ) : (
                <Ionicons name="checkmark" size={14} color="rgba(255,255,255,0.75)" style={styles.statusIcon} />
              ))}
          </View>
        </TouchableOpacity>
        {failed && <Text style={styles.failedText}>Gagal terkirim · ketuk untuk kirim ulang</Text>}
      </View>
    );
  };

  const statusInfo = property.status ? STATUS_LABEL[property.status] : undefined;
  const quickReplies = QUICK_REPLIES[myRole];

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: c.surface }]} edges={["top", "left", "right", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding" keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 24}>
        {/* ===== HEADER ===== */}
        <View style={[styles.header, { borderBottomColor: c.border, backgroundColor: c.surface }]}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={8}>
            <Ionicons name="chevron-back" size={26} color={PRIMARY} />
          </TouchableOpacity>
          <View style={[styles.avatarCircle, { backgroundColor: avatarColor(partnerName) }]}>
            <Text style={styles.avatarText}>{getInitials(partnerName)}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerTitle, { color: c.text }]} numberOfLines={1}>{partnerName}</Text>
            <Text style={styles.headerSubTitle} numberOfLines={1}>
              {myRole === "buyer" ? "Pemilik properti" : "Calon pembeli"}
            </Text>
          </View>
        </View>

        {/* ===== PROPERTY CONTEXT ===== */}
        <TouchableOpacity
          activeOpacity={0.85}
          disabled={!property.id}
          onPress={() => router.push(`/product/${property.id}`)}
          style={[styles.propertyCard, { backgroundColor: c.surface, borderBottomColor: c.border }]}
        >
          <Image source={{ uri: property.image || PLACEHOLDER }} style={styles.propertyImage} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.propertyTitle, { color: c.text }]} numberOfLines={1}>{property.name}</Text>
            <Text style={styles.propertyPrice} numberOfLines={1}>
              Rp {(property.price || 0).toLocaleString("id-ID")}
              {!property.isForSale && <Text style={styles.propertyPriceUnit}> /bulan</Text>}
            </Text>
            {statusInfo && (
              <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
                <Text style={[styles.statusBadgeText, { color: statusInfo.color }]}>{statusInfo.text}</Text>
              </View>
            )}
          </View>
          <View style={styles.viewPropertyBtn}>
            <Text style={styles.viewPropertyBtnText}>Detail</Text>
            <Ionicons name="chevron-forward" size={14} color={PRIMARY} />
          </View>
        </TouchableOpacity>

        {/* ===== MESSAGES ===== */}
        <View style={[styles.messagesArea, { backgroundColor: c.bg }]}>
          {isLoading ? (
            <View style={styles.centerBox}>
              <ActivityIndicator color={PRIMARY} />
              <Text style={styles.centerText}>Memuat pesan…</Text>
            </View>
          ) : loadError && !hasMessages ? (
            <View style={styles.centerBox}>
              <Ionicons name="cloud-offline-outline" size={36} color="#94A3B8" />
              <Text style={styles.centerText}>Pesan tidak dapat dimuat.</Text>
              <TouchableOpacity style={styles.retryBtn} onPress={() => { setIsLoading(true); loadMessages(); }}>
                <Text style={styles.retryText}>Coba lagi</Text>
              </TouchableOpacity>
            </View>
          ) : !hasMessages ? (
            <ScrollView contentContainerStyle={styles.welcomeBox} keyboardShouldPersistTaps="handled">
              <View style={styles.welcomeIcon}>
                <Ionicons name="chatbubbles" size={30} color={PRIMARY} />
              </View>
              <Text style={[styles.welcomeTitle, { color: c.text }]}>Mulai percakapan dengan {partnerName}</Text>
              <Text style={styles.welcomeText}>
                {myRole === "buyer"
                  ? "Tanyakan ketersediaan, harga, atau jadwal survei. Pilih salah satu pertanyaan di bawah untuk memulai:"
                  : "Balas pertanyaan calon pembeli. Pilih salah satu balasan cepat di bawah:"}
              </Text>
              {canChat &&
                quickReplies.map((q) => (
                  <TouchableOpacity key={q} style={[styles.welcomeChip, { backgroundColor: c.surface, borderColor: c.border }]} onPress={() => send(q)}>
                    <Text style={[styles.welcomeChipText, { color: c.text }]}>{q}</Text>
                    <Ionicons name="send" size={14} color={PRIMARY} />
                  </TouchableOpacity>
                ))}
            </ScrollView>
          ) : (
            <FlatList
              ref={listRef}
              inverted
              data={rows}
              keyExtractor={(r) => r.key}
              renderItem={renderRow}
              contentContainerStyle={{ paddingHorizontal: 12, paddingVertical: 10 }}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              onScroll={onScroll}
              scrollEventThrottle={100}
            />
          )}

          {/* Jump to latest */}
          {(showJump || newWhileScrolled > 0) && hasMessages && (
            <TouchableOpacity style={[styles.jumpBtn, { backgroundColor: c.surface, borderColor: c.border }]} onPress={jumpToLatest}>
              {newWhileScrolled > 0 && (
                <View style={styles.jumpBadge}>
                  <Text style={styles.jumpBadgeText}>{newWhileScrolled}</Text>
                </View>
              )}
              <Ionicons name="chevron-down" size={20} color={PRIMARY} />
            </TouchableOpacity>
          )}

          {/* Toast */}
          {toast && (
            <View style={styles.toast} pointerEvents="none">
              <Ionicons name="copy-outline" size={14} color="#FFF" />
              <Text style={styles.toastText}>{toast}</Text>
            </View>
          )}
        </View>

        {/* ===== INPUT ===== */}
        {!canChat ? (
          <View style={[styles.restrictionBanner, { borderTopColor: c.border, backgroundColor: c.surface }]}>
            <Ionicons name="lock-closed-outline" size={18} color="#DC2626" />
            <Text style={styles.restrictionText}>
              Properti ini {statusInfo?.text.toLowerCase() ?? "tidak tersedia"}, jadi percakapan dinonaktifkan sementara.
            </Text>
          </View>
        ) : (
          <View style={[styles.inputArea, { borderTopColor: c.border, backgroundColor: c.surface }]}>
            {showQuickReplies && hasMessages && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.quickRow}>
                {quickReplies.map((q) => (
                  <TouchableOpacity key={q} style={[styles.quickChip, { borderColor: PRIMARY + "55" }]} onPress={() => send(q)}>
                    <Text style={styles.quickChipText} numberOfLines={1}>{q}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            <View style={styles.inputRow}>
              {hasMessages && (
                <TouchableOpacity
                  style={[styles.quickToggle, showQuickReplies && { backgroundColor: PRIMARY + "18" }]}
                  onPress={() => setShowQuickReplies((v) => !v)}
                  hitSlop={6}
                >
                  <Ionicons name={showQuickReplies ? "close" : "flash-outline"} size={20} color={PRIMARY} />
                </TouchableOpacity>
              )}
              <View style={[styles.inputWrapper, { backgroundColor: isDark ? "#0F172A" : "#F1F5F9", borderColor: c.border }]}>
                <TextInput
                  ref={inputRef}
                  placeholder="Tulis pesan…"
                  value={input}
                  onChangeText={setInput}
                  style={[styles.input, { color: c.text }]}
                  placeholderTextColor={isDark ? "#64748B" : "#94A3B8"}
                  multiline
                  maxLength={MAX_LEN}
                />
              </View>
              <TouchableOpacity
                style={[styles.sendBtn, { backgroundColor: input.trim() ? PRIMARY : isDark ? "#334155" : "#CBD5E1" }]}
                onPress={handleSend}
                disabled={!input.trim()}
                activeOpacity={0.85}
              >
                <Ionicons name="send" size={17} color="#FFFFFF" style={{ marginLeft: 2 }} />
              </TouchableOpacity>
            </View>
            {input.length > MAX_LEN * 0.8 && (
              <Text style={[styles.counter, input.length >= MAX_LEN && { color: "#DC2626" }]}>
                {input.length}/{MAX_LEN}
              </Text>
            )}
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 12, paddingVertical: 10, borderBottomWidth: 1 },
  backBtn: { padding: 2 },
  avatarCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#FFF", fontWeight: "800", fontSize: 15 },
  headerTitle: { fontSize: 16, fontWeight: "800" },
  headerSubTitle: { fontSize: 12, color: "#64748B", marginTop: 1 },

  propertyCard: { flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 14, paddingVertical: 10, borderBottomWidth: 1 },
  propertyImage: { width: 52, height: 52, borderRadius: 10 },
  propertyTitle: { fontSize: 13, fontWeight: "800" },
  propertyPrice: { fontSize: 14, fontWeight: "900", color: PRIMARY, marginTop: 1 },
  propertyPriceUnit: { fontSize: 11, fontWeight: "600", color: "#64748B" },
  statusBadge: { alignSelf: "flex-start", paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, marginTop: 3 },
  statusBadgeText: { fontSize: 10, fontWeight: "800" },
  viewPropertyBtn: { flexDirection: "row", alignItems: "center", paddingHorizontal: 10, paddingVertical: 7, borderRadius: 10, backgroundColor: PRIMARY + "14" },
  viewPropertyBtnText: { color: PRIMARY, fontSize: 12, fontWeight: "800" },

  messagesArea: { flex: 1 },
  centerBox: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
  centerText: { fontSize: 13, color: "#64748B" },
  retryBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10, backgroundColor: PRIMARY },
  retryText: { color: "#FFF", fontWeight: "800", fontSize: 13 },

  welcomeBox: { flexGrow: 1, alignItems: "center", justifyContent: "center", padding: 24 },
  welcomeIcon: { width: 64, height: 64, borderRadius: 32, backgroundColor: PRIMARY + "18", alignItems: "center", justifyContent: "center" },
  welcomeTitle: { fontSize: 16, fontWeight: "800", marginTop: 14, textAlign: "center" },
  welcomeText: { fontSize: 13, color: "#64748B", textAlign: "center", marginTop: 6, marginBottom: 14, lineHeight: 19 },
  welcomeChip: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, alignSelf: "stretch", paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, marginBottom: 8 },
  welcomeChipText: { flex: 1, fontSize: 13, fontWeight: "600" },

  dayRow: { alignItems: "center", marginVertical: 10 },
  dayPill: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  dayText: { fontSize: 11, fontWeight: "700" },

  messageRow: { maxWidth: "80%" },
  left: { alignSelf: "flex-start" },
  right: { alignSelf: "flex-end", alignItems: "flex-end" },
  bubble: { paddingHorizontal: 13, paddingTop: 8, paddingBottom: 6, borderRadius: 18 },
  messageText: { fontSize: 14.5, lineHeight: 20 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 3 },
  timeText: { fontSize: 10, fontWeight: "600" },
  statusIcon: { marginLeft: 3 },
  failedText: { fontSize: 10, color: "#DC2626", marginTop: 3, fontWeight: "600" },

  jumpBtn: { position: "absolute", right: 14, bottom: 12, width: 40, height: 40, borderRadius: 20, borderWidth: 1, alignItems: "center", justifyContent: "center", elevation: 3, shadowColor: "#000", shadowOpacity: 0.12, shadowRadius: 4, shadowOffset: { width: 0, height: 2 } },
  jumpBadge: { position: "absolute", top: -6, right: -4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: PRIMARY, alignItems: "center", justifyContent: "center", paddingHorizontal: 4 },
  jumpBadgeText: { color: "#FFF", fontSize: 10, fontWeight: "900" },

  toast: { position: "absolute", bottom: 16, alignSelf: "center", flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(15,23,42,0.9)", paddingHorizontal: 14, paddingVertical: 8, borderRadius: 18 },
  toastText: { color: "#FFF", fontSize: 12, fontWeight: "700" },

  restrictionBanner: { flexDirection: "row", alignItems: "center", gap: 8, paddingHorizontal: 16, paddingVertical: 14, borderTopWidth: 1 },
  restrictionText: { flex: 1, color: "#DC2626", fontSize: 12, fontWeight: "600" },

  inputArea: { borderTopWidth: 1, paddingTop: 6, paddingBottom: 6 },
  quickRow: { gap: 6, paddingHorizontal: 12, paddingBottom: 6 },
  quickChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1, backgroundColor: PRIMARY + "0D", maxWidth: 260 },
  quickChipText: { fontSize: 12, fontWeight: "700", color: PRIMARY },
  inputRow: { flexDirection: "row", alignItems: "flex-end", gap: 8, paddingHorizontal: 10 },
  quickToggle: { width: 38, height: 40, borderRadius: 12, alignItems: "center", justifyContent: "center" },
  inputWrapper: { flex: 1, borderWidth: 1, borderRadius: 22, paddingHorizontal: 14, minHeight: 42, justifyContent: "center" },
  input: { fontSize: 14.5, maxHeight: 110, paddingVertical: Platform.OS === "ios" ? 10 : 6 },
  sendBtn: { width: 42, height: 42, borderRadius: 21, alignItems: "center", justifyContent: "center" },
  counter: { alignSelf: "flex-end", fontSize: 10, color: "#64748B", marginRight: 64, marginTop: 2 },
});
