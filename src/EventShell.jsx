import { useEffect, useState } from "react";
import { useParams, Routes, Route, Navigate } from "react-router-dom";
import { setEvent, subscribeEvent, subscribeMyRole, subscribeBranding } from "./cloud.js";
import { EventContext } from "./eventContext.js";
import MatchList from "./pages/MatchList.jsx";
import Sumula from "./pages/Sumula.jsx";
import Schedule from "./pages/Schedule.jsx";
import ArrangeSchedule from "./pages/ArrangeSchedule.jsx";
import Roster from "./pages/Roster.jsx";
import Members from "./pages/Members.jsx";
import Settings from "./pages/Settings.jsx";
import Standings from "./pages/Standings.jsx";

export default function EventShell({ me, onSignOut }) {
  const { eventId } = useParams();
  const [event, setEv] = useState(undefined);
  const [myRole, setMyRole] = useState(undefined);
  const [branding, setBranding] = useState(null);

  useEffect(() => {
    setEvent(eventId);
    setEv(undefined);
    setMyRole(undefined);
    setBranding(null);
    const u1 = subscribeEvent(setEv);
    const u2 = subscribeMyRole(me, setMyRole);
    const u3 = subscribeBranding(setBranding);
    return () => { u1 && u1(); u2 && u2(); u3 && u3(); };
  }, [eventId]);

  if (event === undefined || myRole === undefined) return <div className="empty">Loading event…</div>;
  if (event === null) return <NoAccess msg="Event not found." />;
  if (myRole === null && !me.admin) return <NoAccess msg="You don't have access to this event." />;

  const archived = event.status === "archived";
  const isAdmin = myRole === "admin" || me.admin;
  const canScore = !archived && (isAdmin || myRole === "official");
  const ctx = { eventId, event, myRole, archived, isAdmin, canScore, branding };

  return (
    <EventContext.Provider value={ctx}>
      <div key={eventId}>
        <Routes>
          <Route index element={<MatchList me={me} onSignOut={onSignOut} />} />
          <Route path="game/:id" element={<Sumula me={me} />} />
          <Route path="standings" element={<Standings />} />
          <Route path="schedule" element={isAdmin ? <Schedule me={me} /> : <Navigate to=".." replace />} />
          <Route path="arrange" element={isAdmin ? <ArrangeSchedule me={me} /> : <Navigate to=".." replace />} />
          <Route path="roster" element={isAdmin ? <Roster me={me} /> : <Navigate to=".." replace />} />
          <Route path="members" element={isAdmin ? <Members me={me} /> : <Navigate to=".." replace />} />
          <Route path="settings" element={isAdmin ? <Settings me={me} /> : <Navigate to=".." replace />} />
        </Routes>
      </div>
    </EventContext.Provider>
  );
}

function NoAccess({ msg }) {
  return (
    <div className="empty">
      {msg} <a className="btn" href="#/" style={{ marginLeft: 8 }}>Events</a>
    </div>
  );
}
