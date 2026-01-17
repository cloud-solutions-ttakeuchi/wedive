import React, { useState, useEffect } from 'react';
import { StyleSheet, TouchableOpacity, ActivityIndicator, Alert, ScrollView, AppState, Text as RNText, View as RNView } from 'react-native';
import { Text, View } from '@/components/Themed';
import { useRouter } from 'expo-router';
import { sendEmailVerification, reload } from 'firebase/auth';
import { useAuth } from '../../src/context/AuthContext';
import { Mail, RefreshCw, LogOut, CheckCircle } from 'lucide-react-native';

export default function VerifyEmailScreen() {
  const router = useRouter();
  const { user, firebaseUser, signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(new Date());

  // アプリがフォアグラウンドに戻った時に自動でチェック
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextAppState) => {
      if (nextAppState === 'active' && firebaseUser) {
        await checkVerification();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [firebaseUser]);

  const checkVerification = async () => {
    if (!firebaseUser) return;
    setIsLoading(true);
    try {
      await firebaseUser.reload(); // Firebaseのユーザー情報を更新
      if (firebaseUser.emailVerified) {
        Alert.alert('確認完了', 'メールアドレスの確認が完了しました。');
        router.replace('/(tabs)/mypage');
      }
    } catch (e) {
      console.error('Failed to reload user:', e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (!firebaseUser) return;

    // 連打防止（1分間隔）
    if (lastSent && new Date().getTime() - lastSent.getTime() < 60000) {
      Alert.alert('送信制限', '再送信まではしばらくお待ちください。');
      return;
    }

    setIsLoading(true);
    try {
      await sendEmailVerification(firebaseUser);
      setLastSent(new Date());
      Alert.alert('送信完了', `確認メールを再送信しました。\n${firebaseUser.email}`);
    } catch (error: any) {
      console.error('Email resend error:', error);
      Alert.alert('エラー', 'メールの送信に失敗しました。しばらく待ってからお試しください。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut();
      router.replace('/(auth)/login');
    } catch (e) {
      console.error('Logout error:', e);
    }
  };

  if (!firebaseUser) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.iconContainer}>
          <Mail size={64} color="#0ea5e9" />
          <View style={styles.badge}>
            <CheckCircle size={24} color="#fff" fill="#EF4444" />
            {/* 未認証なので赤、あるいは「待機中」のアイコン */}
          </View>
        </View>

        <Text style={styles.title}>メールアドレスの確認</Text>
        <Text style={styles.emailText}>{firebaseUser.email}</Text>
        <Text style={styles.description}>
          確認用のメールを送信しました。メール内のリンクをクリックして、アカウント登録を完了してください。
        </Text>

        <View style={styles.buttonContainer}>
          <TouchableOpacity
            style={styles.checkBtn}
            onPress={checkVerification}
            disabled={isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <RNView style={styles.btnContent}>
                <RNText style={styles.btnText}>確認完了（再読み込み）</RNText>
                <RefreshCw size={20} color="#fff" />
              </RNView>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resendBtn}
            onPress={handleResend}
            disabled={isLoading}
          >
            <RNText style={styles.resendText}>メールを再送信</RNText>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={styles.logoutLink} onPress={handleLogout}>
          <LogOut size={16} color="#64748b" />
          <Text style={styles.logoutText}>ログアウト / 修正</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  content: {
    flexGrow: 1,
    padding: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconContainer: {
    marginBottom: 32,
    position: 'relative',
  },
  badge: {
    position: 'absolute',
    bottom: -5,
    right: -5,
    backgroundColor: '#fff',
    borderRadius: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  emailText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#0ea5e9',
    marginBottom: 24,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 48,
  },
  buttonContainer: {
    width: '100%',
    gap: 16,
    marginBottom: 32,
  },
  checkBtn: {
    backgroundColor: '#0ea5e9',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  btnContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  btnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  resendBtn: {
    backgroundColor: '#f1f5f9',
    height: 56,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  resendText: {
    color: '#475569',
    fontSize: 16,
    fontWeight: '600',
  },
  logoutLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 16,
  },
  logoutText: {
    color: '#64748b',
    fontSize: 14,
  },
});
