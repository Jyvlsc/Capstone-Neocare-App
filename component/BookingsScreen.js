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
  const [filter, setFilter] = useState('upcoming'); // upcoming | unpaid | complete

  useEffect(() => {
    const q = query(
      collection(db, 'bookings'),
      where('userId', '==', auth.currentUser.uid)
    );
    const unsub = onSnapshot(q, async snap => {
      try {
        const enriched = await Promise.all(snap.docs.map(async d => {
          const b = { id: d.id, ...d.data() };
          // doctor name
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

  // helper to combine date + hour into a moment
  const getApptMoment = b => {
    if (!b.date) return null;
    const dateObj = b.date.toDate?.() ?? new Date(b.date);
    const [h = 0, m = 0] = (typeof b.hour === 'string'
      ? b.hour.split(':')
      : []
    ).map(n => parseInt(n, 10));
    return moment(dateObj).tz('Asia/Manila').hour(h).minute(m);
  };

  // produce filtered list
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

    // upcoming
    return appt && appt.isSameOrAfter(now) &&
      (b.status === 'pending' || b.paymentStatus === 'paid');
  });

  const handlePay = async booking => {
    try {
      const resp = await fetch('http://172.16.201.190:3000/api/payments/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount:    booking.amount,
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
    const timeStr = appt ? appt.format('HH:mm') : item.hour || '';

    return (
      <View style={styles.card}>
        <Text style={styles.title}>Dr. {item.doctorName}</Text>
        <Text style={styles.details}>📅 {dateStr} @ {timeStr}</Text>
        <Text style={styles.status}>
          Status: <Text style={{fontWeight:'bold'}}>{item.status}</Text>
        </Text>
        <Text style={styles.status}>
          Payment: <Text style={{fontWeight:'bold'}}>{item.paymentStatus}</Text>
        </Text>

        {filter === 'upcoming' && item.status === 'pending' && (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => handleCancel(item)}
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        )}

        {filter === 'unpaid' && (
          <TouchableOpacity
            style={styles.payButton}
            onPress={() => handlePay(item)}
          >
            <Text style={styles.payText}>
              Pay ₱{(item.amount/100).toFixed(2)}
            </Text>
          </TouchableOpacity>
        )}

        {filter === 'complete' && (
          item.rating
            ? <Text style={styles.completed}>Your Rating: {item.rating} ★</Text>
            : (
              <>
                <Rating
                  startingValue={item._tempRating || 0}
                  imageSize={24}
                  onFinishRating={r => { item._tempRating = r; }}
                />
                <TouchableOpacity
                  style={styles.submitBtn}
                  onPress={async () => {
                    try {
                      await updateDoc(doc(db, 'bookings', item.id), {
                        rating: item._tempRating
                      });
                      Alert.alert('Thank you!', 'Rating submitted.');
                    } catch (e) {
                      console.error(e);
                      Alert.alert('Error', 'Could not submit rating.');
                    }
                  }}
                >
                  <Text style={styles.submitText}>Submit</Text>
                </TouchableOpacity>
              </>
            )
        )}
      </View>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <CustomHeader title="My Appointments" navigation={navigation} />

      <View style={styles.tabs}>
        {['upcoming','unpaid','complete'].map(s => (
          <TouchableOpacity
            key={s}
            style={[styles.tab, filter===s && styles.activeTab]}
            onPress={()=>setFilter(s)}
          >
            <Text style={filter===s ? styles.activeText : styles.tabText}>
              {s.charAt(0).toUpperCase()+s.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {filtered.length===0 ? (
        <View style={styles.center}>
          <Text style={styles.noText}>
            {filter==='upcoming' && 'No upcoming appointments.'}
            {filter==='unpaid' && 'No payments due.'}
            {filter==='complete' && 'No completed appointments.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={b=>b.id}
          renderItem={renderItem}
          contentContainerStyle={styles.list}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex:1,
    backgroundColor:theme.colors.background||'#F5F5F5'
  },
  tabs: {
    flexDirection:'row',
    justifyContent:'space-around',
    marginVertical:10
  },
  tab: { padding:8, borderRadius:5 },
  activeTab: { backgroundColor:'#D47FA6' },
  tabText: { color:'#000' },
  activeText: { color:'#fff' },

  list: { paddingHorizontal:15, paddingBottom:20 },
  noText: { fontSize:16, color:theme.colors.textSecondary||'#666' },

  card: {
    ...commonStyles.card,
    backgroundColor:'#fff',
    padding:15,
    marginVertical:8
  },
  title: {
    fontSize:18,fontWeight:'bold',
    color:theme.colors.textPrimary||'#333'
  },
  details: {
    fontSize:16,marginVertical:4,
    color:theme.colors.textPrimary||'#333'
  },
  status: {
    fontSize:14,
    color:theme.colors.textSecondary||'#666'
  },

  cancelBtn: {
    marginTop:12,
    backgroundColor:'#FF6B6B',
    padding:8,
    borderRadius:5,
    alignSelf:'flex-start'
  },
  cancelText: { color:'#fff', fontWeight:'600' },

  payButton: {
    marginTop:12,
    backgroundColor:theme.colors.primary||'#007AFF',
    padding:10,
    borderRadius:6,
    alignItems:'center'
  },
  payText: { color:'#fff', fontWeight:'600' },

  completed: {
    marginTop:12,
    color:'#28A745',
    fontSize:16,
    fontWeight:'bold'
  },

  submitBtn: {
    marginTop:8,
    backgroundColor:'#D47FA6',
    padding:8,
    borderRadius:5,
    alignSelf:'flex-start'
  },
  submitText: { color:'#fff', fontWeight:'600' },

  center: {
    flex:1,justifyContent:'center',alignItems:'center'
  },
});
