import * as Notifications from 'expo-notifications';
import * as Device       from 'expo-device';
import { Platform }      from 'react-native';

export async function configureAndroidChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'Default',
      importance: Notifications.AndroidImportance.HIGH,
    });
  }
}

export async function registerForPushNotificationsAsync() {
  if (!Device.isDevice) {
    console.warn('Must use physical device for Push Notifications');
    return null;
  }
  const { status: existing } = await Notifications.getPermissionsAsync();
  let finalStatus = existing;
  if (existing !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }
  if (finalStatus !== 'granted') {
    console.warn('Notification permissions not granted!');
    return null;
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync()();
  return token;
}

export function listenForNotifications(callback) {
  const sub = Notifications.addNotificationResponseReceivedListener(response => {
    callback(response.notification.request.content.data);
  });
  return sub;
}
