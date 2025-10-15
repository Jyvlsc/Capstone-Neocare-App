import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
  Image,
  Alert,
  ScrollView,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getAuth } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { LinearGradient } from 'expo-linear-gradient';

const ProfileScreen = ({ navigation }) => {
  const auth = getAuth();
  const user = auth.currentUser;
  const storage = getStorage();

  const [fullName, setFullName] = useState('');
  const [profilePhoto, setProfilePhoto] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [lastMenstruationDate, setLastMenstruationDate] = useState(new Date());
  const [oldPhotoUrl, setOldPhotoUrl] = useState(null);

  useEffect(() => {
    if (user) {
      const fetchProfile = async () => {
        try {
          const userDocRef = doc(db, 'users', user.uid);
          const docSnap = await getDoc(userDocRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setFullName(data.fullName || '');
            setProfilePhoto(data.profilePhoto || null);
            setOldPhotoUrl(data.profilePhoto || null);
            if (data.lastMenstruationDate?.toDate) {
              setLastMenstruationDate(data.lastMenstruationDate.toDate());
            } else if (data.lastMenstruationDate?.seconds) {
              setLastMenstruationDate(new Date(data.lastMenstruationDate.seconds * 1000));
            }
          }
        } catch (error) {
          console.error('Error fetching profile:', error);
        } finally {
          setLoading(false);
        }
      };
      fetchProfile();
    } else {
      setLoading(false);
    }
  }, [user]);

  const handleChoosePhoto = () => {
    Alert.alert('Select Photo', 'Choose an option:', [
      { text: 'Camera', onPress: openCamera },
      { text: 'Gallery', onPress: openGallery },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  const openGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'You need to allow gallery access.');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const openCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Denied', 'You need to allow camera access.');
      return;
    }

    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (!result.canceled) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri, oldUrl) => {
    if (!uri) return null;
    try {
      if (oldUrl) {
        try {
          const match = oldUrl.match(/\/o\/(.*?)\?/);
          if (match && match[1]) {
            const filePath = decodeURIComponent(match[1]);
            await deleteObject(ref(storage, filePath));
          }
        } catch (err) {
          console.warn('Old photo not found or already deleted.');
        }
      }

      const response = await fetch(uri);
      const blob = await response.blob();
      const uniqueId = Date.now();
      const storageRef = ref(storage, `profilePhotos/${user.uid}_${uniqueId}.jpg`);
      await uploadBytes(storageRef, blob);
      const downloadURL = await getDownloadURL(storageRef);

      return downloadURL;
    } catch (error) {
      console.error('Upload image error:', error);
      return null;
    }
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    setUpdating(true);
    try {
      let photoURL = profilePhoto;
      if (profilePhoto && profilePhoto.startsWith('file')) {
        photoURL = await uploadImage(profilePhoto, oldPhotoUrl);
      }

      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        fullName,
        lastMenstruationDate,
        profilePhoto: photoURL || null,
      });

      setOldPhotoUrl(photoURL);
      Alert.alert('Success', 'Profile updated successfully!');
    } catch (error) {
      console.error('Profile update error:', error);
      Alert.alert('Error', 'There was a problem updating your profile.');
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.loadingContainer}>
        <ActivityIndicator size="large" color="#D47FA6" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={['#D47FA6', '#FF6F61']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.header}
        >
          <Text style={styles.headerTitle}>My Profile</Text>
        </LinearGradient>

        <View style={styles.card}>
          <TouchableOpacity onPress={handleChoosePhoto} style={styles.photoWrapper}>
            <Image
              source={profilePhoto ? { uri: profilePhoto } : require('../assets/default-avatar.png')}
              style={styles.profilePhoto}
            />
            <Text style={styles.changePhotoText}>Change Photo</Text>
          </TouchableOpacity>

          <View style={styles.infoSection}>
            <Text style={styles.label}>Email</Text>
            <Text style={styles.info}>{user.email}</Text>

            <Text style={styles.label}>Full Name</Text>
            <TextInput
              style={styles.input}
              value={fullName}
              onChangeText={setFullName}
              placeholder="Enter your full name"
              placeholderTextColor="#aaa"
            />

            <Text style={styles.label}>Last Menstruation Date</Text>
            <TouchableOpacity
              style={styles.dateButton}
              onPress={() => setShowDatePicker(true)}
            >
              <Text style={styles.dateButtonText}>
                {lastMenstruationDate
                  ? lastMenstruationDate.toLocaleDateString()
                  : 'Select Date'}
              </Text>
            </TouchableOpacity>

            {showDatePicker && (
              <DateTimePicker
                value={lastMenstruationDate || new Date()}
                mode="date"
                display="default"
                onChange={(event, selected) => {
                  if (selected) setLastMenstruationDate(selected);
                  setShowDatePicker(false);
                }}
                maximumDate={new Date()}
              />
            )}

            <TouchableOpacity
              style={[styles.updateButton, updating && styles.buttonDisabled]}
              onPress={handleUpdateProfile}
              disabled={updating}
            >
              <LinearGradient
                colors={['#FF6F61', '#D47FA6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.updateButtonGradient}
              >
                {updating ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.updateButtonText}>Update Profile</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF8F0' },
  header: {
    height: 140,
    justifyContent: 'flex-end',
    padding: 20,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
    elevation: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 10,
  },
  card: {
    marginTop: -60,
    marginHorizontal: 20,
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 25,
    paddingHorizontal: 20,
    elevation: 6,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
  },
  photoWrapper: {
    alignItems: 'center',
    marginBottom: 15,
  },
  profilePhoto: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#D47FA6',
  },
  changePhotoText: {
    marginTop: 8,
    fontSize: 14,
    color: '#FF6F61',
    fontWeight: '600',
  },
  infoSection: { marginTop: 10 },
  label: {
    fontSize: 16,
    color: '#555',
    fontWeight: '600',
    marginTop: 10,
  },
  info: {
    fontSize: 15,
    color: '#777',
    marginBottom: 8,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#D47FA6',
    borderRadius: 12,
    padding: 12,
    backgroundColor: '#fff',
    marginBottom: 10,
    elevation: 2,
  },
  dateButton: {
    backgroundColor: '#D47FA6',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
  },
  dateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  updateButton: {
    width: '100%',
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 15,
  },
  updateButtonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
    borderRadius: 12,
  },
  updateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF4E6',
  },
});

export default ProfileScreen;
