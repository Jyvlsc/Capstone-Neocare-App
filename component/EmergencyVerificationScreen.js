import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Alert,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { getAuth, createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import axios from 'axios';

export default function EmergencyVerificationScreen({ route, navigation }) {
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const auth = getAuth();

  const SERVER = 'http://172.16.201.190:3000';

  const {
    firstName,
    lastName,
    email,
    password,
    lastMenstruationDate,
    emergencyNumber,
  } = route.params;

  const handleVerify = async () => {
    if (!otp.trim()) {
      Alert.alert('Missing Code', 'Please enter the verification code.');
      return;
    }

    setLoading(true);
    try {
      // Step 1: Verify OTP
      const res = await axios.post(`${SERVER}/verify-otp`, {
        phoneNumber: emergencyNumber,
        code: otp,
      });

      if (!res.data.verified) {
        throw new Error('OTP verification failed.');
      }

      // Step 2: Create Firebase Auth Account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // Step 3: Save user info in Firestore
      const userData = {
        userId: user.uid,
        fullName: `${firstName} ${lastName}`,
        email,
        emergencyNumber,
        createdAt: new Date().toISOString(),
      };

      // Safely add lastMenstruationDate
      if (lastMenstruationDate) {
        userData.lastMenstruationDate = lastMenstruationDate;
      }

      await setDoc(doc(db, 'users', user.uid), userData);

      Alert.alert('Success', 'Account created successfully!');
      navigation.navigate('Login');
    } catch (err) {
      console.error('Registration error:', err.response?.data || err.message);
      let msg = err.message;
      if (err.code === 'auth/email-already-in-use') {
        msg = 'Email is already in use.';
      } else if (err.code === 'auth/weak-password') {
        msg = 'Password is too weak.';
      } else if (err.code === 'auth/invalid-email') {
        msg = 'Invalid email address.';
      }
      Alert.alert('Error', msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Your Number</Text>
      <Text style={styles.subtitle}>
        A verification code was sent to: {emergencyNumber}
      </Text>

      <TextInput
        style={styles.input}
        placeholder="Enter Verification Code"
        keyboardType="numeric"
        value={otp}
        onChangeText={setOtp}
      />

      <TouchableOpacity style={styles.button} onPress={handleVerify} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>Verify & Register</Text>
        )}
      </TouchableOpacity>

      <TouchableOpacity onPress={() => navigation.goBack()}>
        <Text style={styles.link}>Go Back to Register</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', backgroundColor: '#FFF4E6' },
  title: { fontSize: 28, fontWeight: 'bold', textAlign: 'center', marginBottom: 10, color: '#D47FA6' },
  subtitle: { fontSize: 16, textAlign: 'center', marginBottom: 20, color: '#A9A9A9' },
  input: {
    borderWidth: 1,
    borderColor: '#D47FA6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 20,
    backgroundColor: '#fff',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#FF6F61',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 15,
  },
  buttonText: { color: '#fff', fontWeight: 'bold', fontSize: 16 },
  link: { color: '#FF6F61', textAlign: 'center', fontSize: 14 },
});