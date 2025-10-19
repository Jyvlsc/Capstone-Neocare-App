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
  doc, getDoc, updateDoc, deleteDoc
} from 'firebase/firestore';
import moment from 'moment-timezone';
import { Rating } from 'react-native-ratings';
import theme from '../src/theme';
import commonStyles from '../src/commonStyles';
import CustomHeader from './CustomHeader';

export default function BookingsScreen({ navigation }) {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('upcoming');
  const [tempRatings, setTempRatings] = useState({}); // Store temporary ratings

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
  }, []);

  const now = moment().tz('Asia/Manila');

  const getApptMoment = b => {
    if (!b.date) return null;
    const dateObj = b.date.toDate?.() ?? new Date(b.date);
    const [h = 0, m = 0] = (typeof b.hour === 'string'
      ? b.hour.split(':')
      : []
    ).map(n => parseInt(n, 10));
    return moment(dateObj).tz('Asia/Manila').hour(h).minute(m);
  };

  // Handle rating change
  const handleRatingChange = (bookingId, rating) => {
    setTempRatings(prev => ({
      ...prev,
      [bookingId]: rating
    }));
  };

  // Submit rating to Firestore
  const submitRating = async (booking) => {
    const rating = tempRatings[booking.id];
    
    if (!rating || rating === 0) {
      Alert.alert('Error', 'Please select a rating before submitting.');
      return;
    }

    try {
      // Update the booking with the rating
      await updateDoc(doc(db, 'bookings', booking.id), {
        rating: rating,
        ratedAt: new Date() // Optional: add timestamp for when rating was given
      });

      // Clear the temporary rating
      setTempRatings(prev => {
        const newRatings = { ...prev };
        delete newRatings[booking.id];
        return newRatings;
      });

      Alert.alert('Thank you!', 'Your rating has been submitted successfully.');
    } catch (e) {
      console.error('Error submitting rating:', e);
      Alert.alert('Error', 'Could not submit rating. Please try again.');
    }
  };

  const filtered = bookings.filter(b => {
    const appt = getApptMoment(b);
    if (filter === 'unpaid') {
      return b.status === 'accepted'
        && b.paymentStatus === 'unpaid'
        && appt && appt.isSameOrAfter(now);
    }
    if (filter === 'complete') {
      return appt && appt.isBefore(now) && b.paymentStatus === 'paid';
    }
    return appt && appt.isSameOrAfter(now) &&
      (b.status === 'pending' || b.paymentStatus === 'paid');
  });

  const handlePay = async booking => {
    try {
      const resp = await fetch('http://172.16.201.190:3000/api/payments/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: booking.amount,
          bookingId: booking.id
        }),
      });
      const { url, error } = await resp.json();
      if (error || !url) throw new Error(error || 'No payment URL');
      await Linking.openURL(url);
      await updateDoc(doc(db, 'bookings', booking.id), {
        paymentStatus: 'paid'
      });
    } catch (e) {
      console.error(e);
      Alert.alert('Payment failed', e.message || 'Try again later.');
    }
  };

  const handleCancel = async booking => {
    try {
      await deleteDoc(doc(db, 'bookings', booking.id));
    } catch (e) {
      console.error('Error cancelling booking:', e);
      Alert.alert('Error', 'Could not cancel appointment.');
    }
  };

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
          <View style={[styles.badge, { backgroundColor: '#E8F0FE' }]}>
            <Text style={styles.badgeText}>Status: {item.status}</Text>
          </View>
          <View style={[styles.badge, { backgroundColor: item.paymentStatus === 'paid' ? '#D4EDDA' : '#FFF3CD' }]}>
            <Text style={styles.badgeText}>Payment: {item.paymentStatus}</Text>
          </View>
        </View>

        {filter === 'upcoming' && item.status === 'pending' && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => handleCancel(item)}
          >
            <Text style={styles.cancelText}>Cancel Appointment</Text>
          </TouchableOpacity>
        )}

        {filter === 'unpaid' && (
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => handlePay(item)}
          >
            <Text style={styles.payText}>
              Pay ₱{(item.amount / 100).toFixed(2)}
            </Text>
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
              <TouchableOpacity
                style={styles.submitBtn}
                onPress={() => submitRating(item)}
              >
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
  safeArea: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  tabs: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginVertical: 12,
    paddingHorizontal: 10,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 18,
    borderRadius: 20,
    backgroundColor: '#E5E7EB',
  },
  activeTab: {
    backgroundColor: '#D47FA6',
  },
  tabText: {
    color: '#374151',
    fontWeight: '500',
  },
  activeText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: { paddingHorizontal: 15, paddingBottom: 20 },
  noText: { fontSize: 16, color: '#6B7280', textAlign: 'center', marginTop: 20 },

  card: {
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 2,
    marginVertical: 8,
  },
  title: {
    fontSize: 18, fontWeight: '600', color: '#111827',
  },
  details: {
    fontSize: 15, marginVertical: 6, color: '#374151',
  },
  badgesRow: {
    flexDirection: 'row',
    marginVertical: 6,
    gap: 8,
  },
  badge: {
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#333',
  },
  cancelBtn: {
    marginTop: 12,
    backgroundColor: '#EF4444',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelText: { color: '#fff', fontWeight: '600' },

  payButton: {
    marginTop: 12,
    backgroundColor: '#3B82F6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  payText: { color: '#fff', fontWeight: '600' },

  ratingContainer: {
    marginTop: 12,
  },
  rateTitle: {
    fontSize: 14,
    fontWeight: '500',
    color: '#374151',
    marginBottom: 8,
    textAlign: 'center',
  },
  ratingStars: {
    paddingVertical: 8,
    alignSelf: 'center',
  },
  completed: {
    color: '#16A34A',
    fontSize: 15,
    fontWeight: '600',
    textAlign: 'center',
  },
  ratedText: {
    color: '#6B7280',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 4,
  },
  submitBtn: {
    marginTop: 12,
    backgroundColor: '#D47FA6',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  submitText: { color: '#fff', fontWeight: '600' },

  center: {
    flex: 1, justifyContent: 'center', alignItems: 'center',
  },
});