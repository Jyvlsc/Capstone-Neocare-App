import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  Image,
  Modal,
  ActivityIndicator,
  SafeAreaView,
  Alert,
  Platform,
} from 'react-native';
import MoodPopup from './MoodPopUp';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getAuth } from 'firebase/auth';
import { app } from '../firebaseConfig';               // your Firebase init
import theme from '../src/theme';
import commonStyles from '../src/commonStyles';

export default function GetStarted({ navigation }) {
  const [showMoodPopup, setShowMoodPopup] = useState(false);
  const [loading, setLoading] = useState(true);
  const auth = getAuth(app);
  const userId = auth.currentUser?.uid;

  useEffect(() => {
    setLoading(false);
  }, []);

  const handleGetStartedPress = async () => {
    if (!userId) {
      alert('User ID is missing');
      return;
    }
    const today = new Date().toISOString().split('T')[0];
    const key = `lastMoodPopupDate_${userId}`;
    const last = await AsyncStorage.getItem(key);

    if (last !== today) {
      setShowMoodPopup(true);
    } else {
      navigation.replace('HomeTabs');
    }
  };

  const handleMoodSubmit = async (data) => {
    const key = `lastMoodPopupDate_${userId}`;
    await AsyncStorage.setItem(key, new Date().toISOString().split('T')[0]);
    setShowMoodPopup(false);
    navigation.replace('HomeTabs', { moodData: data });
  };

  const handleEmergencyPress = async () => {
    // Adjust this to where your Node server really is!
    const baseURL =
      Platform.OS === 'android'
        ? 'http://172.16.201.190:3000'
        : 'http://localhost:3000';
    // Uncomment the line below if on a real device pointing at your PC's IP:
    // const baseURL = 'http://192.168.1.10:3000';

    try {
      console.log('👉 Sending emergency to', `${baseURL}/api/emergency`);
      const resp = await fetch(`${baseURL}/api/emergency`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      });
      console.log('⏳ status:', resp.status);
      const json = await resp.json();
      console.log('📥 body:', json);
      if (!resp.ok) {
        throw new Error(json.error || `HTTP ${resp.status}`);
      }
      Alert.alert('Alert sent', 'Your emergency contact has been notified.');
    } catch (err) {
      console.error('Emergency SMS error:', err);
      Alert.alert('Error', err.message);
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Top: Logo + Title */}
      <View style={styles.header}>
        <Image
          source={require('../assets/logo.png')}
          style={styles.logo}
        />
        <Text style={styles.title}>NEOCARE</Text>
        <Text style={styles.subtitle}>Tender Care for Two</Text>
      </View>

      {/* Middle: Get Started */}
      <View style={styles.middle}>
        <TouchableOpacity
          style={styles.getStartedButton}
          onPress={handleGetStartedPress}
          activeOpacity={0.8}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={styles.getStartedText}>Get Started</Text>
        </TouchableOpacity>
      </View>

      {/* Bottom: Emergency */}
      <View style={styles.bottom}>
        <TouchableOpacity
          style={styles.emergencyButton}
          onPress={handleEmergencyPress}
          activeOpacity={0.7}
          hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
        >
          <Text style={styles.emergencyText}>EMERGENCY</Text>
        </TouchableOpacity>
      </View>

      {/* Mood Popup */}
      <Modal
        visible={showMoodPopup}
        transparent
        animationType="fade"
        onRequestClose={() => setShowMoodPopup(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <MoodPopup onSubmit={handleMoodSubmit} userId={userId} />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    ...commonStyles.screenContainer,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  container: {
    flex: 1,
    backgroundColor: '#fafafa',
    paddingHorizontal: 20,
    justifyContent: 'space-between',
  },
  header: {
    alignItems: 'center',
    marginTop: 50,
  },
  logo: {
    width: 140,
    height: 140,
    marginBottom: 16,
    resizeMode: 'contain',
  },
  title: {
    fontSize: 32,
    color: theme.colors.primary,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginTop: 4,
  },
  middle: {
    alignItems: 'center',
  },
  getStartedButton: {
    width: '80%',
    backgroundColor: theme.colors.primary,
    paddingVertical: 18,
    borderRadius: 30,
    elevation: 4,
    alignItems: 'center',
  },
  getStartedText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  bottom: {
    alignItems: 'center',
    marginBottom: 30,
  },
  emergencyButton: {
    width: '100%',
    backgroundColor: '#D32F2F',
    paddingVertical: 22,
    borderRadius: 30,
    elevation: 6,
    alignItems: 'center',
  },
  emergencyText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    width: '85%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 24,
  },
});
