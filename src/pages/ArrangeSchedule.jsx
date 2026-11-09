import { useState } from "react";
import { useNavigate } from "react-router-dom";
import ScheduleGrid from "../schedule/ScheduleGrid.jsx";
import { renumberGames } from "../cloud.js";
import { useEvent } from "../eventContext.js";
import { useT } from "../i18n.js";

// Drag-and-drop schedule grid page (rendered inside the app shell).
export default function ArrangeSchedule() {
  const nav = useNavigate();
  const t = useT();
  const { eventId, isAdmin, archived } = useEvent();
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  if (!isAdmin) return <div className="empty">{t("Admins only.")} <button className="btn" onClick={() => nav(`/e/${eventId}`)}>{t("Back")}</button></div>;

  const renumber = async () => {
    if (!window.confirm(t("Renumber all games #1..N in chronological order (day · time · court)? This changes only the game numbers — not the games, teams or bracket."))) return;
    setBusy(true); setStatus(t("Renumbering…"));
    try { const { total, changed } = await renumberGames(); setStatus(t("Done — {changed} of {total} games renumbered.", { changed, total })); }
    catch (e) { setStatus(t("Failed: ") + (e?.code || e?.message || e)); }
    finally { setBusy(false); }
  };

  return (
    <>
      <h2 className="page-h">{t("Arrange schedule")}</h2>
      {archived && <div className="warn-box">{t("This event is archived — read-only.")}</div>}
      {!archived && (
        <div className="row-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 12 }}>
          <span className="muted-sm">{t("Finished arranging? Renumber the games so #1..N follow the chronological order.")}</span>
          <button className="btn" onClick={renumber} disabled={busy}>{busy ? t("Renumbering…") : t("Renumber #1..N by day · time · court")}</button>
        </div>
      )}
      {status && <p className="muted-sm" style={{ marginTop: -4, marginBottom: 10 }}>{status}</p>}
      <ScheduleGrid />
    </>
  );
}
