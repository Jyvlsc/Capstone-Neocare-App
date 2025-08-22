import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { auth, db } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { getBabySize } from '../utils/babySize';

// ✅ Updated getGA function for input validation
const getGA = (date) => {
  const now = new Date();
  const lmp = new Date(date);
  if (isNaN(lmp)) return { weeks: NaN, days: NaN }; // UPDATED: Validate input
  const diff = now - lmp;
  const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return { weeks, days };
};

export default function BabySizeCard() {
  const [ga, setGA] = useState(null);
  const [size, setSize] = useState(null);

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsub = onSnapshot(doc(db, 'users', uid), snap => {
      const data = snap.data();

      if (data?.lastMenstruationDate) {
        const lmpDate =
          typeof data.lastMenstruationDate.toDate === 'function'
            ? data.lastMenstruationDate.toDate()
            : new Date(data.lastMenstruationDate); // UPDATED: Properly convert Firestore Timestamp

        const g = getGA(lmpDate);
        setGA(g);
        setSize(getBabySize(g.weeks));
      }
    });

    return unsub;
  }, []);

  if (!ga || !size) {
    return <ActivityIndicator size="large" color="#D47FA6" />;
  }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>
        {`Week ${ga.weeks} + ${ga.days}`}
      </Text>
      {size.weightG ? (
        <>
          <Text style={styles.weight}>
            {size.weightLb} lb / {size.weightG} g
          </Text>
          <Text style={styles.fruit}>{`≈ a ${size.fruit}`}</Text>
        </>
      ) : (
        <Text style={styles.text}>Growth data starts at 22 weeks.</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '100%',
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    elevation: 3,
    marginBottom: 20,
    alignItems: 'center',
  },
  title: { fontSize: 18, fontWeight: '600', color: '#D47FA6', marginBottom: 8 },
  weight: { fontSize: 30, fontWeight: '700', color: '#333' },
  fruit: { fontSize: 16, marginTop: 4, color: '#666' },
  text:  { fontSize: 14, color: '#666' },
});