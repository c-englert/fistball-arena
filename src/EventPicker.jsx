import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listMyEvents, createEvent, subscribeLivePointer, setLiveEvent, clearLiveEvent, subscribeAllBranding } from "./cloud.js";
import AccountMenu from "./AccountMenu.jsx";
import { formatRange } from "./dates.js";

export default function EventPicker({ me, onSignOut }) {
  const nav = useNavigate();
  const [events, setEvents] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", place: "", startDate: "", endDate: "" });
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("active");
  const [live, setLive] = useState(null);
  const [brandings, setBrandings] = useState({});

  useEffect(() => listMyEvents(me, setEvents), [me]);
  useEffect(() => subscribeLivePointer(setLive), []);
  useEffect(() => subscribeAllBranding(setBrandings), []);

  const shown = (events || []).filter((e) => (tab === "archived" ? e.status === "archived" : e.status !== "archived"));
  const canManageLive = (ev) => me.admin || ev.myRole === "admin";
  const toggleLive = async (ev, isLive) => {
    try { if (isLive) { if (window.confirm("Remove this event from Fistball Live?")) await clearLiveEvent(); } else await setLiveEvent(ev); }
    catch (e) { alert("Failed: " + (e?.message || e)); }
  };

  const create = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const id = await createEvent({ ...form, dates: formatRange(form.startDate, form.endDate) }, me);
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
            <div className="field"><span>Place</span>
              <input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} placeholder="Reiden · Switzerland" /></div>
            <div className="grid2">
              <div className="field"><span>Starts</span>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: form.endDate && form.endDate < e.target.value ? e.target.value : form.endDate })} /></div>
              <div className="field"><span>Ends</span>
                <input type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            {(form.startDate || form.endDate) && <p className="muted-sm">{formatRange(form.startDate, form.endDate) || "Pick a start and end date"}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => setCreating(false)}>Cancel</button>
              <button className="btn primary" disabled={busy || !form.name.trim()} onClick={create}>{busy ? "Creating…" : "Create & open"}</button>
            </div>
          </div>
        )}

        <div className="filter-bar" style={{ padding: "0 0 12px" }}>
          <button className={`filter-pill ${tab === "active" ? "active" : ""}`} onClick={() => setTab("active")}>Active &amp; upcoming</button>
          <button className={`filter-pill ${tab === "archived" ? "active" : ""}`} onClick={() => setTab("archived")}>Archived</button>
        </div>

        {events === null && <div className="empty">Loading events…</div>}
        {events !== null && shown.length === 0 && (
          <div className="empty">{tab === "archived" ? "No archived events." : me.admin ? "No active events — create one above." : "You're not a member of any active event yet."}</div>
        )}
        {shown.map((ev) => {
          const isLive = live?.eventId === ev.id;
          return (
            <div className="match-card" key={ev.id} onClick={() => nav(`/e/${ev.id}`)} style={{ cursor: "pointer" }}>
              <div className="mc-top">
                <span className={`state ${ev.status === "archived" ? "none" : "submitted"}`}>{ev.status === "archived" ? "Archived" : "Active"}</span>
                <span className="tag">{ev.myRole}</span>
                {isLive && <span className="tag live-tag">● On Fistball Live</span>}
                <span className="spacer" style={{ flex: 1 }} />
                {canManageLive(ev) && (
                  <button className={`btn sm ${isLive ? "danger" : ""}`} onClick={(e) => { e.stopPropagation(); toggleLive(ev, isLive); }}>
                    {isLive ? "Remove from Live" : "Show on Live"}
                  </button>
                )}
              </div>
              <div className="ev-body">
                {brandings[ev.id]?.eventLogo?.dataUrl && <img className="ev-logo" src={brandings[ev.id].eventLogo.dataUrl} alt="" />}
                <div style={{ minWidth: 0 }}>
                  <div className="mc-teams" style={{ fontSize: 20 }}>{ev.name}</div>
                  <div className="muted-sm">{[ev.place, ev.dates].filter(Boolean).join(" · ")}</div>
                  <div className="ev-promos">
                    {(brandings[ev.id]?.promoters || []).slice(0, 4).map((p, i) => <img key={i} src={p.dataUrl} alt="" />)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
