import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Image,
  Animated,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { auth, db } from '../firebaseConfig';
import { doc, onSnapshot } from 'firebase/firestore';
import { getBabySize } from '../utils/babySize';

const getGA = (date) => {
  const now = new Date();
  const lmp = new Date(date);
  if (isNaN(lmp)) return { weeks: NaN, days: NaN };
  const diff = now - lmp;
  const totalDays = Math.floor(diff / (1000 * 60 * 60 * 24));
  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;
  return { weeks, days };
};

export default function BabySizeCard() {
  const [ga, setGA] = useState(null);
  const [size, setSize] = useState(null);
  const [progressAnim] = useState(new Animated.Value(0));

  useEffect(() => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    const unsub = onSnapshot(doc(db, 'users', uid), (snap) => {
      const data = snap.data();

      if (data?.lastMenstruationDate) {
        const lmpDate =
          typeof data.lastMenstruationDate.toDate === 'function'
            ? data.lastMenstruationDate.toDate()
            : new Date(data.lastMenstruationDate);

        const g = getGA(lmpDate);
        setGA(g);
        setSize(getBabySize(g.weeks));

        const progress = Math.min(g.weeks / 40, 1);
        Animated.timing(progressAnim, {
          toValue: progress,
          duration: 1000,
          useNativeDriver: false,
        }).start();
      }
    });

    return unsub;
  }, []);

  if (!ga || !size) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D47FA6" />
        <Text style={styles.loadingText}>Loading baby growth data...</Text>
      </View>
    );
  }

  const progressWidth = progressAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <LinearGradient
      colors={['#FFD6E0', '#FFF5F8']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <Text style={styles.weekTitle}>{`Week ${ga.weeks} + ${ga.days}`}</Text>

      {/* Pregnancy Progress Bar */}
      <View style={styles.progressBarContainer}>
        <Animated.View style={[styles.progressBarFill, { width: progressWidth }]} />
      </View>
      <Text style={styles.progressText}>{Math.round((ga.weeks / 40) * 100)}% complete</Text>

      {size.weightG ? (
        <>
          <View style={styles.infoSection}>
            <View style={styles.details}>
              <Text style={styles.label}>Estimated Weight</Text>
              <Text style={styles.weightValue}>
                {size.weightLb} lb / {size.weightG} g
              </Text>

              {size.lengthCm && (
                <>
                  <Text style={styles.label}>Length</Text>
                  <Text style={styles.lengthValue}>{size.lengthCm} cm</Text>
                </>
              )}

              <Text style={styles.label}>Size Comparison</Text>
              <Text style={styles.fruit}>{`≈ ${size.fruit}`}</Text>
            </View>

          
            <Image
              source={require('../assets/baby_placeholder.png')}
              style={styles.babyImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.progressContainer}>
            <Text style={styles.progressLabel}>Development Highlights</Text>
            <Text style={styles.description}>
              {getDevelopmentDescription(ga.weeks)}
            </Text>
          </View>
        </>
      ) : (
        <Text style={styles.text}>Growth data is available starting from week 22.</Text>
      )}
    </LinearGradient>
  );
}

const getDevelopmentDescription = (week) => {
  if (week < 12) return 'Your baby’s organs are forming, and tiny movements begin!';
  if (week < 20) return 'Your baby can now hear sounds and is growing rapidly!';
  if (week < 28) return 'Your baby’s lungs are developing and gaining more fat!';
  if (week < 36) return 'Baby is practicing breathing and preparing for birth!';
  return 'Almost ready! Your baby’s body is fully formed and gaining weight.';
};

const styles = StyleSheet.create({
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
    marginTop: 10,
  },
  card: {
    width: '100%',
    borderRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
    marginBottom: 20,
  },
  weekTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#D47FA6',
    textAlign: 'center',
    marginBottom: 10,
  },
  progressBarContainer: {
    width: '100%',
    height: 10,
    backgroundColor: '#F3E3E8',
    borderRadius: 10,
    overflow: 'hidden',
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: '#D47FA6',
    borderRadius: 10,
  },
  progressText: {
    fontSize: 13,
    color: '#555',
    textAlign: 'center',
    marginTop: 5,
    marginBottom: 15,
  },
  infoSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  details: {
    flex: 1,
  },
  label: {
    fontSize: 13,
    color: '#777',
    marginTop: 5,
  },
  weightValue: {
    fontSize: 20,
    fontWeight: '700',
    color: '#333',
  },
  lengthValue: {
    fontSize: 18,
    fontWeight: '600',
    color: '#444',
  },
  fruit: {
    fontSize: 16,
    fontWeight: '500',
    color: '#555',
    marginTop: 2,
  },
  babyImage: {
    width: 85,
    height: 85,
    marginLeft: 10,
  },
  progressContainer: {
    backgroundColor: 'rgba(255,255,255,0.85)',
    borderRadius: 12,
    padding: 10,
    marginTop: 15,
  },
  progressLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#D47FA6',
    marginBottom: 5,
  },
  description: {
    fontSize: 13,
    color: '#444',
    lineHeight: 18,
  },
  text: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
