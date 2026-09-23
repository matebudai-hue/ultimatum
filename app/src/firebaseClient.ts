import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, User } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: 'AIzaSyAh623-RLDVDkBWFQp6X-F1xBeNi8tLu2Y',
  authDomain: 'kreditjatek-a644e.firebaseapp.com',
  projectId: 'kreditjatek-a644e',
  storageBucket: 'kreditjatek-a644e.firebasestorage.app',
  messagingSenderId: '136070394488',
  appId: '1:136070394488:web:1d3f2187ac3acd0efab38d',
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

export const firebaseAuth = getAuth(app);
export const firestore = initializeFirestore(app, {
  ignoreUndefinedProperties: true,
  experimentalAutoDetectLongPolling: true,
});

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
