import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Platform,
  ScrollView,
} from 'react-native';
import {
  getAuth,
  createUserWithEmailAndPassword,
  fetchSignInMethodsForEmail,
} from 'firebase/auth';
import { collection, doc, setDoc } from 'firebase/firestore';
import { db } from '../firebaseConfig';
import app from '../firebaseConfig';
import DateTimePicker from '@react-native-community/datetimepicker';
import axios from 'axios';
import { useNavigation } from '@react-navigation/native';

const SERVER = 'http://172.16.201.190:3000';

const RegisterScreen = () => {
  const navigation = useNavigation();
  const auth = getAuth();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [lastMenstruationDate, setLastMenstruationDate] = useState(new Date());
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [emergencyNumber, setEmergencyNumber] = useState('');
  const [showDatePicker, setShowDatePicker] = useState(false);

  // ✅ Valid PH phone numbers
  const validPH = (num) =>
    /^09\d{9}$/.test(num) ||
    /^639\d{9}$/.test(num) ||
    /^\+639\d{9}$/.test(num);

  // ✅ Normalize PH number format
  const normalize = (num) => {
    if (num.startsWith('+')) return num.slice(1);
    if (num.startsWith('09')) return '63' + num.slice(1);
    return num;
  };

  // ✅ Validate input fields
  const validateForm = () => {
    if (!firstName.trim() || !lastName.trim()) {
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
    if (lastMenstruationDate >= new Date()) {
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

  // ✅ Register User
  const handleRegister = async () => {
    if (!validateForm()) return;
    const formattedNumber = normalize(emergencyNumber);

    try {
      const { user } = await createUserWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      await setDoc(doc(db, 'users', user.uid), {
        userId: user.uid,
        fullName: `${firstName.trim()} ${lastName.trim()}`,
        email: email.trim(),
        lastMenstruationDate: lastMenstruationDate.toISOString().split('T')[0],
        emergencyNumber: formattedNumber,
      });

      Alert.alert('Success', 'Registered successfully!');
      navigation.navigate('Login');
    } catch (error) {
      console.error('Registration Error:', error);
      Alert.alert('Registration Error', error.message);
    }
  };

  // ✅ Send OTP
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
    <ScrollView contentContainerStyle={styles.scroll}>
      <View style={styles.container}>
        <Text style={styles.title}>Welcome, Mom-to-Be!</Text>
        <Text style={styles.subtitle}>Create Your Account</Text>

        <View style={styles.card}>
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
            Please select the first day of your last menstruation.
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
            <Text style={styles.link}>Already have an Account? Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  scroll: {
    flexGrow: 1,
    backgroundColor: '#FFF4E6',
  },
  container: {
    flex: 1,
    padding: 20,
    justifyContent: 'center',
  },
  card: {
    backgroundColor: '#fff',
    padding: 20,
    borderRadius: 16,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 6,
    elevation: 4,
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
    color: '#666',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D47FA6',
    borderRadius: 10,
    padding: 12,
    marginBottom: 15,
    backgroundColor: '#fff',
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
    fontWeight: '600',
    fontSize: 16,
  },
  button: {
    backgroundColor: '#FF6F61',
    padding: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 16,
  },
  link: {
    color: '#FF6F61',
    textAlign: 'center',
    marginTop: 15,
    fontSize: 14,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333',
    marginBottom: 5,
  },
  hint: {
    fontSize: 13,
    color: '#888',
    marginBottom: 10,
  },
});

export default RegisterScreen;
