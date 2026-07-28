import { useEffect, useState } from "react";
import { useParams, Routes, Route, Navigate } from "react-router-dom";
import { setEvent, subscribeEvent, subscribeMyRole } from "./cloud.js";
import { EventContext } from "./eventContext.js";
import MatchList from "./pages/MatchList.jsx";
import Sumula from "./pages/Sumula.jsx";
import Schedule from "./pages/Schedule.jsx";
import Roster from "./pages/Roster.jsx";
import Members from "./pages/Members.jsx";
import Settings from "./pages/Settings.jsx";

export default function EventShell({ me, onSignOut }) {
  const { eventId } = useParams();
  const [event, setEv] = useState(undefined);
  const [myRole, setMyRole] = useState(undefined);

  useEffect(() => {
    setEvent(eventId);
    setEv(undefined);
    setMyRole(undefined);
    const u1 = subscribeEvent(setEv);
    const u2 = subscribeMyRole(me, setMyRole);
    return () => { u1 && u1(); u2 && u2(); };
  }, [eventId]);

  if (event === undefined || myRole === undefined) return <div className="empty">Loading event…</div>;
  if (event === null) return <NoAccess msg="Event not found." />;
  if (myRole === null && !me.admin) return <NoAccess msg="You don't have access to this event." />;

  const archived = event.status === "archived";
  const isAdmin = myRole === "admin" || me.admin;
  const canScore = !archived && (isAdmin || myRole === "official");
  const ctx = { eventId, event, myRole, archived, isAdmin, canScore };

  return (
    <EventContext.Provider value={ctx}>
      <div key={eventId}>
        <Routes>
          <Route index element={<MatchList me={me} onSignOut={onSignOut} />} />
          <Route path="game/:id" element={<Sumula me={me} />} />
          <Route path="schedule" element={isAdmin ? <Schedule me={me} /> : <Navigate to=".." replace />} />
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
