// src/screens/ConsultantScreen.js
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ActivityIndicator,
  Animated,
} from 'react-native';
import { db } from '../firebaseConfig';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { Image as ExpoImage } from 'expo-image';
import CustomHeader from './CustomHeader';
import theme from '../src/theme';

export default function ConsultantScreen({ navigation }) {
  const [consultants, setConsultants] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const scale = new Animated.Value(1);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const cSnap = await getDocs(collection(db, 'consultants'));
        const cons = cSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        const rSnap = await getDocs(
          query(collection(db, 'bookings'), where('rating', '>', 0))
        );
        const ratings = rSnap.docs.map(d => d.data());

        const map = {};
        ratings.forEach(({ consultantId, rating }) => {
          if (!map[consultantId]) map[consultantId] = { sum: 0, count: 0 };
          map[consultantId].sum += rating;
          map[consultantId].count += 1;
        });

        const merged = cons.map(c => {
          const rec = map[c.id];
          return {
            ...c,
            avgRating: rec ? (rec.sum / rec.count).toFixed(1) : null,
          };
        });

        setConsultants(merged);
      } catch (e) {
        console.error('Fetch failed', e);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, []);

  const filtered = consultants.filter(
    c =>
      c.hourlyRate != null &&
      c.name?.toLowerCase().includes(search.toLowerCase())
  );

  const animatePress = () => {
    Animated.sequence([
      Animated.timing(scale, { toValue: 0.96, duration: 100, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 3, useNativeDriver: true }),
    ]).start();
  };

  const renderItem = ({ item }) => (
    <TouchableOpacity
      onPress={() => {
        animatePress();
        navigation.navigate('ConsultantDetail', { consultantId: item.id });
      }}
      activeOpacity={0.8}
    >
      <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
        <ExpoImage
          source={{ uri: item.profilePhoto }}
          style={styles.image}
          contentFit="cover"
          transition={300}
        />
        <View style={styles.info}>
          <Text style={styles.name}>{item.name || 'Unknown'}</Text>
          <Text style={styles.specialty}>{item.specialty || '-'}</Text>
          <Text style={styles.rating}>
            {item.avgRating != null ? `⭐ ${item.avgRating}` : 'No ratings yet'}
          </Text>
          <Text style={styles.rate}>
            {item.hourlyRate != null
              ? `₱${item.hourlyRate}/hr`
              : 'Rate to be announced'}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );

  if (loading) {
    return <ActivityIndicator style={styles.loader} size="large" color="#D47FA6" />;
  }

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader title="Consultants" navigation={navigation} />

      <FlatList
        data={filtered}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        ListHeaderComponent={
          <TextInput
            style={styles.searchInput}
            placeholder="🔍 Search consultants..."
            placeholderTextColor="#999"
            value={search}
            onChangeText={setSearch}
          />
        }
        contentContainerStyle={{ paddingBottom: 16 }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FAF7FB' },
  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchInput: {
    borderWidth: 1,
    borderColor: '#D47FA6',
    padding: 12,
    margin: 16,
    borderRadius: 25,
    backgroundColor: '#fff',
    elevation: 3,
    fontSize: 16,
  },
  card: {
    flexDirection: 'row',
    padding: 16,
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginBottom: 14,
    borderRadius: 16,
    elevation: 4,
    shadowColor: '#D47FA6',
    shadowOpacity: 0.2,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
  },
  image: {
    width: 65,
    height: 65,
    borderRadius: 35,
    marginRight: 14,
    borderWidth: 2,
    borderColor: '#D47FA6',
  },
  info: { flex: 1, justifyContent: 'center' },
  name: { fontSize: 20, fontWeight: '700', color: '#333' },
  specialty: { fontSize: 15, color: '#666', marginTop: 2 },
  rating: { fontSize: 14, color: '#FFD700', marginTop: 6 },
  rate: { fontSize: 15, color: '#D47FA6', marginTop: 4, fontWeight: '600' },
});
