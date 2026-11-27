import {
  GoogleAuthProvider,
  browserPopupRedirectResolver,
  browserSessionPersistence,
  getAuth,
  initializeAuth,
  onAuthStateChanged,
  signInWithPopup,
  signOut,
  type Auth,
  type User,
} from "firebase/auth";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { COLLECTIONS } from "../lib/firestore";
import { app, getFirestoreDb } from "../lib/firebase";
import { getErrorCode } from "./errors";

/** Auto-lock after 15 minutes without mouse/keyboard activity. */
export const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
/** Force a fresh Google sign-in at least every 12 hours. */
export const MAX_SESSION_MS = 12 * 60 * 60 * 1000;

let authInstance: Auth | null = null;

/**
 * Auth uses SESSION persistence: closing the tab/browser signs you out, so a
 * shared or stolen laptop never stays logged into your admin panel.
 */
export function getAdminAuth(): Auth {
  if (!app) throw new Error("Firebase is not configured. Add your keys to .env.local.");
  if (authInstance) return authInstance;
  try {
    authInstance = initializeAuth(app, {
      persistence: browserSessionPersistence,
      popupRedirectResolver: browserPopupRedirectResolver,
    });
  } catch {
    // Already initialised (e.g. hot reload) — reuse the existing instance.
    authInstance = getAuth(app);
  }
  return authInstance;
}

export function watchAuth(callback: (user: User | null) => void): () => void {
  return onAuthStateChanged(getAdminAuth(), callback);
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });
  const credential = await signInWithPopup(getAdminAuth(), provider);
  return credential.user;
}

export async function signOutAdmin(): Promise<void> {
  await signOut(getAdminAuth());
}

export async function getSessionStartedAt(user: User): Promise<number> {
  const result = await user.getIdTokenResult();
  const parsed = Date.parse(result.authTime);
  return Number.isFinite(parsed) ? parsed : Date.now();
}

export function isGoogleVerified(user: User): boolean {
  return user.emailVerified && user.providerData.some((p) => p.providerId === "google.com");
}

/**
 * Asks Firestore itself whether this user is an admin, by attempting a read
 * that only `isAdmin()` in firestore.rules allows. The client can never fake
 * this answer — the server decides.
 */
export async function verifyAdminAccess(): Promise<boolean> {
  try {
    await getDocs(query(collection(getFirestoreDb(), COLLECTIONS.auditLog), limit(1)));
    return true;
  } catch (err) {
    if (getErrorCode(err) === "permission-denied") return false;
    throw err;
  }
}
