import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import MatchList from "./pages/MatchList.jsx";
import Sumula from "./pages/Sumula.jsx";
import Identity from "./pages/Identity.jsx";
import { onMe, signOutMe, ensureGames } from "./cloud.js";
import "./styles.css";

function Root() {
  const [me, setMe] = useState(undefined); // undefined = auth not resolved yet
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const unsub = onMe((m) => { setMe(m); setReady(true); });
    return unsub;
  }, []);

  useEffect(() => { if (me) ensureGames(); }, [me]);

  if (!ready || me === undefined) return <div className="empty">Loading…</div>;
  if (!me) return <Identity />;

  const signOut = () => signOutMe();

  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<MatchList me={me} onSignOut={signOut} />} />
        <Route path="/game/:id" element={<Sumula me={me} />} />
      </Routes>
    </HashRouter>
  );
}

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Root />
  </StrictMode>
);
