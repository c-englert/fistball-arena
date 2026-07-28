import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { setEventStatus, subscribeLivePointer, setLiveEvent, clearLiveEvent } from "../cloud.js";
import { useEvent } from "../eventContext.js";

export default function Settings({ me }) {
  const nav = useNavigate();
  const { eventId, event, archived, isAdmin } = useEvent();
  const [live, setLive] = useState(undefined);
  const [status, setStatus] = useState("");

  useEffect(() => subscribeLivePointer(setLive), []);

  if (!isAdmin) return <div className="empty">Admins only.</div>;

  const thisIsLive = live?.eventId === eventId;
  const publishLive = async () => { try { await setLiveEvent(event); } catch (e) { setStatus("Failed: " + (e?.message || e)); } };
  const stopLive = async () => {
    if (!window.confirm("Stop showing this event on Fistball Live?")) return;
    try { await clearLiveEvent(); } catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };
  const toggleArchive = async () => {
    const next = archived ? "active" : "archived";
    if (!window.confirm(archived ? "Re-activate this event (make it editable again)?" : "Archive this event? It becomes read-only for everyone.")) return;
    try { await setEventStatus(next); } catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="iconbtn" onClick={() => nav(`/e/${eventId}`)}>‹ Games</button>
        <div className="brand-logo sm"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <div className="spacer" />
        <div style={{ textAlign: "right" }}>
          <div className="title">Event settings{archived && <span className="arch-badge">Archived</span>}</div>
          <div className="sub">{event?.name}</div>
        </div>
      </header>

      <div className="content">
        <div className="card">
          <div className="row-between">
            <div><h2 style={{ margin: 0 }}>Fistball Live</h2>
              <p className="muted-sm">
                {live === undefined ? "Checking…"
                  : thisIsLive ? "✅ This event is showing on the public scoreboard."
                  : live?.eventId ? `Another event is live: “${live.name || live.eventId}”.`
                  : "No event is on the public scoreboard yet."}
              </p></div>
            {thisIsLive
              ? <button className="btn danger" onClick={stopLive}>Stop showing</button>
              : <button className="btn primary" onClick={publishLive}>{live?.eventId ? "Show this instead" : "Publish to Live"}</button>}
          </div>
        </div>

        <div className="card">
          <div className="row-between">
            <div><h2 style={{ margin: 0 }}>Event status</h2>
              <p className="muted-sm">{archived ? "Archived — read-only for everyone." : "Active — members can score."}</p></div>
            <button className={`btn ${archived ? "primary" : "danger"}`} onClick={toggleArchive}>{archived ? "Re-activate" : "Archive"}</button>
          </div>
        </div>

        {status && <div className="card"><p className="muted-sm">{status}</p></div>}
      </div>
    </div>
  );
}
