import { initializeApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, signInAnonymously, User } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
import {firestoreTransport} from './firestoreTransport';

// This development branch uses a fictitious project and loopback-only emulators.
const app = initializeApp({
  projectId: 'demo-kreditjatek-sandbox',
  apiKey: 'demo-kreditjatek',
  appId: 'demo-kreditjatek-web',
}, 'kreditjatek-sandbox');

const sandboxOrigin = typeof location === 'undefined' ? new URL('http://127.0.0.1:4173') : location;

export const firebaseAuth = getAuth(app);
export const firestore = initializeFirestore(app, {
  host: sandboxOrigin.host,
  ssl: sandboxOrigin.protocol === 'https:',
  ignoreUndefinedProperties: true,
  ...firestoreTransport(typeof navigator==='undefined'?'':navigator.userAgent),
});

connectAuthEmulator(firebaseAuth, sandboxOrigin.origin, { disableWarnings: true });

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
