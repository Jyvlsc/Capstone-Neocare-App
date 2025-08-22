import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
  Text
} from "react-native";
import {
  GiftedChat,
  Bubble,
  Send,
  InputToolbar
} from "react-native-gifted-chat";
import Icon from 'react-native-vector-icons/Ionicons';
import {
  collection,
  addDoc,
  query,
  orderBy,
  onSnapshot,
  serverTimestamp
} from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import theme from '../src/theme';
import CustomHeader from './CustomHeader';

const ChatScreen = ({ route, navigation }) => {
  const { chatDetails } = route.params;
  const user = auth.currentUser;
  const [messages, setMessages] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load messages
  useEffect(() => {
    if (!chatDetails?.chatId) return;
    const messagesRef = collection(db, "chats", chatDetails.chatId, "messages");
    const q = query(messagesRef, orderBy("createdAt", "desc"));

    const unsubscribe = onSnapshot(q, snapshot => {
      const msgs = snapshot.docs.map(doc => ({
        _id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
      }));
      setMessages(msgs);
      setIsLoading(false);
    }, err => {
      console.error(err);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [chatDetails]);

  // Send a message
  const onSend = useCallback(async (msgs = []) => {
    if (!chatDetails?.chatId) return;
    try {
      await addDoc(
        collection(db, "chats", chatDetails.chatId, "messages"),
        {
          text: msgs[0].text,
          user: msgs[0].user,
          createdAt: serverTimestamp(),
          status: 'sent'
        }
      );
    } catch (e) {
      console.error(e);
    }
  }, [chatDetails]);

  // Custom message bubble
  const renderBubble = props => (
    <Bubble
      {...props}
      wrapperStyle={{
        right: {
          backgroundColor: '#D47FA6',
          padding: 12,
          marginVertical: 4
        },
        left: {
          backgroundColor: '#F0F0F0',
          padding: 12,
          marginVertical: 4
        }
      }}
      textStyle={{
        right: { color: '#FFF' },
        left: { color: '#000' }
      }}
    />
  );

  // Custom send button
  const renderSend = props => (
    <Send {...props} containerStyle={styles.sendContainer}>
      <View style={styles.sendButton}>
        <Icon name="paper-plane" size={20} color="#FFF" />
      </View>
    </Send>
  );

  // Custom input toolbar
  const renderInputToolbar = props => (
    <InputToolbar
      {...props}
      containerStyle={styles.inputToolbar}
      primaryStyle={{ alignItems: 'center' }}
    />
  );

  // Message status indicator
  const renderCustomView = props => (
    <View style={styles.statusContainer}>
      <Text style={styles.statusText}>
        {props.currentMessage.status === 'sent' && '✓'}
        {props.currentMessage.status === 'delivered' && '✓✓'}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader title="Chat" navigation={navigation} />
      {isLoading ? (
        <ActivityIndicator
          size="large"
          color={theme.colors.primary}
          style={{ flex: 1, justifyContent: 'center' }}
        />
      ) : (
        <GiftedChat
          messages={messages}
          onSend={onSend}
          user={{ _id: user?.uid, name: user?.displayName }}
          renderBubble={renderBubble}
          renderSend={renderSend}
          renderInputToolbar={renderInputToolbar}
          renderCustomView={renderCustomView}
          alwaysShowSend
          scrollToBottom
          renderAvatar={null}
          placeholder="Type your message here..."
          timeTextStyle={{
            right: { color: '#EEE' },
            left: { color: '#555' }
          }}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF4E6',
  },
  sendContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
    marginBottom: 4,
  },
  sendButton: {
    backgroundColor: '#D47FA6',
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
  },
  inputToolbar: {
    marginHorizontal: 8,
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 24,
    backgroundColor: '#FFF',
    elevation: 2,
  },
  statusContainer: {
    position: 'absolute',
    bottom: 6,
    right: 10,
    backgroundColor: 'transparent',
  },
  statusText: {
    fontSize: 12,
    color: '#888',
  },
});

export default ChatScreen;
