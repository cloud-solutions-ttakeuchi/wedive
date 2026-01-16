import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, FlatList, Image, TouchableOpacity, TextInput, KeyboardAvoidingView, Platform, ScrollView, Keyboard, TouchableWithoutFeedback, Alert } from 'react-native';
import { Text, View } from '@/components/Themed';
import { Bot, Send, User, Sparkles, Ticket } from 'lucide-react-native';
import { aiConciergeService } from '../../src/services/AiConciergeService';
import { useAuth } from '../../src/context/AuthContext';
import { useRouter } from 'expo-router';

export default function AIScreen() {
  const router = useRouter();
  const { firebaseUser, refreshProfile } = useAuth();
  const [messages, setMessages] = useState<{ role: 'user' | 'assistant', content: string }[]>([
    { role: 'assistant', content: 'こんにちは！WeDiveコンシェルジュです。ダイビングのスポットや生物について何でも聞いてくださいね。' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [ticketCount, setTicketCount] = useState<number | null>(null);
  const scrollViewRef = useRef<ScrollView>(null);

  useEffect(() => {
    loadTicketCount();
  }, [firebaseUser]);

  const loadTicketCount = async () => {
    if (firebaseUser) {
      // まずFirestoreとSQLiteを同期
      await aiConciergeService.syncTickets(firebaseUser.uid);
      const count = await aiConciergeService.getRemainingCount(firebaseUser.uid);
      setTicketCount(count);
      // マイページ表示用のプロフィールデータもリフレッシュ
      await refreshProfile();
    }
  };

  const handleTestGrant = async () => {
    if (!firebaseUser) return;
    setIsLoading(true);
    try {
      // 日次制限のないテスト用付与を呼び出す
      await aiConciergeService.grantTestTicket(firebaseUser.uid);
      await loadTicketCount();
      Alert.alert('Success', 'テストチケット(1枚)を付与しました。');
    } catch (e) {
      Alert.alert('Error', '付与に失敗しました。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!firebaseUser) {
      Alert.alert('エラー', 'ログインが必要です。');
      return;
    }
    if (!input.trim() || isLoading) return;

    // チケット残数チェック
    const currentCount = await aiConciergeService.getRemainingCount(firebaseUser.uid);
    if (currentCount <= 0) {
      Alert.alert(
        'チケット不足',
        '本日の無料チャットチケットを使い切りました。明日またログインすると新しいチケットが付与されます。',
        [{ text: 'OK' }]
      );
      return;
    }

    const userMessage = { role: 'user' as const, content: input.trim() };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    Keyboard.dismiss();

    try {
      const history = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }]
      }));

      const response = await aiConciergeService.askConcierge(firebaseUser.uid, userMessage.content, history);

      if (response.error === 'tickets_exhausted') {
        setMessages(prev => [...prev, { role: 'assistant', content: '申し訳ありません。チケットが不足しています。' }]);
      } else if (response.error) {
        setMessages(prev => [...prev, { role: 'assistant', content: '申し訳ありません、エラーが発生しました。' }]);
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: response.content }]);
      }

      // 送信後に残数を再取得
      await loadTicketCount();
    } catch (error) {
      console.error(error);
      setMessages(prev => [...prev, { role: 'assistant', content: '申し訳ありません、エラーが発生しました。' }]);
    } finally {
      setIsLoading(false);
    }
  };

  // ログインしていない場合はログイン要求画面を表示
  if (!firebaseUser) {
    return (
      <View style={[styles.container, styles.center, { padding: 40 }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.title}>AIコンシェルジュ</Text>
            <Text style={styles.status}>Online • Powered by Gemini</Text>
          </View>
        </View>
        <View style={[styles.center, { flex: 1 }]}>
          <View style={styles.guestIconBg}>
            <Bot size={48} color="#0284c7" />
          </View>
          <Text style={styles.guestTitle}>ログインが必要です</Text>
          <Text style={styles.guestText}>
            AIコンシェルジュへの相談にはログインが必要です。
            ログインすると毎日無料チケットが付与されます。
          </Text>
          <TouchableOpacity style={styles.loginBtn} onPress={() => router.push('/(auth)/login')}>
            <Text style={styles.loginBtnText}>ログインする</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.signupBtn} onPress={() => router.push('/(auth)/signup')}>
            <Text style={styles.signupBtnText}>アカウント作成</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.botIconContainer}
          onLongPress={handleTestGrant}
          activeOpacity={0.7}
        >
          <Bot size={24} color="#0284c7" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.title}>AIコンシェルジュ</Text>
          <Text style={styles.status}>Online • Powered by Gemini</Text>
        </View>
        {ticketCount !== null && (
          <View style={styles.ticketBadge}>
            <Ticket size={14} color="#0284c7" />
            <Text style={styles.ticketText}>{ticketCount}</Text>
          </View>
        )}
      </View>

      <ScrollView
        style={styles.chatContainer}
        contentContainerStyle={styles.scrollContent}
        ref={scrollViewRef}
        onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        keyboardDismissMode="on-drag"
      >
        {messages.map((message, index) => (
          <View
            key={index}
            style={[
              styles.messageWrapper,
              message.role === 'user' ? styles.userMessageWrapper : styles.botMessageWrapper
            ]}
          >
            <View
              style={[
                styles.messageBubble,
                message.role === 'user' ? styles.userBubble : styles.botBubble
              ]}
            >
              <Text style={[
                styles.messageText,
                message.role === 'user' ? styles.userMessageText : styles.botMessageText
              ]}>
                {message.content}
              </Text>
            </View>
          </View>
        ))}
        {isLoading && (
          <View style={styles.botMessageWrapper}>
            <View style={[styles.messageBubble, styles.botBubble]}>
              <Text style={styles.botMessageText}>考え中...</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <View style={styles.inputContainer}>
        <TextInput
          style={styles.input}
          placeholder="AIに相談する..."
          value={input}
          onChangeText={setInput}
          multiline
          autoFocus={false} // ← 自動フォーカスを確実にオフ
          blurOnSubmit={true}
        />
        <TouchableOpacity
          style={[styles.sendButton, !input.trim() && styles.sendButtonDisabled]}
          onPress={handleSend}
          disabled={!input.trim() || isLoading || !firebaseUser}
        >
          <Send size={20} color="#fff" />
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
  center: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  guestIconBg: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  guestTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#0f172a',
    marginBottom: 12,
  },
  guestText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  loginBtn: {
    backgroundColor: '#0ea5e9',
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    marginBottom: 16,
    width: '100%',
    alignItems: 'center',
  },
  loginBtnText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  signupBtn: {
    paddingHorizontal: 32,
    paddingVertical: 16,
    borderRadius: 30,
    borderWidth: 2,
    borderColor: '#0ea5e9',
    width: '100%',
    alignItems: 'center',
  },
  signupBtnText: {
    color: '#0ea5e9',
    fontWeight: 'bold',
    fontSize: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    paddingTop: Platform.OS === 'ios' ? 60 : 20,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  botIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#f0f9ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#0f172a',
  },
  status: {
    fontSize: 12,
    color: '#0ea5e9',
    fontWeight: '600',
  },
  ticketBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f9ff',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#e0f2fe',
  },
  ticketText: {
    fontSize: 13,
    fontWeight: 'bold',
    color: '#0284c7',
    marginLeft: 4,
  },
  chatContainer: {
    flex: 1,
    padding: 16,
    backgroundColor: '#fff',
  },
  scrollContent: {
    paddingBottom: 20,
    backgroundColor: '#fff',
  },
  messageWrapper: {
    marginBottom: 16,
    maxWidth: '80%',
    backgroundColor: 'transparent',
  },
  userMessageWrapper: {
    alignSelf: 'flex-end',
  },
  botMessageWrapper: {
    alignSelf: 'flex-start',
  },
  messageBubble: {
    padding: 12,
    borderRadius: 20,
  },
  userBubble: {
    backgroundColor: '#0284c7',
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: '#f1f5f9',
    borderBottomLeftRadius: 4,
  },
  messageText: {
    fontSize: 15,
    lineHeight: 22,
  },
  userMessageText: {
    color: '#fff',
  },
  botMessageText: {
    color: '#334155',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
    backgroundColor: '#fff',
  },
  input: {
    flex: 1,
    backgroundColor: '#f8fafc',
    borderRadius: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    marginRight: 12,
    fontSize: 15,
    maxHeight: 100,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0284c7',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sendButtonDisabled: {
    backgroundColor: '#cbd5e1',
  },
});
