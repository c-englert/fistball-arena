import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ScheduleGrid from "../schedule/ScheduleGrid.jsx";
import { renumberGames } from "../cloud.js";
import { useEvent } from "../eventContext.js";

// Drag-and-drop schedule grid page (rendered inside the app shell).
export default function ArrangeSchedule() {
  const nav = useNavigate();
  const { eventId, isAdmin, archived } = useEvent();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  if (!isAdmin) return <div className="empty">Admins only. <button className="btn" onClick={() => nav(`/e/${eventId}`)}>Back</button></div>;

  const renumber = async () => {
    if (!window.confirm("Renumber all games #1..N in chronological order (day · time · court)? This changes only the game numbers — not the games, teams or bracket.")) return;
    setBusy(true); setStatus("Renumbering…");
    try { const { total, changed } = await renumberGames(); setStatus(`Done — ${changed} of ${total} games renumbered.`); }
    catch (e) { setStatus("Failed: " + (e?.code || e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <h2 className="page-h">Arrange schedule</h2>
      {archived && <div className="warn-box">This event is archived — read-only.</div>}
      {!archived && (
        <div className="row-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <span className="muted-sm">Finished arranging? Renumber the games so #1..N follow the chronological order.</span>
          <button className="btn" onClick={renumber} disabled={busy}>{busy ? "Renumbering…" : "Renumber #1..N by day · time · court"}</button>
        </div>
      )}
      {status && <p className="muted-sm" style={{ marginTop: -4, marginBottom: 10 }}>{status}</p>}
      <ScheduleGrid />
    </>
  );
}
