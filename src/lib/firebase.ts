import { getApp, getApps, initializeApp, type FirebaseApp, type FirebaseOptions } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getStorage, type FirebaseStorage } from "firebase/storage";

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID?.trim() || undefined,
};

function isConfiguredValue(value: string | undefined): boolean {
  if (!value) return false;
  return !value.startsWith("your_") && !value.startsWith("your-");
}

/**
 * True when all required Firebase environment variables are present in .env.local.
 * Keeping initialization guarded ensures the portfolio still renders cleanly before
 * keys are added.
 */
export const isFirebaseConfigured: boolean = [
  firebaseConfig.apiKey,
  firebaseConfig.authDomain,
  firebaseConfig.projectId,
  firebaseConfig.storageBucket,
  firebaseConfig.messagingSenderId,
  firebaseConfig.appId,
].every(isConfiguredValue);

const isFreshApp = isFirebaseConfigured && getApps().length === 0;

export const app: FirebaseApp | null = isFirebaseConfigured
  ? getApps().length > 0
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;

/**
 * Optional Firebase App Check (reCAPTCHA v3). When a site key is provided, every
 * Firestore request carries a token proving it came from YOUR website, which
 * blocks bots and scripts that copy your public API key.
 */
const appCheckSiteKey = import.meta.env.VITE_FIREBASE_APPCHECK_SITE_KEY?.trim();
if (app && isFreshApp && appCheckSiteKey && isConfiguredValue(appCheckSiteKey)) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(appCheckSiteKey),
      isTokenAutoRefreshEnabled: true,
    });
  } catch {
    /* App Check already initialised (e.g. during hot reload) */
  }
}

export const db: Firestore | null = app ? getFirestore(app) : null;
export const storage: FirebaseStorage | null = app ? getStorage(app) : null;

export function getFirestoreDb(): Firestore {
  if (!db) {
    throw new Error(
      "Firestore is not configured yet. Add your VITE_FIREBASE_* keys to .env.local and restart the dev server.",
    );
  }
  return db;
}

export function getFirebaseStorage(): FirebaseStorage {
  if (!storage) {
    throw new Error(
      "Firebase Storage is not configured yet. Add your VITE_FIREBASE_* keys to .env.local and restart the dev server.",
    );
  }
  return storage;
}
