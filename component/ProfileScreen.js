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
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getAuth, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';

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

            if (data.lastMenstruationDate?.toDate) {
              setLastMenstruationDate(data.lastMenstruationDate.toDate());
            } else if (data.lastMenstruationDate?.seconds) {
              setLastMenstruationDate(
                new Date(data.lastMenstruationDate.seconds * 1000)
              );
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

  const pickImage = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
     mediaTypes: [ImagePicker.MediaType.all],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });

    if (!result.canceled) {
      setProfilePhoto(result.assets[0].uri);
    }
  };

  const uploadImage = async (uri) => {
    if (!uri) return null;
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const storageRef = ref(storage, `profilePhotos/${user.uid}.jpg`);
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

      // If it's a local file URI, upload first
      if (profilePhoto && profilePhoto.startsWith('file')) {
        photoURL = await uploadImage(profilePhoto);
      }

      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        fullName,
        lastMenstruationDate,
        profilePhoto: photoURL || null,
      });

      alert('Profile updated successfully!');
    } catch (error) {
      console.error('Profile update error:', error);
      alert('Error updating profile.');
    } finally {
      setUpdating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut(auth);
      navigation.navigate('Login');
    } catch (error) {
      console.error('Sign out error:', error);
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
      <View style={styles.profileContainer}>
        <Text style={styles.title}>My Profile</Text>

        {/* Profile Photo */}
        <TouchableOpacity onPress={pickImage} style={styles.photoWrapper}>
          <Image
            source={
              profilePhoto
                ? { uri: profilePhoto }
                : require('../assets/default-avatar.png')
            }
            style={styles.profilePhoto}
          />
          <Text style={styles.changePhotoText}>Change Photo</Text>
        </TouchableOpacity>

        {/* Email */}
        <Text style={styles.label}>Email:</Text>
        <Text style={styles.info}>{user.email}</Text>

        {/* Full Name */}
        <Text style={styles.label}>Full Name:</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
          placeholderTextColor="#aaa"
        />

        {/* Last Menstruation Date */}
        <Text style={styles.label}>Last Menstruation Date:</Text>
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

        {/* Update Button */}
        <TouchableOpacity
          style={[styles.button, updating && styles.buttonDisabled]}
          onPress={handleUpdateProfile}
          disabled={updating}
        >
          {updating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonText}>Update Profile</Text>
          )}
        </TouchableOpacity>

        {/* Logout Button */}
        <TouchableOpacity style={styles.logoutButton} onPress={handleSignOut}>
          <Text style={styles.logoutButtonText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF4E6',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  profileContainer: {
    width: '100%',
    backgroundColor: '#fff',
    borderRadius: 15,
    padding: 20,
    elevation: 4,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    color: '#D47FA6',
    fontWeight: 'bold',
    marginBottom: 20,
  },
  photoWrapper: {
    alignItems: 'center',
    marginBottom: 20,
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
  label: {
    fontSize: 18,
    color: '#333',
    alignSelf: 'flex-start',
    marginBottom: 5,
  },
  info: {
    fontSize: 16,
    color: '#666',
    alignSelf: 'flex-start',
    marginBottom: 15,
  },
  input: {
    width: '100%',
    borderWidth: 1,
    borderColor: '#D47FA6',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    backgroundColor: '#fff',
    color: '#333',
  },
  dateButton: {
    backgroundColor: '#D47FA6',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
    width: '100%',
  },
  dateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  button: {
    width: '100%',
    backgroundColor: '#FF6F61',
    paddingVertical: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonDisabled: {
    backgroundColor: '#a88aa8',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: 'bold',
    fontSize: 16,
  },
 logoutBtn: {
  width: '100%',
  backgroundColor: '#FF6F61',
  paddingVertical: 15,
  borderRadius: 10,
  alignItems: 'center',
  marginTop: 15,
  elevation: 3, // shadow for Android
  shadowColor: '#000', // shadow for iOS
  shadowOffset: { width: 0, height: 2 },
  shadowOpacity: 0.2,
  shadowRadius: 3,
},
logoutBtnText: {
  color: '#fff',
  fontSize: 16,
  fontWeight: 'bold',
},
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFF4E6',
  },
});

export default ProfileScreen;
