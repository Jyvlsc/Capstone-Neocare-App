import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { getAuth, signOut } from 'firebase/auth';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';

const ProfileScreen = ({ navigation }) => {
  const auth = getAuth();
  const user = auth.currentUser;

  const [fullName, setFullName] = useState('');
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
            // Handle lastMenstruationDate
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

  const handleUpdateProfile = async () => {
    if (!user) return;
    setUpdating(true);
    try {
      const userDocRef = doc(db, 'users', user.uid);
      await updateDoc(userDocRef, {
        fullName: fullName,
        lastMenstruationDate: lastMenstruationDate, // Include last menstruation date
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
        <Text style={styles.label}>Email:</Text>
        <Text style={styles.info}>{user.email}</Text>
        <Text style={styles.label}>Full Name:</Text>
        <TextInput
          style={styles.input}
          value={fullName}
          onChangeText={setFullName}
          placeholder="Enter your full name"
          placeholderTextColor="#aaa"
        />
        <Text style={styles.label}>Last Menstruation Date:</Text>
        <TouchableOpacity
          style={styles.dateButton}
          onPress={() => setShowDatePicker(true)}
        >
          <Text style={styles.dateButtonText}>
            {lastMenstruationDate ? lastMenstruationDate.toLocaleDateString() : 'Select Date'}
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
    borderRadius: 12,
    padding: 20,
    elevation: 3,
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    color: '#D47FA6',
    fontWeight: 'bold',
    marginBottom: 20,
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
  logoutButton: {
    marginTop: 10,
  },
  logoutButtonText: {
    color: '#FF6F61',
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