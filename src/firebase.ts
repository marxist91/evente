import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer, setDoc } from 'firebase/firestore';
import { getMessaging, getToken } from 'firebase/messaging';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

export async function requestNotificationPermission(uid: string, city: string) {
  if (!messaging) return;

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'BD_S_YOUR_VAPID_KEY_HERE' // This usually needs a VAPID key from Firebase Console
      });

      if (token) {
        const tokenRef = doc(db, 'users', uid, 'fcmTokens', token);
        await setDoc(tokenRef, {
          token,
          city,
          createdAt: new Date().toISOString()
        });
        console.log('FCM Token stored successfully');
      }
    }
  } catch (error) {
    console.error('Error requesting notification permission:', error);
  }
}

// Test connection
async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration.");
    }
  }
}
testConnection();
