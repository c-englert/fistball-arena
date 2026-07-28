import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { HashRouter, Routes, Route } from "react-router-dom";
import MatchList from "./pages/MatchList.jsx";
import Sumula from "./pages/Sumula.jsx";
import Identity from "./pages/Identity.jsx";
import { getMe, ensureGames } from "./cloud.js";
import "./styles.css";

function Root() {
  const [me, setMe] = useState(getMe());

  useEffect(() => { ensureGames(); }, []);

  if (!me) return <Identity onDone={setMe} />;

  const signOut = () => { localStorage.removeItem("fb_me"); setMe(null); };

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
