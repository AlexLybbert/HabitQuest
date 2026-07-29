import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

/**
 * Firebase project configuration.
 * Values are read from environment variables defined in `.env.local`.
 * Copy `.env.example` → `.env.local` and fill in your project's values.
 *
 * To get these values:
 *   Firebase Console → Project Settings → General → Your apps → Web app
 */
const envFirebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY as string,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN as string,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID as string,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET as string,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID as string,
  appId: import.meta.env.VITE_FIREBASE_APP_ID as string,
};

export const LOCAL_DEMO_USER_ID = 'local-demo-user';

export const firebaseConfigured = Object.values(envFirebaseConfig).every((value) => {
  return typeof value === 'string'
    && value.trim().length > 0
    && !value.trim().toLowerCase().startsWith('your-');
});

let localDemoMode = import.meta.env.VITE_USE_LOCAL_DEMO === 'true' || !firebaseConfigured;

export function useLocalDemoData(): boolean {
  return localDemoMode;
}

export function enableLocalDemoData(): void {
  localDemoMode = true;
}

const demoFirebaseConfig = {
  apiKey: 'demo-api-key',
  authDomain: 'demo.firebaseapp.com',
  projectId: 'demo',
  storageBucket: 'demo.appspot.com',
  messagingSenderId: '000000000000',
  appId: '1:000000000000:web:0000000000000000000000',
};

const firebaseConfig = localDemoMode ? demoFirebaseConfig : envFirebaseConfig;

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
