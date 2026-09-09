import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import { subscribeGames, saveGameKit } from "../cloud.js";
import { useEvent } from "../eventContext.js";
import { flagFor } from "../flags.js";

// Common uniform colours. value is the stored hex; label for the tooltip.
const PALETTE = [
  ["White", "#ffffff"], ["Black", "#1a1a1a"], ["Red", "#e23b3b"], ["Blue", "#2f6df0"],
  ["Navy", "#1c2c66"], ["Sky", "#38bdf8"], ["Green", "#17915a"], ["Yellow", "#f2c20a"],
  ["Orange", "#f2762e"], ["Pink", "#ec4899"], ["Purple", "#7c3aed"], ["Gray", "#9aa3b2"],
  ["Brown", "#8b5a2b"], ["Teal", "#14b8a6"], ["Maroon", "#7f1d1d"],
];
const parseDate = (s) => { const [d, m, y] = String(s).split("/").map(Number); return new Date(2000 + (y || 0), (m || 1) - 1, d || 1); };
const dayLabel = (s) => { const dt = parseDate(s); return `${dt.toLocaleDateString("en-US", { weekday: "short" })} ${dt.getDate()} ${dt.toLocaleDateString("en-US", { month: "short" })}`; };
const shortTeam = (t) => String(t?.name || t || "").split(" - ")[0];

function ColorPick({ value, disabled, onPick }) {
  const [pos, setPos] = useState(null); // {top,left} while open (fixed, via portal)
  const btnRef = useRef(null);
  const toggle = () => {
    if (pos) { setPos(null); return; }
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 4, left: Math.min(r.left, window.innerWidth - 190) });
  };
  const close = () => setPos(null);
  return (
    <span className="cpick">
      <button ref={btnRef} type="button" className="cpick-btn" disabled={disabled} onClick={toggle}
        title={value ? "Change shirt colour" : "Set shirt colour"} style={value ? { background: value } : undefined}>
        {!value && <span className="cpick-empty">—</span>}
      </button>
      {pos && !disabled && createPortal(
        <>
          <div className="cpick-backdrop" onClick={close} />
          <div className="cpick-pop" style={{ top: pos.top, left: pos.left }}>
            {PALETTE.map(([name, hex]) => (
              <button key={hex} type="button" className="cpick-sw" title={name} style={{ background: hex }}
                onClick={() => { onPick(hex); close(); }} />
            ))}
            <button type="button" className="cpick-clear" onClick={() => { onPick(""); close(); }}>Clear</button>
          </div>
        </>, document.body)}
    </span>
  );
}

// Referees define the shirt colour each team wears. Set a whole day for a team
// at once, or override a single game. Admin only.
export default function Colors() {
  const nav = useNavigate();
  const { eventId, isAdmin, archived } = useEvent();
  const [games, setGames] = useState([]);
  const [day, setDay] = useState("all");
  const [q, setQ] = useState("");
  const [bulk, setBulk] = useState({ team: "", date: "", color: "" });
  const [status, setStatus] = useState("");

  useEffect(() => subscribeGames(setGames), []);

  const days = useMemo(() => [...new Set(games.map((g) => g.date).filter(Boolean))].sort((a, b) => parseDate(a) - parseDate(b)), [games]);
  const teamNames = useMemo(() => [...new Set(games.flatMap((g) => [g.teamA?.name, g.teamB?.name]).filter(Boolean))].sort(), [games]);
  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return games
      .filter((g) => day === "all" || g.date === day)
      .filter((g) => !t || String(g.nr).includes(t) || (g.teamA?.name || "").toLowerCase().includes(t) || (g.teamB?.name || "").toLowerCase().includes(t))
      .sort((a, b) => parseDate(a.date) - parseDate(b.date) || String(a.time).localeCompare(b.time) || a.nr - b.nr);
  }, [games, day, q]);

  if (!isAdmin) return <div className="empty">Admins only.</div>;

  const setKit = async (g, side, color) => {
    try { await saveGameKit(g.id, side, color); }
    catch (e) { setStatus("Failed: " + (e?.code || e?.message || e)); }
  };
  const applyBulk = async () => {
    const { team, date, color } = bulk;
    if (!team || !date) { setStatus("Pick a team and a day first."); return; }
    const targets = games.filter((g) => g.date === date && (g.teamA?.name === team || g.teamB?.name === team));
    if (!targets.length) { setStatus("No games for that team on that day."); return; }
    setStatus("Applying…");
    try {
      for (const g of targets) await saveGameKit(g.id, g.teamA?.name === team ? "A" : "B", color);
      setStatus(`Set ${shortTeam({ name: team })}'s shirt on ${dayLabel(date)} for ${targets.length} game(s).`);
    } catch (e) { setStatus("Failed: " + (e?.code || e?.message || e)); }
  };

  return (
    <>
      <h2 className="page-h">Shirt colors</h2>
      <p className="muted-sm" style={{ marginTop: -8 }}>Referees set which shirt each team wears. Set a team's colour for a whole day at once, or click a game's swatch to override just that match. Shows on the games list and game report.</p>
      {archived && <div className="warn-box">This event is archived — read-only.</div>}

      {!archived && (
        <div className="card" style={{ maxWidth: "none" }}>
          <div className="bulk-row">
            <span className="muted-sm">Set a team's shirt for a whole day:</span>
            <input list="clr-teams" className="game-search" style={{ maxWidth: 240 }} value={bulk.team} onChange={(e) => setBulk({ ...bulk, team: e.target.value })} placeholder="Team…" />
            <datalist id="clr-teams">{teamNames.map((n) => <option key={n} value={n} />)}</datalist>
            <select className="ag-role" value={bulk.date} onChange={(e) => setBulk({ ...bulk, date: e.target.value })}>
              <option value="">— day —</option>
              {days.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
            </select>
            <ColorPick value={bulk.color} onPick={(c) => setBulk({ ...bulk, color: c })} />
            <button className="btn sm" onClick={applyBulk}>Apply to day</button>
          </div>
        </div>
      )}

      <div className="filter-bar" style={{ padding: "8px 0" }}>
        <span className="filter-label">Day</span>
        <button className={`filter-pill ${day === "all" ? "active" : ""}`} onClick={() => setDay("all")}>All</button>
        {days.map((d) => <button key={d} className={`filter-pill ${day === d ? "active" : ""}`} onClick={() => setDay(d)}>{dayLabel(d)}</button>)}
      </div>
      <input className="game-search" style={{ maxWidth: 360, marginBottom: 10 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search game # or team…" />
      {status && <p className="muted-sm">{status}</p>}

      <div className="grid-scroll">
        <table className="ref-grid">
          <thead><tr><th className="rg-game">Game</th><th>Team A shirt</th><th>Team B shirt</th></tr></thead>
          <tbody>
            {shown.length === 0 && <tr><td className="muted-sm" colSpan={3}>No games.</td></tr>}
            {shown.map((g) => (
              <tr key={g.id}>
                <td className="rg-game" onClick={() => nav(`/e/${eventId}/game/${g.id}`)} title="Open game report">
                  <div className="rg-nr">#{g.nr} <span className="muted-sm">{dayLabel(g.date)} · {g.time} · Court {g.court}</span></div>
                  <div className="muted-sm">{g.category} · {g.round}</div>
                </td>
                <td className="clr-cell"><span className="flag">{flagFor(g.teamA?.name)}</span>{shortTeam(g.teamA)} <ColorPick value={g.kit?.A || ""} disabled={archived} onPick={(c) => setKit(g, "A", c)} /></td>
                <td className="clr-cell"><span className="flag">{flagFor(g.teamB?.name)}</span>{shortTeam(g.teamB)} <ColorPick value={g.kit?.B || ""} disabled={archived} onPick={(c) => setKit(g, "B", c)} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
