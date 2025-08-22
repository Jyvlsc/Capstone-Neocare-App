import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, Platform } from 'react-native';
import { getAuth, createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig'; // Ensure you have this import
import app from '../firebaseConfig'; // Ensure this import is correct
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios'; // NEW: Import axios
import { useNavigation } from '@react-navigation/native'; // NEW: Import useNavigation

const SERVER = 'http://172.16.201.190:3000'; // NEW: Define server URL

const RegisterScreen = () => {
  const navigation = useNavigation(); // NEW: Use navigation
  const [firstName, setFirstName] = useState(''); // NEW: State for first name
  const [lastName, setLastName] = useState(''); // NEW: State for last name
  const [lastMenstruationDate, setLastMenstruationDate] = useState(new Date()); // NEW: State for last menstruation date
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // NEW: emergency contact
  const [emergencyNumber, setEmergencyNumber] = useState('');

  const auth = getAuth(); // Pass the app instance here

  // Valid PH: 09XXXXXXXXX, 639XXXXXXXXX, or +639XXXXXXXXX
  const validPH = (num) => {
    return (
      /^09\d{9}$/.test(num) ||
      /^639\d{9}$/.test(num) ||
      /^\+639\d{9}$/.test(num)
    );
  };

  // Normalize to "639XXXXXXXXX" (no leading "+")
  const normalize = (num) => {
    if (num.startsWith('+')) {
      return num.slice(1);         // +639xxxxxxxx -> 639xxxxxxxx
    }
    if (num.startsWith('09')) {
      return '63' + num.slice(1);  // 09xxxxxxxxx -> 63xxxxxxxxx
    }
    return num;                    // already 639xxxxxxxxx
  };

  const validateForm = () => {
    if (!firstName.trim() || !lastName.trim()) { // Check for first and last name
      Alert.alert('Missing Name', 'Please enter your first and last name.');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return false;
    }
    if (password.length < 8) {
      Alert.alert('Weak Password', 'Password must be at least 8 characters.');
      return false;
    }
    if (password !== confirmPassword) {
      Alert.alert('Password Mismatch', 'Passwords do not match.');
      return false;
    }
    if (lastMenstruationDate >= new Date()) { // UPDATED: Check for last menstruation date
      Alert.alert('Invalid Date', 'Last menstruation must be in the past.');
      return false;
    }
    if (!validPH(emergencyNumber)) {
      Alert.alert(
        'Invalid Number',
        'Enter PH number as 09xxxxxxxxx, 639xxxxxxxxx, or +639xxxxxxxxx.'
      );
      return false;
    }
    return true;
  };

  const handleRegister = async () => {
    if (!validateForm()) return;

    const formattedNumber = normalize(emergencyNumber);

    try {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      // Store user information in Firestore with UID as document ID
      await setDoc(doc(db, 'users', user.uid), {
        userId: user.uid,
        fullName: fullName.trim(),
        email: email.trim(),
        lastMenstruationDate: lastMenstruationDate.toISOString().split('T')[0],
        emergencyNumber: formattedNumber
      });

      Alert.alert('Success', 'Registered successfully!');
      navigation.navigate('Login'); // Navigate to Login screen
    } catch (error) {
      console.error('Registration Error:', error);
      Alert.alert('Registration Error', error.message);
    }
  };

  const handleSendOTP = async () => {
    if (!validateForm()) return;
    const formattedNumber = normalize(emergencyNumber);

    try {
      const methods = await fetchSignInMethodsForEmail(auth, email);
      if (methods.length > 0) {
        Alert.alert('Email Taken', 'Please use a different email.', [
          { text: 'Cancel' },
          { text: 'Login Instead', onPress: () => navigation.navigate('Login') },
        ]);
        return;
      }

      await axios.post(`${SERVER}/send-otp`, { phoneNumber: formattedNumber });

      navigation.navigate('EmergencyVerification', {
        firstName,
        lastName,
        email,
        password,
        lastMenstruationDate: lastMenstruationDate.toISOString().split('T')[0],
        emergencyNumber: formattedNumber,
      });
    } catch (err) {
      console.error('OTP Error:', err.response?.data || err.message);
      Alert.alert('Error', 'Could not send OTP.');
    }
  };

  const onChangeLastMenstruationDate = (event, selected) => {
    setShowDatePicker(Platform.OS === 'ios');
    if (selected) setLastMenstruationDate(selected);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome, Mom-to-Be!</Text>
      <Text style={styles.subtitle}>Create Your Account</Text>
      <TextInput
        style={styles.input}
        placeholder="First Name"
        value={firstName}
        onChangeText={setFirstName}
      />
      <TextInput
        style={styles.input}
        placeholder="Last Name"
        value={lastName}
        onChangeText={setLastName}
      />
      <TextInput
        style={styles.input}
        placeholder="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <TextInput
        style={styles.input}
        placeholder="Confirm Password"
        secureTextEntry
        value={confirmPassword}
        onChangeText={setConfirmPassword}
      />
      
      <Text style={styles.label}>Last Menstruation Date</Text>
      <Text style={styles.hint}>
        This will help estimate your current pregnancy stage. Please enter the first day of your last menstruation.
      </Text>
      <TouchableOpacity 
        style={styles.dateButton} 
        onPress={() => setShowDatePicker(true)}
      >
        <Text style={styles.dateButtonText}>
          {lastMenstruationDate.toLocaleDateString()}
        </Text>
      </TouchableOpacity>
      
      {showDatePicker && (
        <DateTimePicker
          value={lastMenstruationDate}
          mode="date"
          display="default"
          onChange={onChangeLastMenstruationDate}
          maximumDate={new Date()}
        />
      )}
      
      <TextInput
        style={styles.input}
        placeholder="Emergency Contact Number"
        keyboardType="phone-pad"
        value={emergencyNumber}
        onChangeText={setEmergencyNumber}
      />
      
      <TouchableOpacity style={styles.button} onPress={handleSendOTP}>
        <Text style={styles.buttonText}>Send OTP & Continue</Text>
      </TouchableOpacity>
      
      <TouchableOpacity onPress={() => navigation.navigate('Login')}>
        <Text style={styles.link}>Already have an Account?</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    padding: 20,
    backgroundColor: '#FFF4E6',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
    textAlign: 'center',
    color: '#D47FA6',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#A9A9A9',
  },
  input: {
    borderBottomWidth: 1,
    borderColor: '#D47FA6',
    padding: 10,
    marginBottom: 20,
  },
  dateButton: {
    backgroundColor: '#D47FA6',
    padding: 12,
    borderRadius: 10,
    marginBottom: 20,
    alignItems: 'center',
  },
  dateButtonText: {
    color: '#fff',
    fontWeight: 'bold',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#FF6F61',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 20,
  },
  buttonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
  link: {
    color: '#FF6F61',
    textAlign: 'center',
    marginTop: 10,
  },
  label: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 5,
  },
  hint: {
    fontSize: 14,
    color: '#888',
    marginBottom: 10,
  },
});

export default RegisterScreen;