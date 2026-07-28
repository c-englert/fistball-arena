import { initializeApp } from "firebase/app";
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";

// In dev we run against the local Firebase emulator (no real project needed).
// When the tournament's real firebaseConfig is added, the non-DEV branch is used
// and Google auth + strict rules kick in.
const USE_EMULATOR = import.meta.env.DEV;

const firebaseConfig = USE_EMULATOR
  ? { projectId: "demo-fistball", apiKey: "demo" }
  : {
      // TODO: paste the tournament's firebaseConfig here (from the Firebase console)
      apiKey: import.meta.env.VITE_FB_API_KEY,
      authDomain: import.meta.env.VITE_FB_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FB_PROJECT_ID,
      appId: import.meta.env.VITE_FB_APP_ID,
    };

export const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);

if (USE_EMULATOR) {
  connectFirestoreEmulator(db, "localhost", 8080);
}
