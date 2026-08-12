import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import EventPicker from "./EventPicker.jsx";
import EventShell from "./EventShell.jsx";
import Guide from "./pages/Guide.jsx";
import Identity from "./pages/Identity.jsx";
import InstallPrompt from "./InstallPrompt.jsx";
import { onMe, signOutMe } from "./cloud.js";
import "./styles.css";

function Root() {
  const [me, setMe] = useState(undefined); // undefined = auth not resolved yet
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onMe((m) => { setMe(m); setReady(true); });
    return unsub;
  }, []);

  if (!ready || me === undefined) return <div className="empty">Loading…</div>;
  if (!me) return <><Identity /><InstallPrompt /></>;

  const signOut = () => signOutMe();

  return (
    <>
      <HashRouter>
        <Routes>
          <Route path="/" element={<EventPicker me={me} onSignOut={signOut} />} />
          <Route path="/guide" element={<Guide me={me} onSignOut={signOut} />} />
          <Route path="/e/:eventId/*" element={<EventShell me={me} onSignOut={signOut} />} />
        </Routes>
      </HashRouter>
      <InstallPrompt />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
