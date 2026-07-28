import { useState } from "react";
import { signInWithGoogle } from "../cloud.js";

export default function Identity() {
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const go = async () => {
    setErr("");
    setBusy(true);
    try {
      await signInWithGoogle();
      // onMe (in main) picks up the signed-in user and swaps the screen.
    } catch (e) {
      if (e?.code !== "auth/popup-closed-by-user" && e?.code !== "auth/cancelled-popup-request") {
        setErr(e?.message || "Sign-in failed. Please try again.");
      }
      setBusy(false);
    }
  };

  return (
    <div className="identity">
      <div className="identity-card">
        <div className="brand-logo lg"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <h1>Fistball Arena</h1>
        <p className="sub">Game reports · U18 WC &amp; Women's EFA 2026</p>
        <button className="btn primary google" style={{ width: "100%" }} disabled={busy} onClick={go}>
          {busy ? "Signing in…" : "Sign in with Google"}
        </button>
        {err && <p className="error">{err}</p>}
        <p className="hint">Sign in with your Google account to score matches.</p>
      </div>
    </div>
  );
}
