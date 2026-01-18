import React from 'react';
import { StyleSheet, TouchableOpacity, ScrollView, Alert, Image } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useRouter } from 'expo-router';
import { ArrowLeft, AlertTriangle, FileText, Heart, Ticket, Trash2 } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';

export default function DeleteAccountScreen() {
  const router = useRouter();
  const { signOut, firebaseUser } = useAuth();

  const handleProceed = () => {
    const providerId = firebaseUser?.providerData?.[0]?.providerId;
    let message = 'セキュリティ保護のため、退会処理の前にご本人確認（再ログイン）が必要です。\n\n「OK」を押すとログアウトします。';

    if (providerId === 'google.com') {
      message += '\n\n再ログイン時はログイン画面の「Googleでログイン」ボタンをご利用ください。';
    } else if (providerId === 'apple.com') {
      message += '\n\n再ログイン時はログイン画面下の「Appleでログイン」ボタン（黒いボタン）をご利用ください。';
    } else {
      message += '再ログイン後、自動的に最終確認画面が表示されます。';
    }

    Alert.alert(
      '再ログインが必要です',
      message,
      [
        { text: 'キャンセル', style: 'cancel' },
        {
          text: 'OK',
          style: 'destructive',
          onPress: async () => {
            try {
              // 退会処理待ちフラグを立てる
              await AsyncStorage.multiSet([
                ['pending_account_deletion', 'true'],
                ['delete_target_uid', firebaseUser?.uid || ''],
                ['temp_reauth_email', firebaseUser?.email || '']
              ]);

              await signOut();
              // signOutで自動遷移するはずだが、念のため
              router.replace('/(auth)/login');
            } catch (error) {
              console.error('Logout for delete account failed:', error);
              Alert.alert('エラー', '操作に失敗しました。');
            }
          }
        }
      ]
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={24} color="#1e293b" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>アカウントの削除</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.warningCard}>
          <View style={styles.iconCircle}>
            <AlertTriangle size={32} color="#ef4444" />
          </View>
          <Text style={styles.warningTitle}>本当に削除しますか？</Text>
          <Text style={styles.warningText}>
            アカウントを削除すると、あなたの全てのデータが完全に失われます。この操作は取り消せません。
          </Text>
        </View>

        <Text style={styles.sectionTitle}>削除されるデータ</Text>
        <View style={styles.listContainer}>
          <View style={styles.listItem}>
            <FileText size={20} color="#64748b" />
            <Text style={styles.listText}>全てのダイビングログ</Text>
          </View>
          <View style={styles.listItem}>
            <Heart size={20} color="#64748b" />
            <Text style={styles.listText}>お気に入りの生物・スポット</Text>
          </View>
          <View style={styles.listItem}>
            <Ticket size={20} color="#64748b" />
            <Text style={styles.listText}>AIコンシェルジュチケット</Text>
          </View>
          <View style={styles.listItem}>
            <Trash2 size={20} color="#64748b" />
            <Text style={styles.listText}>プロフィール情報・ランク</Text>
          </View>
        </View>

        <View style={styles.noteBox}>
          <Text style={styles.noteTitle}>ご注意</Text>
          <Text style={styles.noteText}>
            ・アプリを削除（アンインストール）しただけでは、退会にはなりません。{"\n"}
            ・同じメールアドレスで再登録しても、過去のデータは復元できません。
          </Text>
        </View>

      </ScrollView>

      <View style={styles.footer}>
        <TouchableOpacity style={styles.cancelBtn} onPress={() => router.back()}>
          <Text style={styles.cancelBtnText}>キャンセル</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.deleteBtn} onPress={handleProceed}>
          <Text style={styles.deleteBtnText}>退会手続きへ進む</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 60,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backBtn: {
    padding: 8,
    marginLeft: -8,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#1e293b',
  },
  content: {
    padding: 24,
  },
  warningCard: {
    alignItems: 'center',
    marginBottom: 32,
    marginTop: 16,
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fee2e2',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  warningTitle: {
    fontSize: 22,
    fontWeight: '900',
    color: '#1e293b',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 16,
  },
  listContainer: {
    backgroundColor: '#f8fafc',
    borderRadius: 16,
    padding: 20,
    gap: 16,
    marginBottom: 32,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  listText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#475569',
  },
  noteBox: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 16,
    padding: 20,
  },
  noteTitle: {
    fontSize: 14,
    fontWeight: '800',
    color: '#1e293b',
    marginBottom: 8,
  },
  noteText: {
    fontSize: 13,
    color: '#64748b',
    lineHeight: 20,
  },
  footer: {
    padding: 24,
    paddingBottom: 40,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#f1f5f9',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#64748b',
  },
  deleteBtn: {
    flex: 1,
    backgroundColor: '#ef4444',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  deleteBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
});
