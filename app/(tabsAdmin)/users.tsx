import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  TextInput,
  Alert,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { fetchUsers, updateUserStatus, ApiUser } from "../../services/UserService";

const PRIMARY = "#2E7D32";
const DANGER = "#EF4444";
const TEXT_DARK = "#0F172A";
const TEXT_SECONDARY = "#64748B";

const roleColors: Record<string, string> = {
  owner: "#8B5CF6",
  buyer: "#0891B2",
  admin: PRIMARY,
  guest: "#64748B",
};

const roleIcons: Record<string, string> = {
  owner: "business-outline",
  buyer: "cart-outline",
  admin: "shield-checkmark-outline",
  guest: "person-outline",
};

type FilterType = "all" | "active" | "inactive" | "owner" | "buyer";

export default function UsersScreen() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterType>("all");
  const [selectedUser, setSelectedUser] = useState<ApiUser | null>(null);

  const loadUsers = useCallback(async () => {
    try {
      setIsLoading(true);
      const data = await fetchUsers();
      setUsers(data);
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const filtered = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    let matchFilter = true;
    if (filter === "active") matchFilter = u.status === "active";
    else if (filter === "inactive") matchFilter = u.status === "inactive";
    else if (filter === "owner") matchFilter = u.role === "owner";
    else if (filter === "buyer") matchFilter = u.role === "buyer";
    return matchSearch && matchFilter;
  });

  const toggleStatus = (id: string) => {
    const target = users.find((u) => u.id === id);
    if (!target) return;
    const newStatus = target.status === "active" ? "inactive" : "active";

    Alert.alert("Confirm", "Toggle this user's account status?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          try {
            const updated = await updateUserStatus(id, newStatus);
            setUsers((prev) => prev.map((u) => (u.id === id ? updated : u)));
            setSelectedUser(null);
          } catch {
            Alert.alert("Gagal", "Tidak dapat mengubah status user.");
          }
        },
      },
    ]);
  };

  const filters: { label: string; value: FilterType }[] = [
    { label: "All", value: "all" },
    { label: "Active", value: "active" },
    { label: "Inactive", value: "inactive" },
    { label: "Owners", value: "owner" },
    { label: "Buyers", value: "buyer" },
  ];

  // ── Profile View ──
  if (selectedUser) {
    const u = selectedUser;
    return (
      <SafeAreaView style={styles.container} edges={["top"]}>
        <View style={styles.detailHeader}>
          <TouchableOpacity onPress={() => setSelectedUser(null)} style={styles.backBtn}>
            <Ionicons name="arrow-back" size={22} color={TEXT_DARK} />
          </TouchableOpacity>
          <Text style={styles.detailHeaderTitle}>User Profile</Text>
          <View style={{ width: 42 }} />
        </View>

        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          <View style={styles.profileAvatarWrap}>
            <View style={[styles.profileAvatar, { backgroundColor: roleColors[u.role] }]}>
              <Ionicons name="person" size={40} color="#fff" />
            </View>
            <Text style={styles.profileName}>{u.name}</Text>
            <View style={[styles.roleTag, { backgroundColor: roleColors[u.role] + "18" }]}>
              <Ionicons name={roleIcons[u.role] as any} size={12} color={roleColors[u.role]} />
              <Text style={[styles.roleTagText, { color: roleColors[u.role] }]}>
                {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
              </Text>
            </View>
          </View>

          <View style={styles.profileInfoGrid}>
            <View style={styles.profileInfoCard}>
              <Ionicons name="mail-outline" size={18} color={PRIMARY} />
              <Text style={styles.profileInfoLabel}>Email</Text>
              <Text style={styles.profileInfoValue}>{u.email}</Text>
            </View>
            <View style={styles.profileInfoCard}>
              <Ionicons name="call-outline" size={18} color={PRIMARY} />
              <Text style={styles.profileInfoLabel}>Phone</Text>
              <Text style={styles.profileInfoValue}>{u.phone || "-"}</Text>
            </View>
            <View style={styles.profileInfoCard}>
              <Ionicons name="calendar-outline" size={18} color={PRIMARY} />
              <Text style={styles.profileInfoLabel}>Joined</Text>
              <Text style={styles.profileInfoValue}>{u.joinDate || "-"}</Text>
            </View>
            <View style={styles.profileInfoCard}>
              <Ionicons
                name={u.status === "active" ? "checkmark-circle" : "close-circle"}
                size={18}
                color={u.status === "active" ? "#16A34A" : DANGER}
              />
              <Text style={styles.profileInfoLabel}>Status</Text>
              <Text style={[styles.profileInfoValue, { color: u.status === "active" ? "#16A34A" : DANGER }]}>
                {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
              </Text>
            </View>
          </View>

          <TouchableOpacity
            style={[styles.toggleBtn, { backgroundColor: u.status === "active" ? DANGER : "#16A34A" }]}
            onPress={() => toggleStatus(u.id)}
          >
            <Ionicons
              name={u.status === "active" ? "lock-closed-outline" : "lock-open-outline"}
              size={18}
              color="#fff"
            />
            <Text style={styles.toggleBtnText}>
              {u.status === "active" ? "Disable Account" : "Enable Account"}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ── List View ──
  return (
    <SafeAreaView style={styles.container} edges={["top"]}>
      <View style={styles.pageHeader}>
        <Text style={styles.pageTitle}>User Management</Text>
        <Text style={styles.pageSubtitle}>{users.length} registered users</Text>
      </View>

      <View style={styles.searchBar}>
        <Ionicons name="search-outline" size={20} color={TEXT_SECONDARY} style={{ marginLeft: 14 }} />
        <TextInput
          placeholder="Search users by name or email..."
          value={search}
          onChangeText={setSearch}
          style={styles.searchInput}
          placeholderTextColor={TEXT_SECONDARY}
        />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow} style={styles.filterScroll}>
        {filters.map((f) => (
          <TouchableOpacity
            key={f.value}
            style={[styles.chip, filter === f.value && styles.chipActive]}
            onPress={() => setFilter(f.value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, filter === f.value && styles.chipTextActive]}>{f.label}</Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={<RefreshControl refreshing={isLoading} onRefresh={loadUsers} />}
      >
        {!isLoading && filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="people-outline" size={48} color="#CBD5E1" />
            <Text style={styles.emptyText}>Tidak ada user ditemukan.</Text>
          </View>
        ) : (
          filtered.map((u) => (
            <View key={u.id} style={styles.userCard}>
              <View style={[styles.userAvatar, { backgroundColor: roleColors[u.role] + "25" }]}>
                <Ionicons name="person" size={22} color={roleColors[u.role]} />
              </View>
              <View style={styles.userCardBody}>
                <Text style={styles.userCardName}>{u.name}</Text>
                <Text style={styles.userCardEmail}>{u.email}</Text>
                <View style={styles.userCardTags}>
                  <View style={[styles.roleTag, { backgroundColor: roleColors[u.role] + "18" }]}>
                    <Ionicons name={roleIcons[u.role] as any} size={11} color={roleColors[u.role]} />
                    <Text style={[styles.roleTagText, { color: roleColors[u.role] }]}>
                      {u.role.charAt(0).toUpperCase() + u.role.slice(1)}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.statusDot,
                      { backgroundColor: u.status === "active" ? "#DCFCE7" : "#FEE2E2" },
                    ]}
                  >
                    <View
                      style={[
                        styles.statusDotInner,
                        { backgroundColor: u.status === "active" ? "#16A34A" : DANGER },
                      ]}
                    />
                    <Text
                      style={[
                        styles.statusText,
                        { color: u.status === "active" ? "#16A34A" : DANGER },
                      ]}
                    >
                      {u.status.charAt(0).toUpperCase() + u.status.slice(1)}
                    </Text>
                  </View>
                </View>
              </View>
              <TouchableOpacity
                style={styles.userCardAction}
                onPress={() => setSelectedUser(u)}
              >
                <Ionicons name="chevron-forward" size={20} color={TEXT_SECONDARY} />
              </TouchableOpacity>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#FFFFFF" },
  pageHeader: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 },
  pageTitle: { fontSize: 22, fontWeight: "700", color: TEXT_DARK },
  pageSubtitle: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 4 },

  searchBar: {
    flexDirection: "row", alignItems: "center", backgroundColor: "#F1F5F9",
    marginHorizontal: 20, borderRadius: 14, height: 46, marginTop: 12,
  },
  searchInput: { flex: 1, fontSize: 14, color: TEXT_DARK, paddingHorizontal: 10 },
  filterScroll: { maxHeight: 44 },
  filterRow: { paddingHorizontal: 20, paddingVertical: 8, gap: 8, alignItems: "center" },
  chip: {
    height: 32, paddingHorizontal: 14, borderRadius: 16,
    backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center",
  },
  chipActive: { backgroundColor: "#2E7D32" },
  chipText: { fontSize: 12, fontWeight: "600", color: "#64748B" },
  chipTextActive: { color: "#fff" },

  userCard: {
    flexDirection: "row", alignItems: "center",
    marginHorizontal: 20, marginTop: 12, backgroundColor: "#fff",
    borderRadius: 16, padding: 14, borderWidth: 1, borderColor: "#E2E8F0",
  },
  userAvatar: {
    width: 46, height: 46, borderRadius: 23,
    justifyContent: "center", alignItems: "center",
  },
  userCardBody: { flex: 1, marginLeft: 12 },
  userCardName: { fontSize: 15, fontWeight: "700", color: TEXT_DARK },
  userCardEmail: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },
  userCardTags: { flexDirection: "row", gap: 6, marginTop: 6 },
  userCardAction: { padding: 4 },

  roleTag: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  roleTagText: { fontSize: 11, fontWeight: "600" },

  statusDot: {
    flexDirection: "row", alignItems: "center", gap: 4,
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6,
  },
  statusDotInner: { width: 6, height: 6, borderRadius: 3 },
  statusText: { fontSize: 11, fontWeight: "600" },

  emptyState: { alignItems: "center", marginTop: 48 },
  emptyText: { fontSize: 14, color: "#64748B", marginTop: 12 },

  detailHeader: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    paddingHorizontal: 16, paddingVertical: 12,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: "#F1F5F9", justifyContent: "center", alignItems: "center",
  },
  detailHeaderTitle: { fontSize: 17, fontWeight: "700", color: TEXT_DARK },

  profileAvatarWrap: { alignItems: "center", marginTop: 8 },
  profileAvatar: {
    width: 80, height: 80, borderRadius: 40,
    justifyContent: "center", alignItems: "center",
  },
  profileName: { fontSize: 20, fontWeight: "700", color: TEXT_DARK, marginTop: 12 },

  profileInfoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 24 },
  profileInfoCard: {
    flex: 1, minWidth: 140, backgroundColor: "#F8FAFC",
    borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#E2E8F0",
  },
  profileInfoLabel: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 6 },
  profileInfoValue: { fontSize: 14, fontWeight: "600", color: TEXT_DARK, marginTop: 2 },

  toggleBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    paddingVertical: 14, borderRadius: 14, gap: 8, marginTop: 28,
  },
  toggleBtnText: { color: "#fff", fontWeight: "700", fontSize: 15 },
});
