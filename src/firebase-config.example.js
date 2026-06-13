// Copy this file to src/firebase-config.js and fill in the values from your
// Firebase project (Console -> Project settings -> Your apps -> SDK setup).
//
// src/firebase-config.js is gitignored. Never commit the real values.
//
// The variable names below mirror the VITE_FIREBASE_* keys documented in
// .env.example so this file can be replaced by `import.meta.env` once the
// site is moved to a Vite build.

export const firebaseConfig = {
  apiKey: "",              // VITE_FIREBASE_API_KEY
  authDomain: "",          // VITE_FIREBASE_AUTH_DOMAIN
  projectId: "",           // VITE_FIREBASE_PROJECT_ID
  storageBucket: "",       // VITE_FIREBASE_STORAGE_BUCKET
  messagingSenderId: "",   // VITE_FIREBASE_MESSAGING_SENDER_ID
  appId: "",               // VITE_FIREBASE_APP_ID
  measurementId: "",       // VITE_FIREBASE_MEASUREMENT_ID (optional)
};
