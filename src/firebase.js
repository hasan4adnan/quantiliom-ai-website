import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.2/firebase-app.js";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/10.13.2/firebase-auth.js";

import { firebaseConfig } from "./firebase-config.js";

const required = ["apiKey", "authDomain", "projectId", "appId"];
for (const key of required) {
  if (!firebaseConfig[key]) {
    throw new Error(
      `Missing Firebase config key "${key}". Copy src/firebase-config.example.js to src/firebase-config.js and fill it in.`
    );
  }
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

export {
  auth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  onAuthStateChanged,
};
