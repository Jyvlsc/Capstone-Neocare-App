// src/screens/BookingsScreen.js
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  ActivityIndicator,
  Alert,
  Linking,
  TouchableOpacity
} from 'react-native';
import { db, auth } from '../firebaseConfig';
import {
  collection, query, where, onSnapshot,
  doc, getDoc, updateDoc
} from 'firebase/firestore';
import moment from 'moment-timezone';
import { Rating } from 'react-native-ratings';
import theme from '../src/theme';
import CustomHeader from './CustomHeader';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';


Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function showNotification(title, body, data = {}) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data },
    trigger: null,
  });
}

async function registerForPushNotificationsAsync(retries = 3) {
  if (!Device.isDevice) {
    console.warn('Push notifications require a physical device.');
    return null;
  }
  try {
    const tokenInfo = await Notifications.getExpoPushTokenAsync();
    console.log('Expo Push Token:', tokenInfo.data);
    return tokenInfo.data;
  } catch (error) {
    console.warn(`Push registration failed: ${error.message}`);
    if (retries > 0) {
      await new Promise(res => setTimeout(res, 2000));
      return registerForPushNotificationsAsync(retries - 1);
    } else {
      return null;
    }
  }
}


export default function BookingsScreen({ navigation }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');
  const [tempRatings, setTempRatings] = useState({});
  const [expoPushToken, setExpoPushToken] = useState(null);

  const now = moment().tz('Asia/Manila');

  useEffect(() => {
    registerForPushNotificationsAsync().then(token => {
      setExpoPushToken(token);
    });
  }, []);

  useEffect(() => {
    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', auth.currentUser.uid)
    );

    const unsub = onSnapshot(q, async snap => {
      try {
        const enriched = await Promise.all(snap.docs.map(async d => {
          const b = { id: d.id, ...d.data() };
          let name = '';
          if (b.consultantId) {
            const docSnap = await getDoc(doc(db, 'consultants', b.consultantId));
            if (docSnap.exists()) name = docSnap.data().name;
          }

         
      
if (b.status === 'cancelled' && !b.cancelNotified) {
  const title = 'Appointment Cancelled ❌';
  const body = `Your appointment with Dr. ${name} has been cancelled due to no-show.`;
  await showNotification(title, body, { bookingId: b.id });
  await updateDoc(doc(db, 'bookings', b.id), { cancelNotified: true });
}


if (b.status === 'accepted' && !b.notified) {
  const title = 'Appointment Accepted ✅';
  const body = `Your appointment with Dr. ${name} has been accepted!`;
  await showNotification(title, body, { bookingId: b.id });
  await updateDoc(doc(db, 'bookings', b.id), { notified: true });
}


if (b.status === 'accepted' && !b.upcomingNotified) {
  const apptMoment = getApptMoment(b);

  if (apptMoment) {
    const hoursBefore = apptMoment.diff(now, 'hours');

    if (hoursBefore <= 24 && hoursBefore >= 0) {
      const title = 'Upcoming Appointment Reminder 🔔';
      const body = `You have an appointment with Dr. ${name} on ${apptMoment.format('LLL')}.`;

      await showNotification(title, body, { bookingId: b.id });

      await updateDoc(doc(db, 'bookings', b.id), { upcomingNotified: true });
    }
  }
}


if (b.status === 'accepted' && !b.oneHourNotified) {
  const apptMoment = getApptMoment(b);

  if (apptMoment) {
    const mins = apptMoment.diff(now, 'minutes');

  
    if (mins <= 60 && mins > 50) {
      const title = 'Appointment in 1 Hour ⏰';
      const body = `You have an appointment with Dr. ${name} in 1 hour.`;

      await showNotification(title, body, { bookingId: b.id });

      await updateDoc(doc(db, 'bookings', b.id), { oneHourNotified: true });
    }
  }
}


if (b.status === 'accepted' && !b.tenMinNotified) {
  const apptMoment = getApptMoment(b);

  if (apptMoment) {
    const mins = apptMoment.diff(now, 'minutes');

   
    if (mins <= 10 && mins > 5) {
      const title = 'Appointment in 10 Minutes ⏰';
      const body = `You have an appointment with Dr. ${name} in 10 minutes.`;

      await showNotification(title, body, { bookingId: b.id });

      await updateDoc(doc(db, 'bookings', b.id), { tenMinNotified: true });
    }
  }
}


if (b.status === 'accepted' && !b.exactTimeNotified) {
  const apptMoment = getApptMoment(b);

  if (apptMoment) {
    const mins = apptMoment.diff(now, 'minutes');

    
    if (mins <= 0 && mins > -2) {
      const title = 'Appointment Time ⏳';
      const body = `Your appointment with Dr. ${name} is starting now.`;

      await showNotification(title, body, { bookingId: b.id });

      await updateDoc(doc(db, 'bookings', b.id), { exactTimeNotified: true });
    }
  }
}


          return { ...b, doctorName: name };
        }));

        setBookings(enriched);
      } catch (e) {
        console.error(e);
        Alert.alert('Error', 'Could not load your bookings.');
      } finally {
        setLoading(false);
      }
    }, e => {
      console.error(e);
      setLoading(false);
      Alert.alert('Error', 'Could not load your bookings.');
    });

    return () => unsub();
  }, [expoPushToken]);

  const getApptMoment = b => {
    if (!b.date) return null;
    const dateObj = b.date.toDate?.() ?? new Date(b.date);
    const [h = 0, m = 0] = (typeof b.hour === 'string' ? b.hour.split(':') : [])
      .map(n => parseInt(n, 10));
    return moment(dateObj).tz('Asia/Manila').hour(h).minute(m);
  };

  const handleRatingChange = (bookingId, rating) => {
    setTempRatings(prev => ({ ...prev, [bookingId]: rating }));
  };

  const submitRating = async booking => {
    const rating = tempRatings[booking.id];
    if (!rating || rating === 0) {
      Alert.alert('Error', 'Please select a rating before submitting.');
      return;
    }
    try {
      await updateDoc(doc(db, 'bookings', booking.id), {
        rating,
        ratedAt: new Date()
      });
      setTempRatings(prev => { const newRatings = { ...prev }; delete newRatings[booking.id]; return newRatings; });
      Alert.alert('Thank you!', 'Your rating has been submitted successfully.');
    } catch (e) {
      console.error('Error submitting rating:', e);
      Alert.alert('Error', 'Could not submit rating. Please try again.');
    }
  };

  const handlePay = async booking => {
    try {
      const resp = await fetch('http:/192.168.1.27:3000/api/payments/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount: booking.amount, bookingId: booking.id }),
      });
      const { url, error } = await resp.json();
      if (error || !url) throw new Error(error || 'No payment URL');

      await Linking.openURL(url);

      
      await updateDoc(doc(db, 'bookings', booking.id), { 
        paymentStatus: 'paid',
        status: 'completed'
      });


      setFilter('complete');

    } catch (e) {
      console.error(e);
      Alert.alert('Payment failed', e.message || 'Try again later.');
    }
  };

  const handleCancel = async booking => {
    try {
      await updateDoc(doc(db, 'bookings', booking.id), { status: 'cancelled' });
    } catch (e) {
      console.error('Error cancelling booking:', e);
      Alert.alert('Error', 'Could not cancel appointment.');
    }
  };

 
  const filtered = bookings.filter(b => {
    const appt = getApptMoment(b);

    if (filter === 'upcoming') {
      return appt && appt.isSameOrAfter(now) && b.status !== 'cancelled' && b.paymentStatus !== 'paid';
    }
    if (filter === 'unpaid') {
      return b.paymentStatus === 'unpaid' && b.status === 'accepted';
    }
    if (filter === 'complete') {
      return b.paymentStatus === 'paid' && b.status === 'completed';
    }
    return false;
  });

  
  const renderItem = ({ item }) => {
    const appt = getApptMoment(item);
    const dateStr = appt ? appt.format('LL') : 'Unknown';
    const timeStr = appt ? appt.format('hh:mm A') : item.hour || '';
    const currentTempRating = tempRatings[item.id] || 0;

    return (
      <View style={styles.card}>
        <Text style={styles.title}>Dr. {item.doctorName}</Text>
        <Text style={styles.details}>📅 {dateStr} • 🕒 {timeStr}</Text>

        <View style={styles.badgesRow}>
          <View style={[styles.badge, { backgroundColor: '#E8F0FE' }]}><Text style={styles.badgeText}>Status: {item.status}</Text></View>
          <View style={[styles.badge, { backgroundColor: item.paymentStatus === 'paid' ? '#D4EDDA' : '#FFF3CD' }]}><Text style={styles.badgeText}>Payment: {item.paymentStatus}</Text></View>
        </View>

        {filter === 'upcoming' && item.status === 'pending' && (
          <TouchableOpacity style={styles.cancelBtn} onPress={() => handleCancel(item)}>
            <Text style={styles.cancelText}>Cancel Appointment</Text>
          </TouchableOpacity>
        )}

        {filter === 'unpaid' && (
          <TouchableOpacity style={styles.payButton} onPress={() => handlePay(item)}>
            <Text style={styles.payText}>Pay ₱{(item.amount / 100).toFixed(2)}</Text>
          </TouchableOpacity>
        )}

        {filter === 'complete' && (
          item.rating ? (
            <View style={styles.ratingContainer}>
              <Text style={styles.completed}>⭐ Your Rating: {item.rating}/5</Text>
              <Text style={styles.ratedText}>Thank you for your feedback!</Text>
            </View>
          ) : (
            <View style={styles.ratingContainer}>
              <Text style={styles.rateTitle}>Rate your experience with Dr. {item.doctorName}</Text>
              <Rating
                startingValue={currentTempRating}
                imageSize={24}
                onFinishRating={(rating) => handleRatingChange(item.id, rating)}
                style={styles.ratingStars}
              />
              <TouchableOpacity style={styles.submitBtn} onPress={() => submitRating(item)}>
                <Text style={styles.submitText}>Submit Rating</Text>
              </TouchableOpacity>
            </View>
          )
        )}
      </View>
    );
  };


  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary || '#007AFF'} />
        <Text style={{ marginTop: 10 }}>Loading your appointments...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <CustomHeader title="My Appointments" navigation={navigation} />

      <View style={styles.tabs}>
        {['upcoming', 'unpaid', 'complete'].map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.tab, filter === s && styles.activeTab]}
            onPress={() => setFilter(s)}
          >
            <Text style={filter === s ? styles.activeText : styles.tabText}>
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length === 0 ? (
        <View style={styles.center}>
          <Text style={styles.noText}>
            {filter === 'upcoming' && 'No upcoming appointments.'}
            {filter === 'unpaid' && 'No unpaid appointments.'}
            {filter === 'complete' && 'No completed appointments yet.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={b => b.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: '#F9FAFB' },
  tabs: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 12, paddingHorizontal: 10 },
  tab: { paddingVertical: 8, paddingHorizontal: 18, borderRadius: 20, backgroundColor: '#E5E7EB' },
  activeTab: { backgroundColor: '#D47FA6' },
  tabText: { color: '#374151', fontWeight: '500' },
  activeText: { color: '#fff', fontWeight: '600' },
  list: { paddingHorizontal: 15, paddingBottom: 20 },
  noText: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginTop: 20 },
  card: { backgroundColor: '#fff', padding: 16, borderRadius: 12, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 6, elevation: 2, marginVertical: 8 },
  title: { fontSize: 18, fontWeight: '600', color: '#111827' },
  details: { fontSize: 15, marginVertical: 6, color: '#374151' },
  badgesRow: { flexDirection: 'row', marginVertical: 6, gap: 8 },
  badge: { paddingVertical: 4, paddingHorizontal: 8, borderRadius: 8 },
  badgeText: { fontSize: 13, fontWeight: '500', color: '#333' },
  cancelBtn: { marginTop: 12, backgroundColor: '#EF4444', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  cancelText: { color: '#fff', fontWeight: '600' },
  payButton: { marginTop: 12, backgroundColor: '#3B82F6', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  payText: { color: '#fff', fontWeight: '600' },
  ratingContainer: { marginTop: 12 },
  rateTitle: { fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8, textAlign: 'center' },
  ratingStars: { paddingVertical: 8, alignSelf: 'center' },
  completed: { color: '#16A34A', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  ratedText: { color: '#6B7280', fontSize: 13, textAlign: 'center', marginTop: 4 },
  submitBtn: { marginTop: 12, backgroundColor: '#D47FA6', paddingVertical: 10, borderRadius: 8, alignItems: 'center' },
  submitText: { color: '#fff', fontWeight: '600' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
