import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  TextInput,
  Share,
  Alert,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { useLands, Land } from "../../contexts/LandContext";
import { useAuth } from "../../contexts/AuthContext";

export default function HomeOwner() {
  const { theme } = useTheme();
  const router = useRouter();
  const { user } = useAuth();
  const { lands = [], setLands, notifications = [], setNotifications, addNotification } = useLands() || {};
  const [showNotificationsModal, setShowNotificationsModal] = useState(false);

  const ownerNotifications = useMemo(() => {
    return notifications.filter((n) => n.ownerName === user?.fullName);
  }, [notifications, user?.fullName]);

  const unreadCount = useMemo(() => {
    return ownerNotifications.filter((n) => !n.read).length;
  }, [ownerNotifications]);

  const handleMarkAllRead = () => {
    if (setNotifications) {
      setNotifications((prev) =>
        prev.map((n) => (n.ownerName === user?.fullName ? { ...n, read: true } : n))
      );
    }
  };

  // State untuk pencarian dan filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedFilter, setSelectedFilter] = useState<"semua" | "dijual" | "disewa">("semua");

  // State untuk tips aktif
  const [activeTipIndex, setActiveTipIndex] = useState(0);

  const tips = [
    "Properti dengan foto & deskripsi lengkap cenderung lebih cepat diminati pembeli.",
    "Tanggapi chat calon pembeli dalam waktu kurang dari 15 menit untuk meningkatkan konversi.",
    "Gunakan foto sudut lebar (wide-angle) dan pencahayaan terang saat memotret properti Anda.",
    "Tentukan harga sewa/jual yang realistis dengan memantau kisaran harga pasar daerah sekitar.",
  ];

  // Auto-rotate tips setiap 10 detik
  useEffect(() => {
    const interval = setInterval(() => {
      setActiveTipIndex((prev) => (prev + 1) % tips.length);
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  // Hitung statistik dinamis
  const stats = useMemo(() => {
    const totalProperties = lands.length;
    const totalViews = lands.reduce((sum, item) => sum + (item.views || 0), 0);
    const totalFavorites = lands.reduce((sum, item) => sum + (item.favorites || 0), 0);
    const totalInquiries = lands.reduce((sum, item) => sum + (item.inquiriesCount || 0), 0);

    return { totalProperties, totalViews, totalFavorites, totalInquiries };
  }, [lands]);

  // Mock data untuk Calon Pembeli (Leads)
  const mockLeads = [
    {
      id: "l1",
      buyerName: "Adit Nugroho",
      propertyName: "Rumah Minimalis Modern Sleman",
      time: "5 menit yang lalu",
      avatar: "A",
    },
    {
      id: "l2",
      buyerName: "Dewi Lestari",
      propertyName: "Apartemen Studio Mewah Malioboro",
      time: "2 jam yang lalu",
      avatar: "D",
    },
    {
      id: "l3",
      buyerName: "Fajar Prasetyo",
      propertyName: "Cluster Eksklusif Sentul Residence",
      time: "1 hari yang lalu",
      avatar: "F",
    },
  ];

  // Filter properti berdasarkan search query dan tab filter
  const filteredLands = useMemo(() => {
    return lands.filter((item) => {
      const matchesOwner = item.owner === user?.fullName;

      const matchesSearch =
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.location.toLowerCase().includes(searchQuery.toLowerCase());

      const matchesCategory =
        selectedFilter === "semua" ||
        (selectedFilter === "dijual" && item.isForSale) ||
        (selectedFilter === "disewa" && !item.isForSale);

      return matchesOwner && matchesSearch && matchesCategory;
    });
  }, [lands, searchQuery, selectedFilter, user?.fullName]);

  // Handler toggle status ketersediaan properti (Approved vs Sold vs Archived)
  const handleToggleStatus = (id: string, currentStatus?: string) => {
    const targetLand = lands.find((l) => l.id === id);
    if (!targetLand) return;

    if (currentStatus === "Sold" || currentStatus === "Archived") {
      Alert.alert(
        "Ubah Status Properti",
        "Apakah Anda yakin ingin mengaktifkan kembali properti ini menjadi Tersedia?",
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Aktifkan",
            onPress: () => {
              if (setLands) {
                setLands((prevLands) =>
                  prevLands.map((item) =>
                    item.id === id ? { ...item, status: "Approved" } : item
                  )
                );
                if (addNotification) {
                  addNotification(id, targetLand.name, "approved", user?.fullName || "Owner");
                }
              }
            },
          },
        ]
      );
    } else if (currentStatus === "Approved") {
      Alert.alert(
        "Ubah Status Properti",
        "Pilih status baru untuk properti Anda:",
        [
          { text: "Batal", style: "cancel" },
          {
            text: "Tandai Terjual",
            onPress: () => {
              if (setLands) {
                setLands((prevLands) =>
                  prevLands.map((item) =>
                    item.id === id ? { ...item, status: "Sold" } : item
                  )
                );
                if (addNotification) {
                  addNotification(id, targetLand.name, "sold", user?.fullName || "Owner");
                }
              }
            },
          },
          {
            text: "Arsipkan",
            onPress: () => {
              if (setLands) {
                setLands((prevLands) =>
                  prevLands.map((item) =>
                    item.id === id ? { ...item, status: "Archived" } : item
                  )
                );
                if (addNotification) {
                  addNotification(id, targetLand.name, "archived", user?.fullName || "Owner");
                }
              }
            },
          },
        ]
      );
    } else if (currentStatus === "Pending") {
      Alert.alert("Info", "Properti Anda sedang menunggu persetujuan administrator.");
    } else if (currentStatus === "Rejected") {
      Alert.alert(
        "Pengajuan Ditolak",
        `Alasan: "${targetLand.rejectionReason || "Lokasi properti tidak sesuai."}"\n\nSilakan hubungi administrator atau ajukan properti baru.`
      );
    }
  };

  // Handler membagikan ringkasan properti
  const handleShareProperty = async (item: Land) => {
    try {
      const typeLabel = item.isForSale ? "Dijual" : "Disewa";
      const priceText = `Rp ${(item.price || 0).toLocaleString("id-ID")}${item.isForSale ? "" : " / tahun"}`;
      const message = `*${item.name}* (${typeLabel})\n📍 Lokasi: ${item.location}\n💰 Harga: ${priceText}\n\nHubungi saya untuk detail selengkapnya melalui aplikasi Lokatani!`;
      
      await Share.share({ message });
    } catch (error) {
      console.error("Gagal membagikan properti:", error);
    }
  };

  if (!lands) {
    return (
      <View style={[styles.loading, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.primary} />
        <Text style={{ color: theme.text, marginTop: 12 }}>Memuat dashboard properti...</Text>
      </View>
    );
  }

  // Generate inisial nama untuk avatar fallback
  const getInitials = (name?: string) => {
    if (!name) return "O";
    return name.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]} edges={["top"]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 110 }}>
        
        {/* 👋 Header & Owner Profile */}
        <View style={styles.header}>
          <View style={styles.headerLeft}>
            <Text style={[styles.greeting, { color: theme.textSecondary }]}>Selamat Datang 👋</Text>
            <Text style={[styles.ownerName, { color: theme.text }]} numberOfLines={1}>
              {user?.fullName || "Pemilik Properti"}
            </Text>
          </View>
          
          <View style={styles.headerRight}>
            {/* Notification Bell */}
            <TouchableOpacity 
              style={[styles.bellButton, { backgroundColor: theme.card, borderColor: theme.border }]}
              onPress={() => setShowNotificationsModal(true)}
            >
              <Ionicons name="notifications-outline" size={22} color={theme.text} />
              {unreadCount > 0 && (
                <View style={[styles.bellBadge, { backgroundColor: theme.error || "#EF4444" }]}>
                  <Text style={styles.bellBadgeText}>{unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>

            {user?.photo ? (
              <Image source={{ uri: user.photo }} style={[styles.avatar, { borderColor: theme.border }]} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: theme.primary + "20", borderColor: theme.primary }]}>
                <Text style={[styles.avatarFallbackText, { color: theme.primary }]}>
                  {getInitials(user?.fullName)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* 💡 Tips Panel (Interactive Carousel) */}
        <View style={[styles.insightCard, { backgroundColor: theme.primary + "0A", borderColor: theme.primary + "20" }]}>
          <View style={styles.insightHeader}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <Ionicons name="bulb" size={18} color={theme.primary} />
              <Text style={[styles.insightTitle, { color: theme.primary }]}>Tips Penjualan</Text>
            </View>
            <View style={styles.tipsIndicator}>
              {tips.map((_, idx) => (
                <View
                  key={idx}
                  style={[
                    styles.indicatorDot,
                    {
                      backgroundColor: idx === activeTipIndex ? theme.primary : theme.textSecondary + "30",
                      width: idx === activeTipIndex ? 16 : 6,
                    },
                  ]}
                />
              ))}
            </View>
          </View>
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => setActiveTipIndex((prev) => (prev + 1) % tips.length)}
          >
            <Text style={[styles.insightText, { color: theme.text }]}>
              {tips[activeTipIndex]}
            </Text>
          </TouchableOpacity>
        </View>

        {/* 📊 Ringkasan Statistik & Performa Properti */}
        <View style={styles.statsGrid}>
          <View style={styles.statsRow}>
            <StatCard icon="home-outline" label="Total Properti" value={stats.totalProperties} theme={theme} />
            <StatCard icon="eye-outline" label="Total Dilihat" value={stats.totalViews} theme={theme} />
          </View>
          <View style={styles.statsRow}>
            <StatCard icon="heart-outline" label="Total Favorit" value={stats.totalFavorites} theme={theme} />
            <StatCard icon="chatbubbles-outline" label="Chat Inquiry" value={stats.totalInquiries || 12} theme={theme} />
          </View>
        </View>

        {/* 👤 Calon Pembeli Tertarik (Leads) Panel */}
        {lands.length > 0 && (
          <View style={styles.leadsSection}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>Calon Pembeli Tertarik (Leads)</Text>
            <View style={[styles.leadsCard, { backgroundColor: theme.card, borderColor: theme.border }]}>
              {mockLeads.map((lead, index) => (
                <View key={lead.id}>
                  <View style={styles.leadItem}>
                    <View style={[styles.leadAvatar, { backgroundColor: theme.primary + "15" }]}>
                      <Text style={[styles.leadAvatarText, { color: theme.primary }]}>{lead.avatar}</Text>
                    </View>
                    <View style={styles.leadInfo}>
                      <Text style={[styles.leadName, { color: theme.text }]}>{lead.buyerName}</Text>
                      <Text style={[styles.leadProp, { color: theme.textSecondary }]} numberOfLines={1}>
                        Tertarik pada: {lead.propertyName}
                      </Text>
                      <Text style={[styles.leadTime, { color: theme.textSecondary + "80" }]}>{lead.time}</Text>
                    </View>
                    <TouchableOpacity
                      style={[styles.leadChatBtn, { backgroundColor: theme.primary }]}
                      onPress={() => router.push("/chat")}
                      activeOpacity={0.8}
                    >
                      <Ionicons name="chatbubble-ellipses" size={16} color="#FFF" />
                      <Text style={styles.leadChatText}>Chat</Text>
                    </TouchableOpacity>
                  </View>
                  {index < mockLeads.length - 1 && (
                    <View style={[styles.leadDivider, { backgroundColor: theme.border + "50" }]} />
                  )}
                </View>
              ))}
            </View>
          </View>
        )}

        {/* 🔍 Search & Filter Bar */}
        <View style={styles.filterSection}>
          <View style={[styles.searchBox, { backgroundColor: theme.card, borderColor: theme.border }]}>
            <Ionicons name="search" size={20} color={theme.textSecondary} style={styles.searchIcon} />
            <TextInput
              placeholder="Cari nama properti atau lokasi..."
              placeholderTextColor={theme.textSecondary + "90"}
              style={[styles.searchInput, { color: theme.text }]}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => setSearchQuery("")}>
                <Ionicons name="close-circle" size={18} color={theme.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          {/* Filter Pills */}
          <View style={styles.pillsRow}>
            {(["semua", "dijual", "disewa"] as const).map((filter) => {
              const isActive = selectedFilter === filter;
              return (
                <TouchableOpacity
                  key={filter}
                  style={[
                    styles.pillButton,
                    {
                      backgroundColor: isActive ? theme.primary : theme.card,
                      borderColor: isActive ? theme.primary : theme.border,
                    },
                  ]}
                  onPress={() => setSelectedFilter(filter)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.pillText,
                      {
                        color: isActive ? "#FFF" : theme.textSecondary,
                        fontWeight: isActive ? "700" : "500",
                      },
                    ]}
                  >
                    {filter.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* 🏠 Properti List */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.text }]}>Kelola Hunian Anda</Text>
          <TouchableOpacity
            style={[styles.smallAddBtn, { backgroundColor: theme.primary + "15" }]}
            onPress={() => router.push("/addland")}
          >
            <Ionicons name="add" size={16} color={theme.primary} />
            <Text style={[styles.smallAddText, { color: theme.primary }]}>Tambah</Text>
          </TouchableOpacity>
        </View>

        {filteredLands.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="business-outline" size={54} color={theme.textSecondary + "60"} />
            <Text style={[styles.emptyTitle, { color: theme.text }]}>Tidak ada properti</Text>
            <Text style={[styles.emptyDesc, { color: theme.textSecondary }]}>
              {searchQuery
                ? "Tidak menemukan properti yang cocok dengan pencarian Anda."
                : "Unggah hunian rumah atau apartemen Anda untuk mulai beriklan."}
            </Text>
            {!searchQuery && (
              <TouchableOpacity
                style={[styles.primaryBtn, { backgroundColor: theme.primary }]}
                onPress={() => router.push("/addland")}
              >
                <Text style={styles.primaryText}>Tambah Properti Baru</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          filteredLands.map((item) => {
            const isSold = item.status === "Sold";
            const isArchived = item.status === "Archived";
            const isPending = item.status === "Pending";
            const isRejected = item.status === "Rejected";
            const priceText = `Rp ${(item.price || 0).toLocaleString("id-ID")}`;

            return (
              <View
                key={item.id}
                style={[
                  styles.propertyCard,
                  {
                    backgroundColor: theme.card,
                    borderColor: theme.border,
                    borderWidth: theme.borderWidth,
                    borderRadius: theme.borderRadius,
                    shadowColor: theme.shadow || "#000",
                    shadowOffset: theme.shadowOffset,
                    shadowOpacity: theme.shadowOpacity,
                    shadowRadius: theme.shadowRadius,
                    elevation: 2,
                    opacity: (isSold || isArchived || isRejected) ? 0.75 : 1,
                  },
                ]}
              >
                {/* Image Container with Badges */}
                <View style={styles.imageContainer}>
                  <Image source={{ uri: item.image }} style={styles.propertyImage} />
                  
                  {/* Status Badge (Dijual/Disewa) */}
                  <View
                    style={[
                      styles.statusBadge,
                      { backgroundColor: item.isForSale ? "#E0F2FE" : "#FEF3C7" },
                    ]}
                  >
                    <Text
                      style={{
                        color: item.isForSale ? "#0369A1" : "#B45309",
                        fontWeight: "800",
                        fontSize: 10,
                      }}
                    >
                      {item.isForSale ? "DIJUAL" : "DISEWA"}
                    </Text>
                  </View>

                  {/* Approval Status Badge */}
                  <View
                    style={[
                      styles.approvalStatusBadge,
                      {
                        backgroundColor:
                          item.status === "Pending"
                            ? "#FEF3C7"
                            : item.status === "Approved"
                            ? "#DCFCE7"
                            : item.status === "Rejected"
                            ? "#FEE2E2"
                            : item.status === "Archived"
                            ? "#F1F5F9"
                            : "#FEE2E2",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color:
                          item.status === "Pending"
                            ? "#D97706"
                            : item.status === "Approved"
                            ? "#16A34A"
                            : item.status === "Rejected"
                            ? "#EF4444"
                            : item.status === "Archived"
                            ? "#64748B"
                            : "#EF4444",
                        fontWeight: "800",
                        fontSize: 10,
                      }}
                    >
                      {item.status === "Pending"
                        ? "PENDING"
                        : item.status === "Approved"
                        ? "DISETUJUI"
                        : item.status === "Rejected"
                        ? "DITOLAK"
                        : item.status === "Archived"
                        ? "DIARSIPKAN"
                        : "TERJUAL"}
                    </Text>
                  </View>

                  {/* Availability Overlay if sold or archived or rejected */}
                  {(isSold || isArchived || isRejected) && (
                    <View style={styles.soldOverlay}>
                      <Text style={[styles.soldOverlayText, isRejected && { color: "#EF4444", borderColor: "#EF4444" }]}>
                        {isArchived ? "DIARSIPKAN" : isRejected ? "DITOLAK" : (item.isForSale ? "TERJUAL" : "TERSEWA")}
                      </Text>
                    </View>
                  )}
                </View>

                {/* Details Section */}
                <View style={styles.propertyContent}>
                  <View style={styles.propHeaderRow}>
                    <Text style={[styles.propertyName, { color: theme.text }]} numberOfLines={1}>
                      {item.name}
                    </Text>
                  </View>
                  
                  <Text style={[styles.propertyLoc, { color: theme.textSecondary }]} numberOfLines={1}>
                    📍 {item.location}
                  </Text>

                  <Text style={[styles.propertyPrice, { color: theme.primary }]}>
                    {priceText}
                    <Text style={[styles.unit, { color: theme.textSecondary }]}>
                      {item.isForSale ? "" : " /tahun"}
                    </Text>
                  </Text>

                  {/* Rejection Reason display if rejected */}
                  {isRejected && item.rejectionReason && (
                    <View style={{ backgroundColor: "#FEE2E2", padding: 10, borderRadius: 8, marginTop: 8, borderWidth: 0.5, borderColor: "#FCA5A5" }}>
                      <Text style={{ fontSize: 11, color: "#EF4444", fontWeight: "700" }}>Alasan Penolakan:</Text>
                      <Text style={{ fontSize: 11, color: "#991B1B", marginTop: 2 }}>{item.rejectionReason}</Text>
                    </View>
                  )}

                  {/* Card Stats Info */}
                  <View style={styles.metaRow}>
                    <MetaItem icon="eye-outline" value={`${item.views || 0} Dilihat`} theme={theme} />
                    <MetaItem icon="heart-outline" value={`${item.favorites || 0} Favorit`} theme={theme} />
                    <View style={{ flex: 1 }} />
                    <Text style={[
                      styles.availabilityText, 
                      { 
                        color: isSold 
                          ? theme.error 
                          : isArchived 
                          ? "#64748B" 
                          : isPending 
                          ? "#D97706" 
                          : isRejected 
                          ? theme.error 
                          : theme.success 
                      }
                    ]}>
                      ● {isSold 
                        ? (item.isForSale ? "Terjual" : "Tersewa") 
                        : isArchived 
                        ? "Diarsipkan" 
                        : isPending 
                        ? "Menunggu Persetujuan" 
                        : isRejected 
                        ? "Ditolak" 
                        : "Tersedia"}
                    </Text>
                  </View>

                  {/* Divider */}
                  <View style={[styles.cardDivider, { backgroundColor: theme.border + "50" }]} />

                  {/* Quick Action Buttons */}
                  <View style={styles.cardActions}>
                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: theme.border, borderWidth: 1 }]}
                      onPress={() => router.push(`/product/${item.id}`)}
                    >
                      <Ionicons name="information-circle-outline" size={16} color={theme.textSecondary} />
                      <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>Detail</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[styles.actionBtn, { borderColor: theme.border, borderWidth: 1 }]}
                      onPress={() => handleShareProperty(item)}
                    >
                      <Ionicons name="share-social-outline" size={16} color={theme.textSecondary} />
                      <Text style={[styles.actionBtnText, { color: theme.textSecondary }]}>Bagikan</Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                      style={[
                        styles.actionBtn,
                        {
                          backgroundColor: (isSold || isArchived) 
                            ? theme.success + "15" 
                            : (isPending || isRejected)
                            ? theme.textSecondary + "15"
                            : theme.error + "15",
                          borderColor: (isSold || isArchived)
                            ? theme.success + "40"
                            : (isPending || isRejected)
                            ? theme.textSecondary + "40"
                            : theme.error + "40",
                          borderWidth: 1,
                        },
                      ]}
                      onPress={() => handleToggleStatus(item.id, item.status)}
                    >
                      <Ionicons
                        name={
                          (isSold || isArchived) 
                            ? "checkmark-circle-outline" 
                            : isPending 
                            ? "time-outline" 
                            : isRejected 
                            ? "alert-circle-outline" 
                            : "close-circle-outline"
                        }
                        size={16}
                        color={(isSold || isArchived) ? theme.success : (isPending || isRejected) ? theme.textSecondary : theme.error}
                      />
                      <Text
                        style={[
                          styles.actionBtnText,
                          { 
                            color: (isSold || isArchived) ? theme.success : (isPending || isRejected) ? theme.textSecondary : theme.error, 
                            fontWeight: "700" 
                          },
                        ]}
                      >
                        {isSold || isArchived 
                          ? "Aktifkan" 
                          : isPending 
                          ? "Menunggu" 
                          : isRejected 
                          ? "Lihat Alasan" 
                          : "Ubah Status"}
                      </Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {/* 🗺️ Floating Map Button */}
      <TouchableOpacity
        style={[
          styles.fab,
          {
            backgroundColor: theme.primary,
            borderRadius: 30,
            shadowColor: theme.shadow || "#000",
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.25,
            shadowRadius: 8,
            elevation: 5,
          },
        ]}
         onPress={() => router.push("/maps")}
        activeOpacity={0.9}
      >
        <Ionicons name="map" size={20} color="#FFF" />
        <Text style={styles.fabText}>Peta Hunian</Text>
      </TouchableOpacity>

      {/* 🔔 Notifications Modal */}
      <Modal
        visible={showNotificationsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowNotificationsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.notificationSheet, { backgroundColor: theme.card, borderTopColor: theme.border }]}>
            <View style={styles.notificationHeader}>
              <Text style={[styles.notificationTitle, { color: theme.text }]}>Notifikasi</Text>
              <View style={{ flexDirection: "row", gap: 14, alignItems: "center" }}>
                {unreadCount > 0 && (
                  <TouchableOpacity onPress={handleMarkAllRead}>
                    <Text style={{ color: theme.primary, fontWeight: "700", fontSize: 13 }}>Tandai Dibaca</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setShowNotificationsModal(false)}>
                  <Ionicons name="close-circle" size={26} color={theme.textSecondary} />
                </TouchableOpacity>
              </View>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 40, paddingHorizontal: 16 }}>
              {ownerNotifications.length === 0 ? (
                <View style={styles.emptyNotificationState}>
                  <Ionicons name="notifications-off-outline" size={48} color={theme.textSecondary + "50"} />
                  <Text style={{ color: theme.textSecondary, marginTop: 12, textAlign: "center", fontWeight: "600" }}>
                    Belum ada notifikasi.
                  </Text>
                </View>
              ) : (
                ownerNotifications.map((n) => {
                  let badgeColor = "#EAB308";
                  let badgeIcon = "time-outline";
                  let message = "";
                  
                  if (n.type === "submitted") {
                    badgeColor = "#F59E0B";
                    badgeIcon = "time-outline";
                    message = `🟡 Your property has been submitted successfully and is waiting for administrator approval.`;
                  } else if (n.type === "approved") {
                    badgeColor = "#16A34A";
                    badgeIcon = "checkmark-circle-outline";
                    message = `🟢 Your property has been approved and is now publicly available.`;
                  } else if (n.type === "rejected") {
                    badgeColor = "#EF4444";
                    badgeIcon = "close-circle-outline";
                    message = `🔴 Your property submission has been rejected.\n\nReason:\n"${n.reason || "Property location does not match the submitted address."}"`;
                  } else if (n.type === "archived") {
                    badgeColor = "#64748B";
                    badgeIcon = "archive-outline";
                    message = `⚪ Your property has been archived.`;
                  } else if (n.type === "sold") {
                    badgeColor = "#3550DC";
                    badgeIcon = "cash-outline";
                    message = `🔵 Your property has been marked as sold.`;
                  }

                  return (
                    <View 
                      key={n.id} 
                      style={[
                        styles.notificationCard, 
                        { 
                          borderColor: theme.border, 
                          backgroundColor: n.read ? theme.surface : theme.primary + "10" 
                        }
                      ]}
                    >
                      <View style={{ flexDirection: "row", gap: 12 }}>
                        <View style={[styles.notificationIconWrap, { backgroundColor: badgeColor + "15" }]}>
                          <Ionicons name={badgeIcon as any} size={18} color={badgeColor} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.notificationText, { color: theme.text, fontWeight: "700" }]}>
                            {n.propertyName}
                          </Text>
                          <Text style={{ color: theme.textSecondary, fontSize: 13, marginTop: 4, lineHeight: 18 }}>
                            {message}
                          </Text>
                          <Text style={{ color: theme.textSecondary + "80", fontSize: 10, marginTop: 8 }}>
                            {new Date(n.timestamp).toLocaleString("id-ID")}
                          </Text>
                        </View>
                      </View>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

/* ---------- Child Components ---------- */

interface StatCardProps {
  icon: string;
  label: string;
  value: number;
  theme: any;
}

function StatCard({ icon, label, value, theme }: StatCardProps) {
  return (
    <View
      style={[
        styles.statCard,
        {
          backgroundColor: theme.card,
          borderColor: theme.border,
          borderWidth: theme.borderWidth,
          borderRadius: theme.borderRadius,
          shadowColor: theme.shadow || "#000",
          shadowOffset: theme.shadowOffset,
          shadowOpacity: theme.shadowOpacity,
          shadowRadius: theme.shadowRadius,
          elevation: 1,
        },
      ]}
    >
      <View style={[styles.statIconContainer, { backgroundColor: theme.primary + "10" }]}>
        <Ionicons name={icon as any} size={20} color={theme.primary} />
      </View>
      <View style={styles.statContent}>
        <Text style={[styles.statValue, { color: theme.text }]}>{value}</Text>
        <Text style={[styles.statLabel, { color: theme.textSecondary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

interface MetaItemProps {
  icon: string;
  value: string;
  theme: any;
}

function MetaItem({ icon, value, theme }: MetaItemProps) {
  return (
    <View style={styles.metaItem}>
      <Ionicons name={icon as any} size={14} color={theme.textSecondary} />
      <Text style={[styles.metaText, { color: theme.textSecondary }]}>{value}</Text>
    </View>
  );
}

/* ---------- Styles ---------- */

const styles = StyleSheet.create({
  container: { flex: 1 },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },

  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerLeft: { flex: 1, marginRight: 12 },
  greeting: { fontSize: 13, fontWeight: "500" },
  ownerName: { fontSize: 22, fontWeight: "900", marginTop: 4 },
  
  headerRight: { justifyContent: "center", alignItems: "center" },
  avatar: { width: 48, height: 48, borderRadius: 24, borderWidth: 1.5 },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1.5,
  },
  avatarFallbackText: { fontSize: 16, fontWeight: "800" },

  insightCard: {
    marginHorizontal: 20,
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 20,
  },
  insightHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  insightTitle: { fontSize: 13, fontWeight: "800", textTransform: "uppercase", letterSpacing: 0.5 },
  insightText: { fontSize: 13, lineHeight: 18, fontWeight: "500" },
  tipsIndicator: { flexDirection: "row", gap: 4 },
  indicatorDot: { height: 6, borderRadius: 3 },

  statsGrid: {
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 24,
  },
  statsRow: {
    flexDirection: "row",
    gap: 8,
  },
  statCard: {
    flex: 1,
    padding: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  statIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  statContent: { flex: 1 },
  statValue: { fontWeight: "900", fontSize: 18 },
  statLabel: { fontSize: 11, fontWeight: "500", marginTop: 2 },

  leadsSection: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  leadsCard: {
    borderRadius: 16,
    borderWidth: 0.5,
    padding: 12,
    marginTop: 10,
    overflow: "hidden",
  },
  leadItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },
  leadAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: "center",
    alignItems: "center",
  },
  leadAvatarText: { fontWeight: "800", fontSize: 14 },
  leadInfo: { flex: 1, marginLeft: 12, marginRight: 8 },
  leadName: { fontSize: 14, fontWeight: "700" },
  leadProp: { fontSize: 12, marginTop: 2 },
  leadTime: { fontSize: 10, marginTop: 4 },
  leadChatBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  leadChatText: { color: "#FFF", fontSize: 12, fontWeight: "700" },
  leadDivider: { height: 0.5, marginVertical: 4 },

  filterSection: {
    paddingHorizontal: 20,
    marginBottom: 16,
  },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    borderRadius: 12,
    borderWidth: 0.5,
    height: 44,
  },
  searchIcon: { marginRight: 8 },
  searchInput: { flex: 1, fontSize: 14, height: "100%", padding: 0 },
  pillsRow: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  pillButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 0.5,
  },
  pillText: { fontSize: 11, letterSpacing: 0.5 },

  sectionHeader: {
    marginTop: 8,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  smallAddBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  smallAddText: { fontSize: 12, fontWeight: "700" },

  propertyCard: {
    marginHorizontal: 20,
    marginBottom: 16,
    overflow: "hidden",
  },
  imageContainer: { width: "100%", height: 160, position: "relative" },
  propertyImage: { width: "100%", height: "100%" },
  soldOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.45)",
    justifyContent: "center",
    alignItems: "center",
  },
  soldOverlayText: {
    color: "#FFF",
    fontWeight: "900",
    fontSize: 20,
    letterSpacing: 2,
    borderWidth: 2,
    borderColor: "#FFF",
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderRadius: 8,
  },
  propertyContent: { padding: 14 },
  propHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  propertyName: { fontWeight: "900", fontSize: 16 },
  propertyLoc: { fontSize: 12, marginTop: 4 },
  propertyPrice: { fontWeight: "900", fontSize: 16, marginTop: 8 },
  unit: { fontSize: 12, fontWeight: "600" },

  metaRow: { flexDirection: "row", marginTop: 12, alignItems: "center" },
  metaItem: { flexDirection: "row", alignItems: "center", marginRight: 16 },
  metaText: { fontSize: 12, marginLeft: 4, fontWeight: "500" },
  availabilityText: { fontSize: 12, fontWeight: "800" },

  cardDivider: { height: 0.5, marginVertical: 12 },

  cardActions: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
  },
  actionBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingVertical: 8,
    borderRadius: 10,
  },
  actionBtnText: { fontSize: 12, fontWeight: "600" },

  statusBadge: {
    position: "absolute",
    top: 12,
    right: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },

  fab: {
    position: "absolute",
    bottom: 24,
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 22,
    paddingVertical: 13,
  },
  fabText: { color: "#FFF", fontWeight: "900", marginLeft: 6, fontSize: 14 },

  emptyState: {
    alignItems: "center",
    marginTop: 40,
    paddingHorizontal: 40,
    paddingVertical: 32,
  },
  emptyTitle: { fontSize: 16, fontWeight: "800", marginTop: 12 },
  emptyDesc: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
    marginVertical: 10,
  },
  primaryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  primaryText: { color: "#FFF", fontWeight: "800", fontSize: 13 },

  // Bell & Notification Modal Styles
  bellButton: {
    padding: 8,
    borderRadius: 20,
    marginRight: 12,
    position: "relative",
    borderWidth: 0.5,
  },
  bellBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 3,
  },
  bellBadgeText: {
    color: "#FFF",
    fontSize: 9,
    fontWeight: "800",
  },
  approvalStatusBadge: {
    position: "absolute",
    top: 12,
    left: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "flex-end",
  },
  notificationSheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderTopWidth: 1,
    paddingBottom: 40,
    maxHeight: "75%",
  },
  notificationHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 0.5,
    borderBottomColor: "rgba(0, 0, 0, 0.05)",
  },
  notificationTitle: {
    fontSize: 18,
    fontWeight: "800",
  },
  emptyNotificationState: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 60,
  },
  notificationCard: {
    borderWidth: 0.5,
    borderRadius: 12,
    padding: 14,
    marginVertical: 6,
  },
  notificationIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  notificationText: {
    fontSize: 14,
  },
});
