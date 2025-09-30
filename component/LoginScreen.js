import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';

const LoginScreen = ({ navigation }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setErrorMessage(null);
    setLoading(true);

    try {
      if (!email) {
        setErrorMessage('Email is required.');
        setLoading(false);
        return;
      }
      if (!email.includes('@')) {
        setErrorMessage('Please enter a valid email address.');
        setLoading(false);
        return;
      }
      if (!password) {
        setErrorMessage('Password is required.');
        setLoading(false);
        return;
      }

      const auth = getAuth();
      await signInWithEmailAndPassword(auth, email, password);
      navigation.navigate('GetStarted');
    } catch (error) {
      switch (error.code) {
        case 'auth/invalid-email':
          setErrorMessage('The email address is not valid.');
          break;
        case 'auth/user-not-found':
          setErrorMessage('No account found with this email.');
          break;
        case 'auth/wrong-password':
          setErrorMessage('Incorrect password. Please try again.');
          break;
        default:
          setErrorMessage('Login failed. Please try again.');
          break;
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={['#FFE4F3', '#FFF4E6']} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.card}>
          <Text style={styles.title}>Welcome Back 👋</Text>
          <Text style={styles.subtitle}>Sign in to continue</Text>

          {errorMessage && <Text style={styles.errorText}>{errorMessage}</Text>}

          <TextInput
            style={styles.input}
            placeholder="Email"
            placeholderTextColor="#aaa"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
          />
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#aaa"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
          />

          <TouchableOpacity onPress={() => navigation.navigate('Forgetpass')}>
            <Text style={styles.forgotText}>Forgot Password?</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Login</Text>
            )}
          </TouchableOpacity>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.dividerText}>or</Text>
            <View style={styles.line} />
          </View>

          <TouchableOpacity onPress={() => navigation.navigate('Register')}>
            <Text style={styles.link}>Don’t have an account? <Text style={{ fontWeight: 'bold', color: '#D47FA6' }}>Sign Up</Text></Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: 'rgba(255,255,255,0.95)',
    borderRadius: 20,
    padding: 25,
    shadowColor: '#000',
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 6,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 5,
    textAlign: 'center',
    color: '#D47FA6',
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 20,
    textAlign: 'center',
    color: '#7D7D7D',
  },
  errorText: {
    color: '#FF4D4D',
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E5E5',
    borderRadius: 12,
    padding: 15,
    marginBottom: 15,
    backgroundColor: '#fff',
    color: '#333',
    fontSize: 15,
  },
  button: {
    backgroundColor: '#D47FA6',
    paddingVertical: 15,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: 20,
    shadowColor: '#D47FA6',
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 4,
  },
  buttonDisabled: {
    backgroundColor: '#a88aa8',
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 15,
  },
  line: {
    flex: 1,
    height: 1,
    backgroundColor: '#ddd',
  },
  dividerText: {
    marginHorizontal: 10,
    color: '#7D7D7D',
  },
  link: {
    color: '#555',
    textAlign: 'center',
    fontSize: 14,
  },
  forgotText: {
    color: '#007AFF',
    alignSelf: 'flex-end',
    marginBottom: 15,
  },
});

export default LoginScreen;
