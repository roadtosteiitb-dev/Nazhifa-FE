import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useTranslation } from 'react-i18next';
import { useRouter } from 'expo-router';
import {
  fetchComplaints,
  submitComplaint,
  ApiComplaint,
  ComplaintStatus,
} from '../services/ComplaintService';

const PRIMARY = '#2E7D32';
const PRIMARY_LIGHT = '#DBEAFE';
const SUCCESS = '#16A34A';
const DANGER = '#EF4444';
const GRAY_BG = '#F1F5F9';
const TEXT_DARK = '#0F172A';
const TEXT_SECONDARY = '#64748B';

const CATEGORIES = ['Fraud', 'Misinformation', 'Legal Issue', 'Spam', 'Other'];

const getStatusInfo = (status: ComplaintStatus) => {
  switch (status) {
    case 'resolved':
      return { bg: '#DCFCE7', text: SUCCESS, label: 'Resolved', icon: 'checkmark-circle' as const };
    case 'in_progress':
      return { bg: '#DBEAFE', text: PRIMARY, label: 'In Progress', icon: 'time' as const };
    default:
      return { bg: '#FEF3C7', text: '#D97706', label: 'Open', icon: 'time' as const };
  }
};

export default function BuyerComplaints() {
  const router = useRouter();
  const { t } = useTranslation();
  const [complaints, setComplaints] = useState<ApiComplaint[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalVisible, setModalVisible] = useState(false);
  const [formData, setFormData] = useState({
    category: CATEGORIES[0],
    message: '',
    image: '',
  });
  const [submitting, setSubmitting] = useState(false);

  const loadComplaints = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchComplaints();
      setComplaints(data);
    } catch {
      Alert.alert(t('complaint.error'), t('complaint.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadComplaints();
  }, [loadComplaints]);

  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert(t('complaint.permissionTitle'), t('complaint.permissionDesc'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.7,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setFormData({ ...formData, image: `data:image/jpeg;base64,${result.assets[0].base64}` });
    }
  };

  const handleSubmit = async () => {
    if (!formData.message.trim()) {
      Alert.alert(t('complaint.error'), t('complaint.fillDesc'));
      return;
    }

    setSubmitting(true);
    try {
      const created = await submitComplaint({
        category: formData.category,
        message: formData.message,
        image: formData.image || undefined,
      });
      setComplaints((prev) => [created, ...prev]);
      Alert.alert('✅', t('complaint.sent'));
      setModalVisible(false);
      resetForm();
    } catch {
      Alert.alert(t('complaint.error'), t('complaint.saveError'));
    } finally {
      setSubmitting(false);
    }
  };

  const openCreateModal = () => {
    resetForm();
    setModalVisible(true);
  };

  const resetForm = () => {
    setFormData({ category: CATEGORIES[0], message: '', image: '' });
  };

  const renderComplaint = ({ item }: { item: ApiComplaint }) => {
    const statusInfo = getStatusInfo(item.status);
    return (
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={[styles.statusBadge, { backgroundColor: statusInfo.bg }]}>
            <Ionicons name={statusInfo.icon} size={11} color={statusInfo.text} />
            <Text style={[styles.statusText, { color: statusInfo.text }]}>{statusInfo.label}</Text>
          </View>
          <Text style={styles.cardDate}>{item.date || '-'}</Text>
        </View>

        {item.image && <Image source={{ uri: item.image }} style={styles.cardImage} />}

        <Text style={styles.cardCategory}>{item.category}</Text>
        <Text style={styles.cardDesc} numberOfLines={3}>
          {item.message}
        </Text>
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PRIMARY} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={TEXT_DARK} />
        </TouchableOpacity>
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.headerTitle}>My Complaints</Text>
          <Text style={styles.headerSubtitle}>
            {complaints.length} {complaints.length === 1 ? 'complaint' : 'complaints'} submitted
          </Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openCreateModal} activeOpacity={0.85}>
          <Ionicons name="add" size={22} color="#fff" />
        </TouchableOpacity>
      </View>

      {complaints.length === 0 ? (
        <View style={styles.empty}>
          <View style={styles.emptyIconWrap}>
            <Ionicons name="chatbox-ellipses-outline" size={48} color={PRIMARY} />
          </View>
          <Text style={styles.emptyTitle}>{t('complaint.empty')}</Text>
          <Text style={styles.emptySub}>{t('complaint.emptySub')}</Text>
          <TouchableOpacity style={styles.emptyBtn} onPress={openCreateModal} activeOpacity={0.85}>
            <Ionicons name="add-circle-outline" size={18} color={PRIMARY} />
            <Text style={styles.emptyBtnText}>Submit a Complaint</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={complaints}
          renderItem={renderComplaint}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={loading} onRefresh={loadComplaints} />}
        />
      )}

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalWrap}
          >
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={styles.modalIconWrap}>
                  <Ionicons name="document-text" size={20} color={PRIMARY} />
                </View>
                <Text style={styles.modalTitle}>{t('complaint.createTitle')}</Text>
                <TouchableOpacity onPress={() => setModalVisible(false)} style={styles.modalCloseBtn}>
                  <Ionicons name="close-circle" size={26} color={TEXT_SECONDARY} />
                </TouchableOpacity>
              </View>

              <ScrollView showsVerticalScrollIndicator={false}>
                <Text style={styles.fieldLabel}>Category</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
                  {CATEGORIES.map((cat) => (
                    <TouchableOpacity
                      key={cat}
                      style={[styles.categoryChip, formData.category === cat && styles.categoryChipActive]}
                      onPress={() => setFormData({ ...formData, category: cat })}
                    >
                      <Text style={[styles.categoryChipText, formData.category === cat && styles.categoryChipTextActive]}>
                        {cat}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={styles.fieldLabel}>Evidence Photo (Optional)</Text>
                <TouchableOpacity style={styles.imagePicker} onPress={pickImage} activeOpacity={0.7}>
                  {formData.image ? (
                    <View style={styles.imagePreviewWrap}>
                      <Image source={{ uri: formData.image }} style={styles.imagePreview} />
                      <View style={styles.imageRemoveBtn}>
                        <Ionicons name="close-circle" size={20} color="#fff" />
                      </View>
                    </View>
                  ) : (
                    <View style={styles.imagePlaceholder}>
                      <Ionicons name="cloud-upload-outline" size={36} color={PRIMARY} />
                      <Text style={styles.imagePlaceholderText}>Tap to upload photo</Text>
                      <Text style={styles.imagePlaceholderSub}>JPG, PNG up to 5MB</Text>
                    </View>
                  )}
                </TouchableOpacity>

                <Text style={styles.fieldLabel}>Complaint Description</Text>
                <TextInput
                  style={styles.textArea}
                  placeholder="Describe your complaint in detail..."
                  placeholderTextColor="#94A3B8"
                  multiline
                  numberOfLines={5}
                  value={formData.message}
                  onChangeText={(text) => setFormData({ ...formData, message: text })}
                  textAlignVertical="top"
                />

                <TouchableOpacity
                  style={styles.submitButton}
                  onPress={handleSubmit}
                  disabled={submitting}
                  activeOpacity={0.85}
                >
                  {submitting ? (
                    <ActivityIndicator color="#fff" />
                  ) : (
                    <>
                      <Ionicons name="send" size={16} color="#fff" />
                      <Text style={styles.submitText}>{t('complaint.submit')}</Text>
                    </>
                  )}
                </TouchableOpacity>
              </ScrollView>
            </View>
          </KeyboardAvoidingView>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFFFFF' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' },

  header: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingTop: 52, paddingBottom: 14,
  },
  backBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: GRAY_BG, justifyContent: 'center', alignItems: 'center',
  },
  headerTitle: { fontSize: 18, fontWeight: '700', color: TEXT_DARK },
  headerSubtitle: { fontSize: 12, color: TEXT_SECONDARY, marginTop: 2 },
  addBtn: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: PRIMARY, justifyContent: 'center', alignItems: 'center',
  },

  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 40 },
  emptyIconWrap: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: PRIMARY_LIGHT, justifyContent: 'center', alignItems: 'center',
  },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: TEXT_DARK, marginTop: 16 },
  emptySub: { fontSize: 13, color: TEXT_SECONDARY, marginTop: 6, textAlign: 'center', lineHeight: 18 },
  emptyBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    marginTop: 20, paddingHorizontal: 20, paddingVertical: 12,
    borderRadius: 14, backgroundColor: PRIMARY_LIGHT,
  },
  emptyBtnText: { fontSize: 14, fontWeight: '700', color: PRIMARY },

  card: {
    backgroundColor: '#FFFFFF', borderRadius: 16,
    borderWidth: 1, borderColor: '#E2E8F0',
    padding: 16, marginBottom: 14,
    shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04, shadowRadius: 6, elevation: 2,
  },
  cardHeader: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    marginBottom: 10,
  },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8,
  },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardDate: { fontSize: 12, color: TEXT_SECONDARY },
  cardImage: {
    width: '100%', height: 160, borderRadius: 12, marginBottom: 10,
  },
  cardCategory: { fontSize: 13, fontWeight: '700', color: PRIMARY, marginBottom: 4 },
  cardDesc: { fontSize: 14, color: TEXT_DARK, lineHeight: 20 },

  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.45)',
    justifyContent: 'flex-end',
  },
  modalWrap: { width: '100%' },
  modalCard: {
    backgroundColor: '#FFFFFF', borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: 24, paddingBottom: 40,
  },
  modalHeader: {
    flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20,
  },
  modalIconWrap: {
    width: 40, height: 40, borderRadius: 12, backgroundColor: PRIMARY_LIGHT,
    justifyContent: 'center', alignItems: 'center',
  },
  modalTitle: { flex: 1, fontSize: 17, fontWeight: '700', color: TEXT_DARK },
  modalCloseBtn: { padding: 2 },

  fieldLabel: { fontSize: 13, fontWeight: '600', color: TEXT_DARK, marginBottom: 8, marginTop: 16 },

  categoryChip: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 16,
    backgroundColor: GRAY_BG,
  },
  categoryChipActive: { backgroundColor: PRIMARY },
  categoryChipText: { fontSize: 12, fontWeight: '600', color: TEXT_SECONDARY },
  categoryChipTextActive: { color: '#fff' },

  imagePicker: { marginBottom: 4 },
  imagePlaceholder: {
    width: '100%', height: 140, borderRadius: 14,
    backgroundColor: GRAY_BG, borderWidth: 2, borderColor: '#E2E8F0',
    borderStyle: 'dashed', justifyContent: 'center', alignItems: 'center',
  },
  imagePlaceholderText: { fontSize: 14, fontWeight: '600', color: PRIMARY, marginTop: 8 },
  imagePlaceholderSub: { fontSize: 11, color: TEXT_SECONDARY, marginTop: 4 },
  imagePreviewWrap: { position: 'relative', borderRadius: 14, overflow: 'hidden' },
  imagePreview: { width: '100%', height: 180, borderRadius: 14 },
  imageRemoveBtn: {
    position: 'absolute', top: 8, right: 8,
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center',
  },

  textArea: {
    backgroundColor: GRAY_BG, borderRadius: 14, padding: 14,
    fontSize: 14, color: TEXT_DARK, minHeight: 120, lineHeight: 20,
  },

  submitButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: PRIMARY, paddingVertical: 16, borderRadius: 16, marginTop: 24,
  },
  submitText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
