// src/screens/BirthingCenterLocator.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Linking,
  SafeAreaView,
  TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import CustomHeader from './CustomHeader';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const GOOGLE_MAPS_API_KEY = 'AIzaSyBcJDGxtpPyKTJaH8VsPdWq3RkohUNkfd4';

const theme = {
  colors: {
    primary: '#D47FA6',
    background: '#FFF4E6',
    text: '#333',
    subtext: '#666',
  },
};

export default function BirthingCenterLocator({ navigation }) {
  const [userLocation, setUserLocation] = useState(null);
  const [registeredCenters, setRegisteredCenters] = useState([]);
  const [birthingCenters, setBirthingCenters] = useState([]);
  const [loadingLoc, setLoadingLoc] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);


  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Location permission denied');
        setLoadingLoc(false);
        return;
      }
      try {
        const { coords } = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.High,
        });
        setUserLocation(coords);
      } catch {
        Alert.alert('Could not fetch location');
      } finally {
        setLoadingLoc(false);
      }
    })();
  }, []);

 
  useEffect(() => {
    (async () => {
      try {
        const q = query(collection(db, 'users'), where('role', '==', 'clinic'));
        const snap = await getDocs(q);
        setRegisteredCenters(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('Error loading clinics:', e);
      }
    })();
  }, []);

  
  useEffect(() => {
    if (!userLocation) return;
    fetchNearbyCenters(userLocation.latitude, userLocation.longitude);
  }, [userLocation]);

  const fetchNearbyCenters = async (lat, lng) => {
    try {
      const url =
        `https://maps.googleapis.com/maps/api/place/nearbysearch/json` +
        `?location=${lat},${lng}` +
        `&radius=5000&type=hospital&keyword=birth&key=${GOOGLE_MAPS_API_KEY}`;
      const res = await fetch(url);
      const json = await res.json();
      setBirthingCenters(json.results || []);
    } catch (e) {
      console.error(e);
      Alert.alert('Error fetching nearby centers');
    }
  };

 
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const toRad = v => (v * Math.PI) / 180;
    const R = 6371; // radius in km
    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(lat1)) *
        Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  };

 
  const filteredRegistered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return registeredCenters.filter(center =>
      (center.birthCenterName || '').toLowerCase().includes(term)
    );
  }, [searchTerm, registeredCenters]);

 
  const filteredPlaces = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return birthingCenters
      .filter(c => {
        if (!userLocation || !c.geometry) return false;
        const { lat, lng } = c.geometry.location;
        return calculateDistance(
          userLocation.latitude,
          userLocation.longitude,
          lat,
          lng
        ) <= 10;
      })
      .filter(c =>
        term
          ? (c.name || '').toLowerCase().includes(term) ||
            (c.vicinity || '').toLowerCase().includes(term)
          : true
      );
  }, [birthingCenters, userLocation, searchTerm]);

 
  const openDirections = loc => {
    if (!userLocation) return Alert.alert('No location available');
    const origin = `${userLocation.latitude},${userLocation.longitude}`;
    const dest = `${loc.lat},${loc.lng}`;
    const url = `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${dest}`;
    Linking.openURL(url).catch(() => Alert.alert('Cannot open maps'));
  };

  if (loadingLoc) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={styles.loading}>Getting your location…</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <CustomHeader
        title="Birthing Center Locator"
        navigation={navigation}
        backButton
      />

      
      <View style={styles.searchWrapper}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search centers..."
          value={searchTerm}
          onChangeText={setSearchTerm}
        />
      </View>

    
      <Text style={styles.sectionTitle}>Your App’s Centers</Text>
      <FlatList
        data={filteredRegistered}
        keyExtractor={i => i.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No registered centers match your search.
          </Text>
        }
        renderItem={({ item }) => {
          const hasLoc =
            userLocation &&
            item.birthCenterLocation?.lat != null &&
            item.birthCenterLocation?.lng != null;

          const dist = hasLoc
            ? calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                item.birthCenterLocation.lat,
                item.birthCenterLocation.lng
              ).toFixed(2)
            : null;

          return (
            <TouchableOpacity
              style={styles.card}
              onPress={() =>
                navigation.navigate('DoctorsScreen', {
                  centerId: item.id,
                  centerName: item.birthCenterName,
                })
              }
            >
              <Text style={styles.cardTitle}>{item.birthCenterName}</Text>
              <Text style={styles.cardSubtitle}>{item.email}</Text>
              {hasLoc && <Text style={styles.cardSubtitle}>{dist} km</Text>}
              {hasLoc && (
                <Text
                  style={styles.cardLink}
                  onPress={() => openDirections(item.birthCenterLocation)}
                >
                  Directions →
                </Text>
              )}
            </TouchableOpacity>
          );
        }}
      />

    
      <Text style={styles.sectionTitle}>Centers Near You</Text>
      <FlatList
        data={filteredPlaces}
        keyExtractor={i => i.place_id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No nearby centers found.</Text>
        }
        renderItem={({ item }) => {
          const loc = item.geometry.location;
          const canShowDistance =
            userLocation && loc.lat != null && loc.lng != null;
          const dist = canShowDistance
            ? calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                loc.lat,
                loc.lng
              ).toFixed(2)
            : null;

          return (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>{item.name}</Text>
              <Text style={styles.cardSubtitle}>
                {item.vicinity || 'No address'}
              </Text>
              {canShowDistance && (
                <Text style={styles.cardSubtitle}>{dist} km</Text>
              )}
              <Text
                style={styles.cardLink}
                onPress={() => openDirections(loc)}
              >
                Directions →
              </Text>
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  loading: { marginTop: 8, color: theme.colors.subtext },

  searchWrapper: { margin: 16 },
  searchInput: {
    backgroundColor: '#fff',
    borderRadius: 25,
    paddingHorizontal: 20,
    paddingVertical: 10,
    fontSize: 16,
    elevation: 2,
  },

  sectionTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: theme.colors.primary,
    marginHorizontal: 16,
    marginTop: 16,
  },

  list: { paddingBottom: 20 },
  emptyText: {
    textAlign: 'center',
    color: theme.colors.subtext,
    marginTop: 20,
  },

  card: {
    backgroundColor: '#fff',
    marginHorizontal: 16,
    marginVertical: 8,
    padding: 16,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: theme.colors.text,
  },
  cardSubtitle: {
    fontSize: 14,
    color: theme.colors.subtext,
    marginVertical: 2,
  },
  cardLink: {
    marginTop: 8,
    fontSize: 14,
    color: theme.colors.primary,
    fontWeight: '600',
  },
});
