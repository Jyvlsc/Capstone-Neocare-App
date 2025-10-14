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
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { db, auth } from '../firebaseConfig';
import { collection, doc, getDoc, query, where, onSnapshot } from 'firebase/firestore';
import Icon from 'react-native-vector-icons/MaterialIcons';
import theme from '../src/theme';
import BabySizeCard from './BabySizeCard';
import CustomHeader from './CustomHeader';

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
      .then(docSnap => {
        if (docSnap.exists() && docSnap.data().fullName) {
          setFullName(docSnap.data().fullName);
        }
      })
      .catch(err => console.error('Error fetching user fullName:', err));
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
      snapshot => {
        const now = new Date();
        const upcoming = snapshot.docs
          .map(doc => {
            const data = doc.data();
            const baseDate = data.date?.toDate() || new Date();
            const [h = 0, m = 0] = (data.hour || '').split(':').map(n => parseInt(n, 10));
            baseDate.setHours(h, m);
            return {
              id: doc.id,
              date: baseDate,
              consultantName: data.consultantName || 'Unknown',
              platform: data.platform || '',
              status: data.status,
            };
          })
          .filter(appt => appt.date >= now)
          .sort((a, b) => a.date - b.date);

        setAppointments(upcoming);
        setLoading(false);
      },
      error => {
        console.error('Dashboard booking fetch error:', error);
        setAppointments([]);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

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
      <View style={styles.iconWrapper}>
        <Icon name="chevron-right" size={26} color="#D47FA6" />
      </View>
    </LinearGradient>
  );

  const quickAccessButtons = [
    { id: '1', name: 'OB-GYN', icon: 'people', screen: 'ConsultantScreen' },
    { id: '2', name: 'Birth Centers', icon: 'place', screen: 'BirthingCenterLocator' },
    { id: '3', name: 'Moods', icon: 'mood', screen: 'Assessment' },
    { id: '4', name: 'Notes', icon: 'note', screen: 'Tracker' },
    { id: '5', name: 'My Appointments', icon: 'book-online', screen: 'Bookings' },
  ];

  return (
    <SafeAreaView style={styles.safeArea}>
      <CustomHeader title="Dashboard" navigation={navigation} />

      <ScrollView contentContainerStyle={styles.container}>
        {/* Greeting Section */}
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
        <View style={styles.gridContainer}>
          {quickAccessButtons.map(btn => (
            <TouchableOpacity
              key={btn.id}
              style={styles.gridButton}
              onPress={() => navigation.navigate(btn.screen)}
            >
              <View style={styles.iconCircle}>
                <Icon name={btn.icon} size={26} color="#fff" />
              </View>
              <Text style={styles.gridButtonText}>{btn.name}</Text>
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
            keyExtractor={item => item.id}
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
        <LinearGradient
          colors={['#D47FA6', '#FF94C2']}
          style={styles.chatBotGradient}
        >
          <Icon name="chat" size={28} color="white" />
        </LinearGradient>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#FFF' },
  container: { padding: 15, paddingBottom: 90 },

  headerCard: {
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 6,
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

  gridContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  gridButton: {
    width: '30%',
    backgroundColor: '#fff',
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 18,
    marginVertical: 8,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    elevation: 3,
  },
  iconCircle: {
    backgroundColor: '#D47FA6',
    borderRadius: 50,
    padding: 10,
    marginBottom: 8,
  },
  gridButtonText: {
    fontSize: 13,
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
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  appointmentContent: { flex: 1 },
  appointmentDate: { fontSize: 16, fontWeight: '600', color: '#333' },
  appointmentTime: { fontSize: 14, color: '#666', marginVertical: 4 },
  appointmentDetails: { fontSize: 14, color: '#D47FA6', fontWeight: '600' },
  appointmentPlatform: { fontSize: 12, color: '#888', marginTop: 3 },
  iconWrapper: { paddingLeft: 10 },

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
