import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeMembers, addMember, removeMember, setEventStatus,
  subscribeLivePointer, setLiveEvent, clearLiveEvent } from "../cloud.js";
import { useEvent } from "../eventContext.js";

const ROLES = ["admin", "official", "viewer"];

export default function Members({ me }) {
  const nav = useNavigate();
  const { eventId, event, archived, isAdmin } = useEvent();
  const [members, setMembers] = useState([]);
  const [form, setForm] = useState({ email: "", name: "", role: "official" });
  const [status, setStatus] = useState("");
  const [live, setLive] = useState(undefined); // public live pointer

  useEffect(() => subscribeMembers(setMembers), [eventId]);
  useEffect(() => subscribeLivePointer(setLive), []);

  if (!isAdmin) return <div className="empty">Admins only.</div>;

  const add = async () => {
    if (!form.email.trim()) return;
    setStatus("Adding…");
    try { await addMember(form, me); setForm({ email: "", name: "", role: "official" }); setStatus(""); }
    catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };
  const remove = async (email) => {
    if (!window.confirm(`Remove ${email} from this event?`)) return;
    try { await removeMember(email); } catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };
  const publishLive = async () => {
    try { await setLiveEvent(event); } catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };
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
          <div className="title">Members &amp; access</div>
          <div className="sub">{event?.name}</div>
        </div>
      </header>

      <div className="content">
        <div className="card">
          <div className="row-between">
            <div><h2 style={{ margin: 0 }}>Event status</h2>
              <p className="muted-sm">{archived ? "Archived — read-only for everyone." : "Active — members can score."}</p></div>
            <button className={`btn ${archived ? "primary" : "danger"}`} onClick={toggleArchive}>
              {archived ? "Re-activate" : "Archive"}
            </button>
          </div>
        </div>

        <div className="card">
          <div className="row-between">
            <div><h2 style={{ margin: 0 }}>Fistball Live</h2>
              <p className="muted-sm">
                {live === undefined ? "Checking…"
                  : live?.eventId === eventId ? "✅ This event is showing on the public scoreboard."
                  : live?.eventId ? `Another event is live: “${live.name || live.eventId}”.`
                  : "No event is on the public scoreboard yet."}
              </p></div>
            {live?.eventId === eventId
              ? <button className="btn danger" onClick={stopLive}>Stop showing</button>
              : <button className="btn primary" onClick={publishLive}>{live?.eventId ? "Show this instead" : "Publish to Live"}</button>}
          </div>
        </div>

        {!archived && (
          <div className="card">
            <h2>Add a person by email</h2>
            <div className="add-row" style={{ flexWrap: "wrap" }}>
              <input style={{ flex: "2 1 200px" }} value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="email@example.com" />
              <input style={{ flex: "1 1 120px" }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name (optional)" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button className="btn primary" onClick={add}>Add</button>
            </div>
            <p className="muted-sm">admin = manage event · official = fill súmulas · viewer = read only. {status}</p>
          </div>
        )}

        <div className="card">
          <h2>{members.length} member(s)</h2>
          {members.length === 0 && <p className="muted-sm">No members yet.</p>}
          {members.map((m) => (
            <div className="roster-row" key={m.id}>
              <span className={`roster-nr role`}>{(m.role || "?")[0].toUpperCase()}</span>
              <span className="roster-name">{m.name || m.email} <span className="muted-sm">{m.name ? m.email : ""}</span></span>
              <span className="tag">{m.role}</span>
              {!archived && <button className="btn danger sm" style={{ marginLeft: 8 }} onClick={() => remove(m.email)}>Remove</button>}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
