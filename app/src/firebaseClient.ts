import { getApp, getApps, initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously, User } from 'firebase/auth';
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore';
import {firestoreTransport} from './firestoreTransport';

const firebaseConfig = {
  apiKey: 'AIzaSyAh623-RLDVDkBWFQp6X-F1xBeNi8tLu2Y',
  authDomain: 'kreditjatek-a644e.firebaseapp.com',
  projectId: 'kreditjatek-a644e',
  storageBucket: 'kreditjatek-a644e.firebasestorage.app',
  messagingSenderId: '136070394488',
  appId: '1:136070394488:web:1d3f2187ac3acd0efab38d',
};

const useEmulator = import.meta.env?.MODE === 'emulator';
const app = getApps().length ? getApp() : initializeApp(useEmulator
  ? { projectId: 'demo-kreditjatek-sandbox', apiKey: 'demo-kreditjatek' }
  : firebaseConfig);

export const firebaseAuth = getAuth(app);
export const firestore = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  ...firestoreTransport(typeof navigator==='undefined'?'':navigator.userAgent),
});

if (useEmulator) {
  connectAuthEmulator(firebaseAuth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(firestore, '127.0.0.1', 8080);
}

let readyPromise: Promise<User> | null = null;

export const ensureFirebaseUser = () => {
  if (!readyPromise) {
    readyPromise = (async () => {
      await firebaseAuth.authStateReady();
      if (firebaseAuth.currentUser) return firebaseAuth.currentUser;
      const credential = await signInAnonymously(firebaseAuth);
      return credential.user;
    })().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
};
