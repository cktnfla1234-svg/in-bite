import { initializeApp } from "firebase/app";
import { getMessaging, getToken, isSupported } from "firebase/messaging";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let initialized = false;

function hasFirebaseConfig() {
  return Boolean(firebaseConfig.apiKey && firebaseConfig.projectId && firebaseConfig.messagingSenderId && firebaseConfig.appId);
}

export async function getFcmDeviceToken(): Promise<string | null> {
  if (typeof window === "undefined" || !hasFirebaseConfig()) return null;
  if (!(await isSupported())) return null;

  if (!initialized) {
    initializeApp(firebaseConfig);
    initialized = true;
  }
  const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
  if (!vapidKey) return null;

  const permission = await Notification.requestPermission();
  if (permission !== "granted") return null;

  const messaging = getMessaging();
  const token = await getToken(messaging, { vapidKey });
  return token || null;
}
