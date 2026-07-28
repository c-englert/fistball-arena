import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listMyEvents, createEvent } from "./cloud.js";
import AccountMenu from "./AccountMenu.jsx";

export default function EventPicker({ me, onSignOut }) {
  const nav = useNavigate();
  const [events, setEvents] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", place: "", dates: "" });
  const [busy, setBusy] = useState(false);

  useEffect(() => listMyEvents(me, setEvents), [me]);

  const create = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const id = await createEvent(form, me);
      nav(`/e/${id}`);
    } catch (e) {
      alert("Could not create event: " + (e?.message || e));
      setBusy(false);
    }
  };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-logo"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <div>
          <div className="title">Fistball Arena</div>
          <div className="sub">Choose an event</div>
        </div>
        <div className="spacer" />
        <AccountMenu me={me} onSignOut={onSignOut} />
      </header>

      <div className="content">
        {me.admin && !creating && (
          <button className="btn primary" style={{ width: "100%", marginBottom: 16 }} onClick={() => setCreating(true)}>+ New event</button>
        )}
        {me.admin && creating && (
          <div className="card">
            <h2>New event</h2>
            <div className="field"><span>Name</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 2026 U18 WC & Women's EFA" autoFocus /></div>
            <div className="grid2">
              <div className="field"><span>Place</span>
                <input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} placeholder="Reiden · Switzerland" /></div>
              <div className="field"><span>Dates</span>
                <input value={form.dates} onChange={(e) => setForm({ ...form, dates: e.target.value })} placeholder="23–26 July 2026" /></div>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn primary" disabled={busy || !form.name.trim()} onClick={create}>{busy ? "Creating…" : "Create & open"}</button>
            </div>
          </div>
        )}

        {events === null && <div className="empty">Loading events…</div>}
        {events !== null && events.length === 0 && (
          <div className="empty">{me.admin ? "No events yet — create one above." : "You're not a member of any event yet. Ask an organizer to add you."}</div>
        )}
        {(events || []).map((ev) => (
          <button className="match-card" key={ev.id} onClick={() => nav(`/e/${ev.id}`)} style={{ textAlign: "left", width: "100%", cursor: "pointer" }}>
            <div className="mc-top">
              <span className={`state ${ev.status === "archived" ? "none" : "submitted"}`}>{ev.status === "archived" ? "Archived" : "Active"}</span>
              <span className="tag">{ev.myRole}</span>
            </div>
            <div className="mc-teams" style={{ fontSize: 20 }}>{ev.name}</div>
            <div className="muted-sm">{[ev.place, ev.dates].filter(Boolean).join(" · ")}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
