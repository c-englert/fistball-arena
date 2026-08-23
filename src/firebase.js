import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, GoogleAuthProvider } from "firebase/auth";

// Fistball Arena — Firebase project config (client-side, not secret).
const firebaseConfig = {
  apiKey: "AIzaSyAca__YTy_Y6tlX62jJ6aK_qHhJgUD4V0w",
  authDomain: "fistball-arena.firebaseapp.com",
  projectId: "fistball-arena",
  storageBucket: "fistball-arena.firebasestorage.app",
  messagingSenderId: "261226374717",
  appId: "1:261226374717:web:d267cc2b02175e85bf2c54",
};

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
// Always show Google's account chooser instead of silently reusing the one
// signed-in account — organizers/officials often have several accounts.
googleProvider.setCustomParameters({ prompt: "select_account" });
