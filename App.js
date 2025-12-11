import 'react-native-reanimated';
import 'react-native-get-random-values';
import React, { useEffect } from 'react';
import { StyleSheet, Alert, Platform } from 'react-native';
import { NavigationContainer, useNavigationContainerRef } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { getAuth } from 'firebase/auth';
import * as Notifications from "expo-notifications";
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import Ionicons from 'react-native-vector-icons/Ionicons';
import GetStarted from './component/GetStarted';
import Dashboard from './component/Dashboard';
import BookingsScreen from './component/BookingsScreen';
import MessageScreen from './component/MessageScreen';
import ProfileScreen from './component/ProfileScreen';
import AssessmentScreen from './component/AssessmentScreen';
import RegisterScreen from './component/RegisterScreen';
import LoginScreen from './component/LoginScreen';
import Forgetpass from "./component/Forgetpass";
import MoodDetail from './component/MoodDetail';
import BirthingCenterLocator from './component/BirthingCenterLocator';
import ConsultantScreen from './component/ConsultantScreen';
import ConsultantDetailScreen from './component/ConsultantDetailScreen';
import ChatScreen from './component/ChatScreen';
import AppointmentScreen from './component/AppointmentScreen';
import Tracker from './component/Tracker';
import ChatBotScreen from './component/ChatBotScreen';
import DoctorsScreen from './component/DoctorsScreen';
import EmergencyVerificationScreen from './component/EmergencyVerificationScreen';


import {
  registerForPushNotificationsAsync,
  listenForNotifications,
  configureAndroidChannel
} from './component/Notifications';

const Stack = createStackNavigator();
const Tab   = createBottomTabNavigator();

const AnimatedIoniconsComponent = Animated.createAnimatedComponent(Ionicons);

function AnimatedTabIcon({ name, focused, size, color }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: focused ? withSpring(1.2) : withSpring(1) }],
  }));
  return <AnimatedIoniconsComponent name={name} size={size} color={color} style={style} />;
}

function HomeTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, color, size }) => { 
          let iconName = '';
          switch (route.name) {
            case 'Home':         iconName = focused ? 'home'           : 'home-outline'; break;
            case 'Appointments': iconName = focused ? 'book'           : 'book-outline'; break;
            case 'Message':      iconName = focused ? 'chatbubbles'    : 'chatbubbles-outline'; break;
            case 'Profile':      iconName = focused ? 'person'         : 'person-outline'; break;
          }
          return (
            <AnimatedTabIcon
              name={iconName}
              size={size}
              color={color}
              focused={focused}
            />
          );
        },
        tabBarActiveTintColor:   '#D47FA6',
        tabBarInactiveTintColor: '#888',
        tabBarLabelStyle:        { fontSize: 12, marginBottom: 2 },
        headerShown:             false,
        tabBarStyle: {
          position:        'absolute',
          bottom:          16,
          left:            16,
          right:           16,
          height:          60,
          backgroundColor: '#fff',
          borderRadius:    12,
          elevation:       10,
          shadowColor:     '#000',
          shadowOffset:    { width: 0, height: 4 },
          shadowOpacity:   0.3,
          shadowRadius:    5,
          paddingVertical: 8,
        },
      })}
    >
      <Tab.Screen name="Home"         component={Dashboard} />
      <Tab.Screen name="Appointments" component={BookingsScreen} />
      <Tab.Screen name="Message"      component={MessageScreen} />
      <Tab.Screen name="Profile"      component={ProfileScreen} />
    </Tab.Navigator>
  );
}

export default function App() {
  const navigationRef = useNavigationContainerRef();
    

  useEffect(() => {
   
    
    // 1️⃣ Create Android notification channel
    configureAndroidChannel();

    // 2️⃣ Register for FCM and send to your backend
    registerForPushNotificationsAsync()
      .then(fcmToken => {
        console.log('🔥 FCM token:', fcmToken);
        if (!fcmToken) return;
        const user = getAuth().currentUser;
        if (!user) return;
        fetch('https://172.16.201.190/api/users/fcm-token', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({
            userId:   user.uid,
            fcmToken: fcmToken
          }),
        }).catch(err => console.error('Failed to save FCM token:', err));
      })
      .catch(err => console.error('Push registration failed:', err));

    // 3️⃣ Listen for notification interactions
    const subscription = listenForNotifications(data => {
      if (data.type === 'APPOINTMENT_ACCEPTED') {
        Alert.alert('Appointment Accepted', 'Your appointment has been accepted.');
        navigationRef.navigate('HomeTabs', { screen: 'Appointments' });
      } else if (data.type === 'NEW_MESSAGE') {
        Alert.alert('New Message', 'You have a new message!');
        navigationRef.navigate('HomeTabs', { screen: 'Message' });
      }
    });

    return () => subscription.remove();
  }, []);

  return (
    <NavigationContainer ref={navigationRef}>
      <Stack.Navigator initialRouteName="Login" screenOptions={{ headerShown: false }}>
        <Stack.Screen name="GetStarted"            component={GetStarted} />
        <Stack.Screen name="HomeTabs"              component={HomeTabs} />
        <Stack.Screen name="Assessment"            component={AssessmentScreen} />
        <Stack.Screen name="Register"              component={RegisterScreen} />
        <Stack.Screen name="Forgetpass"             component={Forgetpass} />
        <Stack.Screen name="EmergencyVerification" component={EmergencyVerificationScreen} />
        <Stack.Screen name="Login"                 component={LoginScreen} />
        <Stack.Screen name="MoodDetail"            component={MoodDetail} />
        <Stack.Screen name="BirthingCenterLocator" component={BirthingCenterLocator} />
        <Stack.Screen name="ConsultantScreen"      component={ConsultantScreen} />
        <Stack.Screen name="ConsultantDetail"      component={ConsultantDetailScreen} />
        <Stack.Screen name="Chat"                  component={ChatScreen} />
        <Stack.Screen
          name="AppointmentScreen"
          component={AppointmentScreen}
          options={{
            headerShown:   true,
            title:         'Book Appointment',
            headerStyle:   { backgroundColor: '#FFF4E6' },
            headerTintColor: '#D47FA6',
          }}
        />
        <Stack.Screen name="Bookings"              component={BookingsScreen} options={{ title: 'My Bookings' }} />
        <Stack.Screen name="Tracker"               component={Tracker} options={{ title: 'Pregnancy Tracker' }} />
        <Stack.Screen name="ChatBot"               component={ChatBotScreen} options={{ title: 'Chat Bot' }} />
        <Stack.Screen name="DoctorsScreen"         component={DoctorsScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  // add any styles here if needed
});