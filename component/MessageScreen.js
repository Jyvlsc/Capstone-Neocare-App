// src/screens/MessageScreen.js

import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  SafeAreaView,
  Image,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useNavigation } from '@react-navigation/native';
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  getDoc,
  getDocs,
  limit,
  doc,
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import CustomHeader from './CustomHeader';
import theme from '../src/theme';

const MessageScreen = () => {
  const [conversations, setConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const navigation = useNavigation();
  const user = auth.currentUser;

  const subscribeChats = useCallback(
    (userId) => {
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', userId),
        orderBy('createdAt', 'desc')
      );

      return onSnapshot(
        q,
        (snapshot) => {
          (async () => {
            const convs = await Promise.all(
              snapshot.docs.map(async (chatDoc) => {
                const chat = chatDoc.data();
                const otherId = chat.participants.find((id) => id !== userId);

                let name = '';
                let avatar = null;
                try {
                  const userSnap = await getDoc(doc(db, 'users', otherId));
                  if (userSnap.exists()) {
                    const u = userSnap.data();
                    name = u.fullName || u.displayName || u.email || '';
                    avatar = u.photoURL || null;
                  }
                } catch {}

                if (!name) {
                  try {
                    const consSnap = await getDoc(doc(db, 'consultants', otherId));
                    if (consSnap.exists()) {
                      const c = consSnap.data();
                      name = c.name || '';
                      avatar = c.profilePhoto || avatar;
                    }
                  } catch {}
                }

                if (!name) name = otherId;

                let lastMessage = chat.lastMessageText || '';
                let timestamp = chat.lastUpdated?.toDate() || chat.createdAt?.toDate();

                if (!lastMessage) {
                  const msgsSnap = await getDocs(
                    query(
                      collection(db, 'chats', chatDoc.id, 'messages'),
                      orderBy('createdAt', 'desc'),
                      limit(1)
                    )
                  );
                  if (!msgsSnap.empty) {
                    const m = msgsSnap.docs[0].data();
                    lastMessage = m.text;
                    timestamp = m.createdAt.toDate();
                  }
                }

                return {
                  id: chatDoc.id,
                  otherId,
                  name,
                  avatar,
                  lastMessage,
                  timestamp,
                };
              })
            );

            setConversations(convs);
            setLoading(false);
            setRefreshing(false);
          })();
        },
        (error) => {
          console.error('Chat subscription error', error);
          setLoading(false);
          setRefreshing(false);
        }
      );
    },
    []
  );

  useEffect(() => {
    if (!user) {
      navigation.navigate('Login');
      return;
    }
    const unsub = subscribeChats(user.uid);
    return () => unsub();
  }, [navigation, subscribeChats, user]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    if (user) subscribeChats(user.uid);
  }, [user, subscribeChats]);

  const handleChatClick = (chat) => {
    navigation.navigate('Chat', {
      chatDetails: {
        chatId: chat.id,
        participants: [user.uid, chat.otherId],
      },
    });
  };

  const formatTime = (ts) =>
    ts ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <LinearGradient
      colors={['#FFF6E5', '#FFD8A9']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <CustomHeader title="Messages" navigation={navigation} />

        <FlatList
          data={conversations}
          keyExtractor={(item) => item.id}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Image
                source={require('../assets/empty-chat.png')}
                style={styles.emptyImage}
                resizeMode="contain"
              />
              <Text style={styles.emptyText}>No conversations yet</Text>
              <Text style={styles.emptySubText}>Start chatting with a consultant </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.chatCard}
              onPress={() => handleChatClick(item)}
              activeOpacity={0.85}
            >
              <View style={styles.avatarWrapper}>
                {item.avatar ? (
                  <Image source={{ uri: item.avatar }} style={styles.avatar} />
                ) : (
                  <LinearGradient
                    colors={['#FFB775', '#FF8C42']}
                    style={styles.avatarPlaceholder}
                  >
                    <Text style={styles.avatarPlaceholderText}>
                      {item.name.charAt(0).toUpperCase()}
                    </Text>
                  </LinearGradient>
                )}
              </View>

              <View style={styles.chatDetails}>
                <View style={styles.chatHeader}>
                  <Text style={styles.chatName}>{item.name}</Text>
                  <Text style={styles.timestamp}>{formatTime(item.timestamp)}</Text>
                </View>
                <Text style={styles.lastMessage} numberOfLines={1}>
                  {item.lastMessage || 'Say hello 👋'}
                </Text>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={
            conversations.length === 0 && styles.flatEmptyContainer
          }
        />
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFF',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 14,
    borderRadius: 18,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
  },
  avatarWrapper: {
    marginRight: 12,
  },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
  },
  avatarPlaceholder: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
  },
  chatDetails: {
    flex: 1,
  },
  chatHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  chatName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#3A2D1F',
  },
  lastMessage: {
    fontSize: 14,
    color: '#6B5C4A',
    marginTop: 4,
  },
  timestamp: {
    fontSize: 12,
    color: '#A89074',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 40,
  },
  emptyImage: {
    width: 150,
    height: 150,
    marginBottom: 20,
    opacity: 0.9,
  },
  emptyText: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3A2D1F',
  },
  emptySubText: {
    fontSize: 14,
    color: '#6E5C47',
    textAlign: 'center',
    marginTop: 6,
  },
  flatEmptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});

export default MessageScreen;
