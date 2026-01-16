import React, { useEffect } from 'react';
import FontAwesome from '@expo/vector-icons/FontAwesome';
import { Link, Tabs, useRouter } from 'expo-router';
import { Pressable, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '../../src/context/AuthContext';

import Colors from '@/constants/Colors';
import { useColorScheme } from '@/components/useColorScheme';
import { useClientOnlyValue } from '@/components/useClientOnlyValue';

// You can explore the built-in icon families and icons on the web at https://icons.expo.fyi/
function TabBarIcon(props: {
  name: React.ComponentProps<typeof FontAwesome>['name'];
  color: string;
}) {
  return <FontAwesome size={28} style={{ marginBottom: -3 }} {...props} />;
}

// コンポーネント外に定義して、再マウント時にもロックを維持する
let isGlobalProcessing = false;

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { user, firebaseUser, deleteAccount } = useAuth();
  const router = useRouter();

  // 退会処理（再ログイン後）のチェック - どのタブにいても発火するようにLayoutに配置
  useEffect(() => {
    // メール認証チェック
    if (firebaseUser && !firebaseUser.emailVerified) {
      console.log('[TabLayout] Email not verified. Redirecting to verify-email...');
      router.replace('/(auth)/verify-email');
      return;
    }

    const checkDeletionQueue = async () => {
      // グローバルロックでチェック（処理中なら何もしない）
      if (isGlobalProcessing) return;
      isGlobalProcessing = true;

      // ユーザー情報がロードされるまで待機 (firebaseUserがあればOK)
      if (!firebaseUser) {
        isGlobalProcessing = false; // ユーザーがいないならロック解除
        return;
      }

      try {
        const flag = await AsyncStorage.getItem('pending_account_deletion');

        if (flag === 'true') {
          // フラグがあった場合、ロックは解除しない（アラート表示〜遷移までロック継続）

          const targetUid = await AsyncStorage.getItem('delete_target_uid');

          // Clean up flags immediately to prevent loops
          await AsyncStorage.multiRemove(['pending_account_deletion', 'delete_target_uid']);

          // Check if the logged-in user matches the user who requested deletion
          if (targetUid && targetUid !== firebaseUser.uid) {
            Alert.alert(
              '退会処理の中断',
              '前回と異なるアカウントでログインされたため、退会処理を中断しました。',
              [{ text: 'OK', onPress: () => { isGlobalProcessing = false; } }]
            );
            return;
          }

          Alert.alert(
            '本人確認完了',
            '本人確認が完了しました。アカウントを完全に削除しますか？\nこの操作は取り消せません。',
            [
              {
                text: 'キャンセル',
                style: 'cancel',
                onPress: () => {
                  isGlobalProcessing = false; // キャンセル時はロック解除
                }
              },
              {
                text: '削除する',
                style: 'destructive',
                onPress: async () => {
                  try {
                    await deleteAccount();
                    Alert.alert('完了', 'アカウントを削除しました。');
                    router.replace('/(auth)/login');
                  } catch (error: any) {
                    console.error('Final account deletion failed:', error);
                    Alert.alert('エラー', `削除に失敗しました。\n${error.message || JSON.stringify(error)}`);
                  } finally {
                    isGlobalProcessing = false; // 完了しても失敗してもロック解除（次はログイン画面なので影響なしだが、変数は残るため）
                  }
                }
              }
            ]
          );
        } else {
          // フラグがない（通常起動）ならロック解除
          isGlobalProcessing = false;
        }
      } catch (e) {
        console.error('Failed to check deletion flag:', e);
        // エラー時もロック解除
        isGlobalProcessing = false;
      }
    };

    checkDeletionQueue();
  }, [firebaseUser]);

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: Colors[colorScheme ?? 'light'].tint,
        headerShown: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'ホーム',
          headerShown: false,
          tabBarIcon: ({ color }) => <TabBarIcon name="home" color={color} />,
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: '探す',
          tabBarIcon: ({ color }) => <TabBarIcon name="search" color={color} />,
        }}
      />
      <Tabs.Screen
        name="ai"
        options={{
          title: 'AI相談',
          tabBarIcon: ({ color }) => <TabBarIcon name="comment" color={color} />,
        }}
      />
      <Tabs.Screen
        name="mypage"
        options={{
          title: 'マイページ',
          tabBarIcon: ({ color }) => <TabBarIcon name="user" color={color} />,
        }}
      />
    </Tabs>
  );
}
