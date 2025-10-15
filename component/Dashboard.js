// src/screens/Dashboard.js

import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
  FlatList,
  ActivityIndicator,
  Alert,
  Platform,
  StatusBar,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { db, auth } from '../firebaseConfig';
import { collection, doc, getDoc, query, where, onSnapshot } from 'firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { signOut } from 'firebase/auth';
import theme from '../src/theme';
import BabySizeCard from './BabySizeCard';

const getTimeOfDay = () => {
  const hr = new Date().getHours();
  if (hr < 12) return 'Morning';
  if (hr < 18) return 'Afternoon';
  return 'Evening';
};

export default function Dashboard({ navigation }) {
  const [fullName, setFullName] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) return;

    const userDocRef = doc(db, 'users', user.uid);
    getDoc(userDocRef)
      .then((docSnap) => {
        if (docSnap.exists() && docSnap.data().fullName) {
          setFullName(docSnap.data().fullName);
        }
      })
      .catch((err) => console.error('Error fetching user fullName:', err));
  }, []);

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      setAppointments([]);
      setLoading(false);
      return;
    }

    const bookingsQuery = query(
      collection(db, 'bookings'),
      where('userId', '==', user.uid),
      where('status', 'in', ['pending', 'accepted'])
    );

    const unsub = onSnapshot(
      bookingsQuery,
      (snapshot) => {
        const now = new Date();
        const upcoming = snapshot.docs
          .map((doc) => {
            const data = doc.data();
            const baseDate = data.date?.toDate() || new Date();
            const [h = 0, m = 0] = (data.hour || '').split(':').map((n) => parseInt(n, 10));
            baseDate.setHours(h, m);
            return {
              id: doc.id,
              date: baseDate,
              consultantName: data.consultantName || 'Unknown',
              platform: data.platform || '',
              status: data.status,
            };
          })
          .filter((appt) => appt.date >= now)
          .sort((a, b) => a.date - b.date);

        setAppointments(upcoming);
        setLoading(false);
      },
      (error) => {
        console.error('Dashboard booking fetch error:', error);
        setAppointments([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleLogout = async () => {
    Alert.alert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut(auth);
            navigation.replace('Login');
          } catch (error) {
            Alert.alert('Logout Failed', error.message);
          }
        },
      },
    ]);
  };

  const renderAppointment = ({ item }) => (
    <LinearGradient
      colors={['#fff', '#fdeaf2']}
      style={styles.appointmentCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <View style={styles.appointmentContent}>
        <Text style={styles.appointmentDate}>
          {item.date.toLocaleDateString('en-PH', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </Text>
        <Text style={styles.appointmentTime}>
          {item.date.toLocaleTimeString('en-PH', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </Text>
        <Text style={styles.appointmentDetails}>With Dr. {item.consultantName}</Text>
        <Text style={styles.appointmentPlatform}>{item.platform}</Text>
      </View>
      <Icon name="chevron-right" size={26} color="#D47FA6" />
    </LinearGradient>
  );

  const quickAccessButtons = [
    { id: '1', name: 'OB-GYN', icon: 'people', bgColor: '#E9A1C2', screen: 'ConsultantScreen' },
    { id: '2', name: 'Birth Centers', icon: 'place', bgColor: '#A3D6B1', screen: 'BirthingCenterLocator' },
    { id: '3', name: 'Moods', icon: 'mood', bgColor: '#F5C77A', screen: 'Assessment' },
    { id: '4', name: 'Notes', icon: 'note', bgColor: '#A5B9FF', screen: 'Tracker' },
    { id: '5', name: '  My Appointments', icon: 'book-online', bgColor: '#F5A9D0', screen: 'Bookings' },
  ];

  return (
    <LinearGradient
      colors={['#FFF6FB', '#FFD6E8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" backgroundColor="transparent" translucent />

      
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Dashboard</Text>
          <TouchableOpacity onPress={handleLogout} style={styles.logoutButton}>
            <Icon name="logout" size={22} color="#D47FA6" />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.container}>
         
          <LinearGradient
            colors={['#FFD6E8', '#FFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.headerCard}
          >
            <Text style={styles.greeting}>Good {getTimeOfDay()},</Text>
            <Text style={styles.name}>
              {fullName || auth.currentUser?.displayName || 'User'}
            </Text>
          </LinearGradient>

          <BabySizeCard />

          {/* Quick Access Section */}
          <Text style={styles.sectionTitle}>Quick Access</Text>
          <View style={styles.quickAccessContainer}>
            {quickAccessButtons.map((btn) => (
              <TouchableOpacity
                key={btn.id}
                style={[
                  styles.quickAccessCard,
                  btn.id === '4' && styles.notesCard,
                  btn.id === '5' && styles.fullWidthCard,
                ]}
                onPress={() => navigation.navigate(btn.screen)}
                activeOpacity={0.9}
              >
                <View
                  style={[styles.quickAccessIconCircle, { backgroundColor: btn.bgColor }]}
                >
                  <Icon name={btn.icon} size={28} color="#fff" />
                </View>
                <Text style={styles.quickAccessLabel}>{btn.name}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Upcoming Appointments */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Upcoming Appointments</Text>
            <TouchableOpacity onPress={() => navigation.navigate('Bookings')}>
              <Text style={styles.viewAll}>View All</Text>
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={theme.colors.primary} />
          ) : appointments.length > 0 ? (
            <FlatList
              data={appointments}
              renderItem={renderAppointment}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.appointmentsList}
              scrollEnabled={false}
            />
          ) : (
            <View style={styles.noAppointments}>
              <Icon name="event-available" size={42} color="#D47FA6" />
              <Text style={styles.noAppointmentsText}>No upcoming appointments</Text>
            </View>
          )}
        </ScrollView>

        {/* Floating Chatbot Button */}
        <TouchableOpacity
          style={styles.chatBotButton}
          onPress={() => navigation.navigate('ChatBot')}
        >
          <LinearGradient colors={['#d4af7fff', '#FF94C2']} style={styles.chatBotGradient}>
            <Icon name="chat" size={28} color="white" />
          </LinearGradient>
        </TouchableOpacity>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: 'transparent',
    paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight + 10 : 10,
  },
  container: { padding: 15, paddingBottom: 90 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 18,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#D47FA6',
  },
  logoutButton: {
    backgroundColor: '#fff',
    padding: 8,
    borderRadius: 10,
    elevation: 4,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },

  headerCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#D47FA6',
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 4,
  },
  greeting: { fontSize: 18, color: '#555' },
  name: { fontSize: 26, fontWeight: '700', color: '#D47FA6', marginTop: 5 },

  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 25,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#D47FA6',
    marginVertical: 10,
  },
  viewAll: { color: '#FF7B9C', fontWeight: '500', fontSize: 14 },

  quickAccessContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  quickAccessCard: {
    width: '30%',
    backgroundColor: '#FFF',
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 4,
    elevation: 3,
  },
  notesCard: { width: '30%' },
  fullWidthCard: {
    width: '65%',
    flexDirection: 'row',
    justifyContent: 'flex-start',
    paddingVertical: 18,
    paddingHorizontal: 16,
  },
  quickAccessIconCircle: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  quickAccessLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
    textAlign: 'center',
  },

  appointmentCard: {
    borderRadius: 15,
    padding: 18,
    marginVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#D47FA6',
    shadowOpacity: 0.12,
    shadowRadius: 6,
    elevation: 2,
    backgroundColor: '#FFF',
  },
  appointmentContent: { flex: 1 },
  appointmentDate: { fontSize: 16, fontWeight: '600', color: '#333' },
  appointmentTime: { fontSize: 14, color: '#666', marginVertical: 4 },
  appointmentDetails: { fontSize: 14, color: '#D47FA6', fontWeight: '600' },
  appointmentPlatform: { fontSize: 12, color: '#888', marginTop: 3 },

  noAppointments: { alignItems: 'center', justifyContent: 'center', padding: 30 },
  noAppointmentsText: { color: '#666', marginTop: 10, fontSize: 16 },

  chatBotButton: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    borderRadius: 40,
    width: 65,
    height: 65,
    elevation: 10,
  },
  chatBotGradient: {
    flex: 1,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
