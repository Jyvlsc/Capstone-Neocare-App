// component/Notifications.js

import * as Notifications from 'expo-notifications';
import * as Device       from 'expo-device';
import { Alert, Platform } from 'react-native';

// Show alerts/sounds even in foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert:   true,
    shouldPlaySound:   true,
    shouldSetBadge:    true,
  }),
});

export async function configureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }
}

export async function registerForPushNotificationsAsync() {
  // must be on a real device
  if (!Device.isDevice) {
    console.warn('Must use a physical device for Push Notifications');
    return null;
  }

  // ask for permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    Alert.alert('Permission required', 'Failed to get push token!');
    return null;
  }

  // *** THIS IS THE CHANGE ***
  // get the **FCM device token** (not the Expo token)
  const { data: token } = await Notifications.getExpoPushTokenAsync();
  console.log('🔥 FCM token:', token);
  return token;
}

export function listenForNotifications(onReceive) {
  // will fire when user taps a notification or it arrives in background
  return Notifications.addNotificationResponseReceivedListener(response => {
    onReceive(response.notification.request.content.data);
  });
}
