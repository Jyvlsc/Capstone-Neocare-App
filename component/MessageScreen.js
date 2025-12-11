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
  Image
} from 'react-native';
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
  doc
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
    userId => {
      const q = query(
        collection(db, 'chats'),
        where('participants', 'array-contains', userId),
        orderBy('createdAt', 'desc')
      );

      return onSnapshot(
        q,
        snapshot => {
          (async () => {
            const convs = await Promise.all(
              snapshot.docs.map(async chatDoc => {
                const chat = chatDoc.data();
                const otherId = chat.participants.find(id => id !== userId);

                // Try fetching from 'users'
                let name = '';
                let avatar = null;
                try {
                  const userSnap = await getDoc(doc(db, 'users', otherId));
                  if (userSnap.exists()) {
                    const u = userSnap.data();
                    name = u.fullName || u.displayName || u.email || '';
                    avatar = u.photoURL || null;
                  }
                } catch (e) {
                  console.warn('User fetch error', e);
                }

                // If still no name, try 'consultants'
                if (!name) {
                  try {
                    const consSnap = await getDoc(doc(db, 'consultants', otherId));
                    if (consSnap.exists()) {
                      const c = consSnap.data();
                      name = c.name || '';
                      avatar = c.profilePhoto || avatar;
                    }
                  } catch (e) {
                    console.warn('Consultant fetch error', e);
                  }
                }

                // Final fallback to ID
                if (!name) name = otherId;

                // Fetch last message if needed
                let lastMessage = chat.lastMessageText || '';
                let timestamp =
                  chat.lastUpdated?.toDate() || chat.createdAt?.toDate();
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
                  timestamp
                };
              })
            );

            setConversations(convs);
            setLoading(false);
            setRefreshing(false);
          })();
        },
        error => {
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

  const handleChatClick = chat => {
    navigation.navigate('Chat', {
      chatDetails: {
        chatId: chat.id,
        participants: [user.uid, chat.otherId],
      }
    });
  };

  const formatTime = ts =>
    ts ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader title="Messages" navigation={navigation} />

      <FlatList
        data={conversations}
        keyExtractor={item => item.id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              No conversations yet. Start chatting!
            </Text>
          </View>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.chatItem}
            onPress={() => handleChatClick(item)}
          >
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarPlaceholderText}>
                  {item.name.charAt(0)}
                </Text>
              </View>
            )}
            <View style={styles.chatInfo}>
              <Text style={styles.chatName}>{item.name}</Text>
              <Text style={styles.lastMessage} numberOfLines={1}>
                {item.lastMessage}
              </Text>
            </View>
            <Text style={styles.timestamp}>
              {formatTime(item.timestamp)}
            </Text>
          </TouchableOpacity>
        )}
        contentContainerStyle={
          conversations.length === 0 && styles.flatEmptyContainer
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF4E6',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    marginHorizontal: 12,
    marginVertical: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    elevation: 1,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
  },
  avatarPlaceholder: {
    width: 44,
    height: 44,
    borderRadius: 22,
    marginRight: 12,
    backgroundColor: '#DDD',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarPlaceholderText: {
    color: '#555',
    fontSize: 18,
    fontWeight: 'bold',
  },
  chatInfo: {
    flex: 1,
  },
  chatName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  lastMessage: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  timestamp: {
    fontSize: 12,
    color: '#999',
    marginLeft: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    color: '#666',
    textAlign: 'center',
  },
  flatEmptyContainer: {
    flexGrow: 1,
    justifyContent: 'center',
  },
});

export default MessageScreen;