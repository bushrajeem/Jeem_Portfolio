/** Turns Firebase error codes into friendly, actionable messages. */

export function getErrorCode(err: unknown): string {
  if (typeof err === "object" && err !== null && "code" in err) {
    const code = (err as { code: unknown }).code;
    return typeof code === "string" ? code : "";
  }
  return "";
}

export function describeError(err: unknown): string {
  switch (getErrorCode(err)) {
    case "permission-denied":
      return "Firestore security rules rejected this request. Make sure your UID is listed in firestore.rules and the latest rules are published.";
    case "unavailable":
      return "Firestore is unreachable right now. Check your internet connection and try again.";
    case "unauthenticated":
      return "Your session has ended. Please sign in again.";
    case "resource-exhausted":
      return "Firebase usage quota reached. Please try again later.";
    case "invalid-argument":
      return "Firestore rejected the data format. Please double-check the fields.";
    case "failed-precondition":
      return "Firestore is not ready (is the database created?). Check Firebase Console.";
    case "auth/popup-closed-by-user":
    case "auth/cancelled-popup-request":
      return "The Google sign-in popup was closed before finishing.";
    case "auth/popup-blocked":
      return "Your browser blocked the sign-in popup. Allow popups for this site and try again.";
    case "auth/unauthorized-domain":
      return "This domain is not authorised. Add it in Firebase Console → Authentication → Settings → Authorized domains.";
    case "auth/operation-not-allowed":
      return "Google sign-in is disabled. Enable it in Firebase Console → Authentication → Sign-in method → Google.";
    case "auth/network-request-failed":
      return "Network error during sign-in. Check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Firebase has temporarily paused sign-in for this device — wait a few minutes.";
    case "auth/user-disabled":
      return "This Google account has been disabled in Firebase.";
    case "auth/internal-error":
      return "Firebase Auth had an internal error. Refresh the page and try again.";
    case "storage/unauthorized":
      return "Firebase Storage rejected this upload. Publish storage.rules with your UID (or configure free Cloudinary keys in .env.local / Vercel).";
    case "storage/bucket-not-found":
    case "storage/project-not-found":
      return "Firebase Storage bucket is not enabled yet. Enable Storage in Firebase Console or configure free Cloudinary upload keys.";
    case "storage/canceled":
      return "Upload was cancelled.";
    case "storage/retry-limit-exceeded":
      return "Upload timed out. Check your connection and try again.";
    default:
      return err instanceof Error && err.message ? err.message : "Something unexpected happened.";
  }
}
