import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Firebase project config (client-side, NOT secret — safe to ship publicly;
// security is enforced by firestore.rules). To run your own instance, copy
// .env.example to .env and set VITE_FIREBASE_*. The values below are the
// reference deployment's and are used only when no env var is provided.
const env = import.meta.env;
const firebaseConfig = {
  apiKey: env.VITE_FIREBASE_API_KEY || "AIzaSyAca__YTy_Y6tlX62jJ6aK_qHhJgUD4V0w",
  authDomain: env.VITE_FIREBASE_AUTH_DOMAIN || "fistball-arena.firebaseapp.com",
  projectId: env.VITE_FIREBASE_PROJECT_ID || "fistball-arena",
  storageBucket: env.VITE_FIREBASE_STORAGE_BUCKET || "fistball-arena.firebasestorage.app",
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || "261226374717",
  appId: env.VITE_FIREBASE_APP_ID || "1:261226374717:web:d267cc2b02175e85bf2c54",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// Always show Google's account chooser instead of silently reusing the one
// signed-in account — organizers/officials often have several accounts.
googleProvider.setCustomParameters({ prompt: "select_account" });
