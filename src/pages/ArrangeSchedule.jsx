import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeGames, updateGameSlots } from "../cloud.js";
import { normalizeSlots } from "../schedule/scheduler.js";
import { useEvent } from "../eventContext.js";

const PALETTE = ["#6c5ce7", "#e84393", "#00b894", "#0984e3", "#e17055", "#00cec9", "#d63031", "#a29bfe", "#e1b12c", "#636e72"];
const toMin = (hhmm) => { const [h, m] = String(hhmm || "").split(":").map(Number); return (h || 0) * 60 + (m || 0); };
const toHHMM = (mins) => `${String(Math.floor(mins / 60)).padStart(2, "0")}:${String(mins % 60).padStart(2, "0")}`;
const short = (s) => (String(s || "").length > 16 ? String(s).slice(0, 15) + "…" : s);
const dayLabel = (d) => {
  const [dd, mm, yy] = String(d || "").split("/").map(Number);
  if (!dd) return d || "—";
  return new Date(2000 + (yy || 0), (mm || 1) - 1, dd).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" });
};

// Drag-and-drop editor to place each game on a day / court / time.
export default function ArrangeSchedule({ me }) {
  const nav = useNavigate();
  const { eventId, isAdmin, event, archived } = useEvent();
  const [games, setGames] = useState(null);
  const [local, setLocal] = useState({}); // nr -> { date, time, court }
  const [drag, setDrag] = useState(null); // nr being dragged
  const [over, setOver] = useState("");   // "date|court|time" hovered
  const [status, setStatus] = useState("");

  useEffect(() => subscribeGames(setGames), []);

  const slots = useMemo(() => normalizeSlots(event?.slots || {}), [event]);
  const cats = useMemo(() => [...new Set((games || []).map((g) => g.category))], [games]);
  const catColor = (c) => PALETTE[Math.max(0, cats.indexOf(c)) % PALETTE.length];
  const eff = (g) => ({ ...g, ...(local[g.nr] || {}) });

  const courts = slots.courts.length ? slots.courts : [...new Set((games || []).map((g) => g.court).filter(Boolean))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
  const days = useMemo(() => {
    const set = [...new Set([...slots.days.map((d) => d.date), ...(games || []).map((g) => eff(g).date).filter(Boolean)])];
    return set.sort((a, b) => {
      const p = (s) => { const [d, m, y] = String(s).split("/").map(Number); return (y || 0) * 10000 + (m || 0) * 100 + (d || 0); };
      return p(a) - p(b);
    });
  }, [slots, games, local]);

  if (!isAdmin) return <div className="empty">Admins only. <button className="btn" onClick={() => nav(`/e/${eventId}`)}>Back</button></div>;

  const timesFor = (date) => {
    const day = slots.days.find((d) => d.date === date);
    const step = slots.gameMinutes + slots.breakMinutes;
    const set = new Set();
    if (day && step > 0) for (let t = toMin(day.start); t + slots.gameMinutes <= toMin(day.end) + 1; t += step) set.add(toHHMM(t));
    (games || []).map(eff).filter((g) => g.date === date && g.time).forEach((g) => set.add(g.time));
    return [...set].sort((a, b) => toMin(a) - toMin(b));
  };
  const cardsAt = (date, court, time) => (games || []).map(eff).filter((g) => g.date === date && String(g.court) === String(court) && g.time === time);
  const unscheduled = (games || []).map(eff).filter((g) => !g.date || !g.time || !g.court);

  const setSlot = (nr, patch) => setLocal((l) => ({ ...l, [nr]: { ...(l[nr] || {}), ...patch } }));
  const drop = (date, court, time) => { if (drag != null) setSlot(drag, { date, court: String(court), time }); setDrag(null); setOver(""); };
  const dropUnscheduled = () => { if (drag != null) setSlot(drag, { date: "", court: "", time: "" }); setDrag(null); setOver(""); };

  const changed = Object.keys(local);
  const save = async () => {
    if (!changed.length) return;
    setStatus("Saving…");
    try {
      await updateGameSlots(changed.map((nr) => ({ nr: Number(nr), ...eff((games || []).find((g) => String(g.nr) === String(nr))) })));
      setLocal({});
      setStatus(`Saved ${changed.length} game${changed.length === 1 ? "" : "s"}.`);
    } catch (e) { setStatus("Save failed: " + (e?.message || e)); }
  };

  const base = `/e/${eventId}`;
  const card = (g) => (
    <div key={g.nr} className="ag-card" draggable={!archived} style={{ borderLeftColor: catColor(g.category) }}
      onDragStart={() => setDrag(g.nr)} onDragEnd={() => { setDrag(null); setOver(""); }}
      title={`#${g.nr} · ${g.category} · ${g.round}`}>
      <div className="ag-card-cat" style={{ color: catColor(g.category) }}>#{g.nr} · {g.category}</div>
      <div className="ag-card-teams">{short(g.teamA?.name || g.teamA)} <span className="muted-sm">v</span> {short(g.teamB?.name || g.teamB)}</div>
      <div className="ag-card-round muted-sm">{g.round}</div>
    </div>
  );

  return (
    <div className="app">
      <header className="topbar">
        <button className="iconbtn" onClick={() => nav(base)}>‹ Games</button>
        <div className="brand-logo sm"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <div className="spacer" />
        <div style={{ textAlign: "right" }}>
          <div className="title">Arrange schedule</div>
          <div className="sub">Drag games onto a day · court · time</div>
        </div>
      </header>

      <div className="content">
        {archived && <div className="warn-box">This event is archived — read-only.</div>}
        {games === null && <div className="empty">Loading games…</div>}
        {games !== null && games.length === 0 && <div className="empty">No games yet — generate the schedule first (Manage → Schedule).</div>}
        {games !== null && games.length > 0 && courts.length === 0 && (
          <div className="warn-box">No courts defined — set them in Settings → Courts &amp; schedule, or publish a schedule that has courts.</div>
        )}

        {games && games.length > 0 && (
          <>
            <div className="ag-bar">
              <span className="muted-sm">{changed.length ? `${changed.length} unsaved change${changed.length === 1 ? "" : "s"}` : "No changes"}</span>
              <span style={{ flex: 1 }} />
              {changed.length > 0 && <button className="btn sm" onClick={() => setLocal({})}>Reset</button>}
              <button className="btn primary sm" disabled={!changed.length || archived} onClick={save}>Save</button>
            </div>

            <div className={`ag-tray ${over === "unsched" ? "ag-over" : ""}`}
              onDragOver={(e) => { e.preventDefault(); setOver("unsched"); }} onDragLeave={() => setOver("")} onDrop={dropUnscheduled}>
              <div className="subhead" style={{ margin: 0 }}>Unscheduled ({unscheduled.length})</div>
              <div className="ag-tray-cards">{unscheduled.length ? unscheduled.map(card) : <span className="muted-sm">Drag a game here to unschedule it.</span>}</div>
            </div>

            {courts.length > 0 && days.map((date) => {
              const times = timesFor(date);
              return (
                <div className="ag-day" key={date}>
                  <div className="day-head" style={{ position: "static" }}>{dayLabel(date)}</div>
                  <div className="ag-grid-wrap">
                    <table className="ag-grid">
                      <thead>
                        <tr><th className="ag-th-time" /> {courts.map((c) => <th key={c} className="ag-th-court">Court {c}</th>)}</tr>
                      </thead>
                      <tbody>
                        {times.map((time) => (
                          <tr key={time}>
                            <td className="ag-time">{time}</td>
                            {courts.map((c) => {
                              const here = cardsAt(date, c, time);
                              const key = `${date}|${c}|${time}`;
                              return (
                                <td key={c} className={`ag-cell ${here.length > 1 ? "ag-conflict" : ""} ${over === key ? "ag-over" : ""}`}
                                  onDragOver={(e) => { e.preventDefault(); setOver(key); }} onDragLeave={() => setOver("")} onDrop={() => drop(date, c, time)}>
                                  {here.map(card)}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              );
            })}
            {status && <p className="muted-sm">{status}</p>}
          </>
        )}
      </div>
    </div>
  );
}
