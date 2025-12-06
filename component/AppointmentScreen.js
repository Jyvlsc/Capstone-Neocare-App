// src/pages/AppointmentScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, Image, TouchableOpacity,
  Platform, ScrollView,
  SafeAreaView, ActivityIndicator,
  StyleSheet, ToastAndroid
} from 'react-native';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import {
  collection,
  addDoc,
  doc,
  getDoc,
  Timestamp,
  serverTimestamp,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db, auth } from '../firebaseConfig';
import moment from 'moment-timezone';
import theme from '../src/theme';
import commonStyles from '../src/commonStyles';

/* 🔥 FILTER OUT PAST TIMES FOR TODAY */
const filterFutureTimes = (selectedDate, timeSlots) => {
  const now = moment().tz("Asia/Manila");
  const isToday =
    now.format("YYYY-MM-DD") ===
    moment(selectedDate).tz("Asia/Manila").format("YYYY-MM-DD");
  if (!isToday) return timeSlots;
  return timeSlots.filter(time => {
    const slotMoment = moment(
      `${moment(selectedDate).format("YYYY-MM-DD")} ${time}`,
      "YYYY-MM-DD hh:mm A"
    ).tz("Asia/Manila");
    return slotMoment.isAfter(now);
  });
};

/* 🔹 Suggest next day first available slot */
const getNextAvailableSlot = (consultant, fromDate = moment()) => {
  if (!consultant?.consultationHours?.length || !consultant?.availableDays?.length)
    return null;

  let date = fromDate.clone().startOf('day');
  for (let i = 0; i < 14; i++) { // look up to 2 weeks ahead
    const weekday = date.format('dddd');
    if (consultant.availableDays.includes(weekday)) {
      // check if this is today: skip past times
      let firstAvailableTime = consultant.consultationHours.find(t => {
        const slotMoment = moment(`${date.format('YYYY-MM-DD')} ${t}`, "YYYY-MM-DD hh:mm A");
        return slotMoment.isAfter(moment());
      });
      if (firstAvailableTime) {
        return { date: date.toDate(), time: firstAvailableTime };
      }
    }
    date.add(1, 'day');
  }
  return null; // no slots in next 2 weeks
};

export default function AppointmentScreen({ route, navigation }) {
  const { consultant, date: dateParam, time: timeParam, platform: platformParam } = route.params;
  const usedConsultant = consultant;

  // 1️⃣ Initial date
  const initialDate = dateParam
    ? new Date(`${dateParam}T00:00:00`)
    : getNextAvailableDate(usedConsultant.availableDays || []);
  const [selectedDate, setSelectedDate] = useState(initialDate);

  // 2️⃣ Time
  const [selectedHour, setSelectedHour] = useState(timeParam || '');

  // 3️⃣ Platform
  const modesRaw = Array.isArray(usedConsultant.platform) ? usedConsultant.platform : [];
  const availablePlatforms = modesRaw
    .map(m => {
      const low = String(m).toLowerCase();
      if (low === 'online') return 'Online';
      if (low === 'in-person' || low === 'in person') return 'In Person';
      return String(m).charAt(0).toUpperCase() + String(m).slice(1);
    })
    .filter((v, i, self) => v && self.indexOf(v) === i);
  const [selectedPlatform, setSelectedPlatform] = useState(platformParam || availablePlatforms[0] || '');

  // 4️⃣ Booked times
  const [bookedTimes, setBookedTimes] = useState([]);

  // 5️⃣ UI state
  const [showIosPicker, setShowIosPicker] = useState(false);
  const [isBooking, setIsBooking] = useState(false);

  // 6️⃣ User info
  const user = auth.currentUser;
  const userId = user.uid;
  const [fullName, setFullName] = useState('');
  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, 'users', userId));
        if (snap.exists() && snap.data().fullName) {
          setFullName(snap.data().fullName);
        }
      } catch (e) { console.warn('Failed to fetch fullName:', e); }
    })();
  }, [userId]);

  // 🔄 Fetch existing bookings
  useEffect(() => {
    (async () => {
      try {
        const dayStart = moment(selectedDate).tz('Asia/Manila').startOf('day').toDate();
        const nextDay = moment(dayStart).add(1, 'day').toDate();
        const q = query(
          collection(db, 'bookings'),
          where('consultantId', '==', usedConsultant.id),
          where('date', '>=', Timestamp.fromDate(dayStart)),
          where('date', '<',  Timestamp.fromDate(nextDay))
        );
        const snap = await getDocs(q);
        setBookedTimes(snap.docs.map(d => d.data().hour));
      } catch (err) {
        console.error('Error fetching bookings:', err);
      }
    })();
  }, [selectedDate, usedConsultant.id]);

  // 📅 Date-picker change
  const onChangeDate = (event, newDate) => {
    if (!newDate) {
      if (Platform.OS !== 'android') setShowIosPicker(false);
      return;
    }
    const weekday = moment(newDate).tz('Asia/Manila').format('dddd');
    if (!usedConsultant.availableDays.includes(weekday)) {
      ToastAndroid.show(`Not available on ${weekday}.`, ToastAndroid.LONG);
      if (Platform.OS !== 'android') setShowIosPicker(false);
      return;
    }
    setSelectedDate(newDate);
    if (Platform.OS !== 'android') setShowIosPicker(false);
  };
  const showPicker = () => {
    if (Platform.OS === 'android') {
      DateTimePickerAndroid.open({
        value: selectedDate,
        onChange: onChangeDate,
        mode: 'date',
        minimumDate: new Date(),
      });
    } else {
      setShowIosPicker(true);
    }
  };

  // 🔘 Booking submission
  const handleBook = useCallback(async () => {
    if (!selectedHour) {
      ToastAndroid.show('Please select a time', ToastAndroid.SHORT);
      return;
    }
    if (!selectedPlatform) {
      ToastAndroid.show('Please select a platform', ToastAndroid.SHORT);
      return;
    }
    setIsBooking(true);
    try {
      await addDoc(collection(db, 'bookings'), {
        userId,
        fullName,
        consultantId: usedConsultant.id,
        consultantName: usedConsultant.name,
        doctorId: usedConsultant.userId,
        date: Timestamp.fromDate(selectedDate),
        availableDay: moment(selectedDate).tz('Asia/Manila').format('dddd'),
        hour: selectedHour,
        platform: selectedPlatform,
        mode: selectedPlatform,
        status: 'pending',
        paymentStatus: 'unpaid',
        amount: usedConsultant.hourlyRate * 100,
        createdAt: serverTimestamp(),
      });
      ToastAndroid.show('Booking successful!', ToastAndroid.SHORT);
      navigation.goBack();
    } catch (err) {
      ToastAndroid.show(err.message, ToastAndroid.LONG);
    } finally {
      setIsBooking(false);
    }
  }, [
    userId,
    fullName,
    usedConsultant,
    selectedDate,
    selectedHour,
    selectedPlatform,
    navigation
  ]);

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.card}>
          <Text style={styles.name}>{usedConsultant.name}</Text>
          {usedConsultant.hourlyRate != null && (
            <Text style={styles.rateLabel}>₱{usedConsultant.hourlyRate} / hr</Text>
          )}
          <Image source={{ uri: usedConsultant.photoUrl }} style={styles.image} />

          {/* Date Picker */}
          <View style={styles.pickerContainer}>
            <Text style={styles.label}>
              Date (Available: {usedConsultant.availableDays.join(', ')})
            </Text>
            <TouchableOpacity onPress={showPicker} style={styles.pickerButton}>
              <Text style={styles.pickerText}>
                {moment(selectedDate).tz('Asia/Manila').format('LL')}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Time Picker */}
          <View style={styles.selectionContainer}>
            <Text style={styles.label}>Select Time</Text>

            {(() => {
              const availableTimesToday = filterFutureTimes(
                selectedDate,
                (usedConsultant.consultationHours || []).filter(
                  h => !bookedTimes.includes(h)
                )
              );

              const noTimesLeft =
                availableTimesToday.length === 0 &&
                moment(selectedDate).isSame(moment(), "day");

              return (
                <>
                  {/* 🔴 No more times today message */}
                  {noTimesLeft && (
                    <View style={{ padding: 10 }}>
                      <Text style={{ color: "red", fontSize: 14, marginBottom: 5 }}>
                        No more time slots today — how about this one?
                      </Text>

                      {(() => {
                       const suggestion = getNextAvailableSlot(usedConsultant);
                        return suggestion ? (
                          <TouchableOpacity
                            onPress={() => {
                              setSelectedDate(suggestion.date);
                              setSelectedHour(suggestion.time);
                            }}
                            style={{
                              padding: 10,
                              backgroundColor: "#eef",
                              borderRadius: 8,
                              marginTop: 5,
                            }}
                          >
                            <Text style={{ fontSize: 16, fontWeight: "600" }}>
                              {moment(suggestion.date).format("MMM DD")} at {suggestion.time}
                            </Text>
                          </TouchableOpacity>
                        ) : null;
                      })()}
                    </View>
                  )}

                  {/* Picker */}
                  <Picker selectedValue={selectedHour} onValueChange={v => setSelectedHour(v)}>
                    <Picker.Item label="-- pick a time --" value="" />
                    {availableTimesToday.map(h => (
                      <Picker.Item key={h} label={h} value={h} />
                    ))}
                  </Picker>
                </>
              );
            })()}
          </View>

          {/* Platform Picker */}
          <View style={styles.selectionContainer}>
            <Text style={styles.label}>Platform</Text>
            <Picker
              selectedValue={selectedPlatform}
              onValueChange={v => setSelectedPlatform(v)}
            >
              <Picker.Item label="-- pick a platform --" value="" />
              {availablePlatforms.map(p => (
                <Picker.Item key={p} label={p} value={p} />
              ))}
            </Picker>
          </View>

          {/* Book Button */}
          <TouchableOpacity
            style={[
              commonStyles.buttonPrimary,
              {
                margin: 20,
                opacity: (!selectedHour || !selectedPlatform || isBooking) ? 0.5 : 1
              }
            ]}
            onPress={handleBook}
            disabled={!selectedHour || !selectedPlatform || isBooking}
          >
            {isBooking
              ? <ActivityIndicator color="#FFF" />
              : <Text style={commonStyles.buttonText}>Book Appointment</Text>
            }
          </TouchableOpacity>
        </View>

        {/* iOS Date Picker */}
        {Platform.OS === 'ios' && showIosPicker && (
          <DateTimePicker
            value={selectedDate}
            mode="date"
            display="default"
            onChange={onChangeDate}
            minimumDate={new Date()}
            style={styles.picker}
          />
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const getNextAvailableDate = availableDays => {
  const today = moment().tz('Asia/Manila').startOf('day');
  for (let i = 0; i < 7; i++) {
    if (availableDays.includes(today.format('dddd'))) {
      return today.toDate();
    }
    today.add(1, 'day');
  }
  return today.toDate();
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF4E6' },
  card: { ...commonStyles.card, margin: 20 },
  name: {
    fontSize: 24, fontWeight: 'bold', color: '#333',
    textAlign: 'center', marginBottom: 6
  },
  rateLabel: {
    fontSize: 16, fontWeight: '600',
    textAlign: 'center', marginBottom: 10,
    color: theme.colors.primary
  },
  image: { width: 120, height: 120, borderRadius: 60, alignSelf: 'center' },
  pickerContainer: { marginVertical: 20 },
  label: { fontSize: 16, fontWeight: '600', color: '#444', marginBottom: 10 },
  pickerButton: {
    backgroundColor: '#FFF', borderRadius: 10,
    padding: 15, borderWidth: 1, borderColor: '#E0E0E0'
  },
  pickerText: { fontSize: 16, color: '#333' },
  selectionContainer: { marginBottom: 20 },
  picker: { marginTop: 12 }
});
