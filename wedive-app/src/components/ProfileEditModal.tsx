import React, { useState, useEffect } from 'react';
import { Modal, View, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, Alert, SafeAreaView, Platform } from 'react-native';
import { X, Check, Award, Star, Activity, User as UserIcon, RefreshCw } from 'lucide-react-native';
import { useAgencies } from '../hooks/useAgencies';
import { User, AgencyMaster } from '../types';
import { useAuth } from '../context/AuthContext';

type Props = {
  visible: boolean;
  onClose: () => void;
  initialData: User | null;
  onSave: (data: Partial<User>) => Promise<void>;
};

export const ProfileEditModal = ({ visible, onClose, initialData, onSave }: Props) => {
  const { agencies, isLoading: loadingAgencies } = useAgencies();
  const { syncData } = useAuth();
  const [formData, setFormData] = useState<Partial<User>>({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        name: initialData.name,
        profileImage: initialData.profileImage,
        certification: initialData.certification || { orgId: 'padi', rankId: 'entry', date: '' },
      });
    }
  }, [initialData, visible]);

  const handleSave = async () => {
    if (!formData.name) {
      Alert.alert('エラー', '名前を入力してください');
      return;
    }
    setSaving(true);
    try {
      await onSave(formData);
      onClose();
    } catch (e) {
      Alert.alert('エラー', '保存に失敗しました');
    } finally {
      setSaving(false);
    }
  };

  const currentOrg = agencies.find((a: AgencyMaster) => a.id === (formData.certification?.orgId || 'padi').toLowerCase());
  const ranks = currentOrg?.ranks || [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <X size={24} color="#64748b" />
          </TouchableOpacity>
          <Text style={styles.title}>プロフィール編集</Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} style={styles.saveBtn}>
            {saving ? <ActivityIndicator color="#fff" size="small" /> : <Check size={20} color="#fff" />}
            <Text style={styles.saveBtnText}>保存</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.content}>
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>基本情報</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>表示名</Text>
              <View style={styles.inputWrapper}>
                <UserIcon size={20} color="#94a3b8" style={styles.inputIcon} />
                <TextInput
                  style={styles.input}
                  value={formData.name}
                  onChangeText={t => setFormData(d => ({ ...d, name: t }))}
                  placeholder="表示名を入力"
                />
              </View>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>ダイバー情報</Text>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>指導団体</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {loadingAgencies ? (
                  <ActivityIndicator size="small" color="#0ea5e9" />
                ) : (
                  agencies.map((agency: AgencyMaster) => (
                    <TouchableOpacity
                      key={agency.id}
                      style={[
                        styles.chip,
                        formData.certification?.orgId === agency.id && styles.chipActive
                      ]}
                      onPress={() => setFormData(d => ({
                        ...d,
                        certification: {
                          ...d.certification!,
                          orgId: agency.id,
                          rankId: agency.ranks[0]?.id || 'entry' // Reset rank on org change
                        }
                      }))}
                    >
                      <Text style={[
                        styles.chipText,
                        formData.certification?.orgId === agency.id && styles.chipTextActive
                      ]}>{agency.name}</Text>
                    </TouchableOpacity>
                  ))
                )}
              </ScrollView>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>ランク</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
                {ranks.map((rank: any) => (
                  <TouchableOpacity
                    key={rank.id}
                    style={[
                      styles.chip,
                      formData.certification?.rankId === rank.id && styles.chipActive
                    ]}
                    onPress={() => setFormData(d => ({
                      ...d,
                      certification: { ...d.certification!, rankId: rank.id }
                    }))}
                  >
                    <Text style={[
                      styles.chipText,
                      formData.certification?.rankId === rank.id && styles.chipTextActive
                    ]}>{rank.name}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <View style={styles.section}>
            <Text style={styles.sectionTitle}>高度な設定</Text>
            <TouchableOpacity
              style={styles.dangerBtn}
              onPress={async () => {
                if (!initialData?.id) return;
                Alert.alert(
                  'データの再同期',
                  'サーバーからデータを強制的に再取得します。この操作は時間がかかる場合があります。',
                  [
                    { text: 'キャンセル', style: 'cancel' },
                    {
                      text: '実行する',
                      onPress: async () => {
                        setSaving(true);
                        try {
                          await syncData();
                          Alert.alert('完了', 'データの同期が完了しました。');
                        } catch (e: any) {
                          Alert.alert('エラー', `同期に失敗しました: ${e.message}`);
                        } finally {
                          setSaving(false);
                        }
                      }
                    }
                  ]
                );
              }}
            >
              <RefreshCw size={20} color="#64748b" />
              <Text style={styles.dangerBtnText}>データを強制再取得する</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  closeBtn: {
    padding: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#1e293b',
  },
  saveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  saveBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 14,
  },
  content: {
    flex: 1,
    padding: 24,
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#94a3b8',
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f8fafc',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e2e8f0',
    paddingHorizontal: 12,
  },
  inputIcon: {
    marginRight: 8,
  },
  input: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#1e293b',
  },
  chipsScroll: {
    flexDirection: 'row',
    marginHorizontal: -4,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#f1f5f9',
    marginHorizontal: 4,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  chipActive: {
    backgroundColor: '#0ea5e9',
    borderColor: '#0ea5e9',
  },
  chipText: {
    color: '#64748b',
    fontWeight: '600',
    fontSize: 13,
  },
  chipTextActive: {
    color: '#fff',
  },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    padding: 16,
    borderRadius: 12,
    gap: 12,
  },
  dangerBtnText: {
    color: '#64748b',
    fontSize: 14,
    fontWeight: 'bold',
  },
});
