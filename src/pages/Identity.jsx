import { useState } from "react";
import { setMe } from "../cloud.js";

export default function Identity({ onDone }) {
  const [name, setName] = useState("");
  const [admin, setAdmin] = useState(false);

  const go = () => { if (name.trim()) onDone(setMe(name, admin)); };

  return (
    <div className="identity">
      <div className="identity-card">
        <div className="brand-logo lg"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <h1>Fistball Arena</h1>
        <p className="sub">Game reports · U18 WC &amp; Women's EFA 2026</p>
        <div className="field">
          <label>Your name</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Ana Souza"
            onKeyDown={(e) => e.key === "Enter" && go()} autoFocus />
        </div>
        <label className="check">
          <input type="checkbox" checked={admin} onChange={(e) => setAdmin(e.target.checked)} />
          I'm an organizer (can unlock reports)
        </label>
        <button className="btn primary" style={{ width: "100%" }} disabled={!name.trim()} onClick={go}>Enter</button>
        <p className="hint">Temporary sign-in for testing. Google login comes with the live setup.</p>
      </div>
    </div>
  );
}
