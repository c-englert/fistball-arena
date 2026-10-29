import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import { subscribeGames, subscribeReports, subscribeResults, subscribeTeamKits, adminUnlock, runAdvancementAll, purgePublicStartingFive } from "../cloud.js";
import { PALETTE } from "../schedule/ScheduleGrid.jsx";
import { resolveKit, teamKitsFor } from "../kits.js";
import { KitSwatch } from "../KitSwatch.jsx";
import { flagFor } from "../flags.js";
import { useEvent } from "../eventContext.js";
import SchedulePDF from "../pdf/SchedulePDF.jsx";

function parseDate(s) {
  const [d, m, y] = String(s).split("/").map(Number);
  return new Date(2000 + (y || 0), (m || 1) - 1, d || 1);
}
function dayLabel(s) {
  const dt = parseDate(s);
  const wd = dt.toLocaleDateString("en-US", { weekday: "short" });
  const mo = dt.toLocaleDateString("en-US", { month: "short" });
  return `${wd} ${dt.getDate()} ${mo}`;
}

export default function MatchList({ me }) {
  const nav = useNavigate();
  const { eventId, event, isAdmin, archived, canScore } = useEvent();
  const base = `/e/${eventId}`;
  const [games, setGames] = useState([]);
  const [reports, setReports] = useState({});
  const [court, setCourt] = useState(() => localStorage.getItem("fb_court") || "all");
  const [day, setDay] = useState(() => localStorage.getItem("fb_day") || "all");
  const [q, setQ] = useState("");
  const [teamKits, setTeamKits] = useState({});
  // Grid (day × time × court, like Schedule → Arrange) or the card list.
  const [view, setView] = useState(() => { try { return localStorage.getItem("fb_games_view") || "grid"; } catch (_) { return "grid"; } });
  const pickView = (v) => { setView(v); try { localStorage.setItem("fb_games_view", v); } catch (_) { /* private mode */ } };
  const [results, setResults] = useState({});
  useEffect(() => subscribeResults((list) => setResults(Object.fromEntries(list.map((r) => [r.id, r])))), [eventId]);
  // Starting fives are internal: remove any that older versions published.
  useEffect(() => {
    if (!canScore || archived) return;
    const leaked = Object.values(results).filter((r) => r.startingFive);
    if (leaked.length) purgePublicStartingFive(leaked).catch(() => {});
  }, [results, canScore, archived]);
  useEffect(() => subscribeTeamKits(setTeamKits), [eventId]);

  // Short names come from the game (if published with one) or the event's team
  // entries (so setting a short name reflects even on already-published games).
  const shortOf = useMemo(() => {
    const m = {};
    (event?.entries || []).forEach((e) => { if (e?.short && e.short.trim()) m[e.name] = e.short.trim(); });
    return m;
  }, [event]);
  const teamLabel = (t) => String((t?.short || shortOf[t?.name] || t?.name || "")).split(" - ")[0];

  useEffect(() => {
    const u1 = subscribeGames(setGames);
    const u2 = subscribeReports(setReports);
    return () => { u1(); u2(); };
  }, []);

  const courts = useMemo(
    () => [...new Set(games.map((m) => m.court))].sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true })),
    [games]
  );
  const days = useMemo(
    () => [...new Set(games.map((m) => m.date))].sort((a, b) => parseDate(a) - parseDate(b)),
    [games]
  );

  const nq = q.trim().toLowerCase();
  const num = nq.replace(/^#/, ""); // allow "#6" as well as "6"
  const matchesQuery = (m) => {
    if (!nq) return true;
    return (num && String(m.nr).includes(num))
      || (m.teamA?.name || "").toLowerCase().includes(nq)
      || (m.teamB?.name || "").toLowerCase().includes(nq)
      || (m.category || "").toLowerCase().includes(nq);
  };
  const shown = games
    .filter((m) => (court === "all" || String(m.court) === String(court)) && (day === "all" || m.date === day) && matchesQuery(m))
    .sort((a, b) => parseDate(a.date) - parseDate(b.date) || String(a.time).localeCompare(b.time) || a.nr - b.nr);

  // Category colours from ALL games (same order as Schedule → Arrange), so a
  // category keeps its colour whatever the day / court / search filter.
  const allCategories = useMemo(() => [...new Set(games.map((g) => g.category))], [games]);

  const pickCourt = (c) => { setCourt(c); localStorage.setItem("fb_court", c); };
  const pickDay = (d) => { setDay(d); localStorage.setItem("fb_day", d); };

  // Print / save the schedule (respects the current day/court/search filters).
  const downloadSchedule = async () => {
    const blob = await pdf(<SchedulePDF games={shown} event={event} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Schedule-${(event?.name || "event").replace(/[^\w]+/g, "-")}.pdf`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <>
      <div className="filter-bar">
        <input className="game-search" value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="Search by game # or team…" aria-label="Search games" />
        {q && <button className="filter-pill" onClick={() => setQ("")}>Clear</button>}
        <button className="filter-pill" onClick={downloadSchedule} title="Print / save the schedule as PDF">🖨 PDF</button>
        {isAdmin && !archived && (
          <button className="filter-pill" title="Fill knockout games with the teams that qualified (winners / group ranking)"
            onClick={async () => {
              try { const n = await runAdvancementAll({ silent: false }); alert(n ? `Advanced ${n} game slot(s).` : "Nothing to advance yet — finish the feeding games first."); }
              catch (e) { alert("Advance failed: " + (e?.code || e?.message || e)); }
            }}>↻ Advance bracket</button>
        )}
      </div>

      <div className="filter-bar">
        <span className="filter-label">Day</span>
        <button className={`filter-pill ${day === "all" ? "active" : ""}`} onClick={() => pickDay("all")}>All</button>
        {days.map((d) => (
          <button key={d} className={`filter-pill ${day === d ? "active" : ""}`} onClick={() => pickDay(d)}>{dayLabel(d)}</button>
        ))}
      </div>
      <div className="filter-bar">
        <span className="filter-label">Court</span>
        <button className={`filter-pill ${court === "all" ? "active" : ""}`} onClick={() => pickCourt("all")}>All</button>
        {courts.map((c) => (
          <button key={c} className={`filter-pill ${String(court) === String(c) ? "active" : ""}`} onClick={() => pickCourt(c)}>Court {c}</button>
        ))}
      </div>

      <div className="filter-bar">
        <div className="seg">
          <button className={`seg-btn ${view === "grid" ? "on" : ""}`} onClick={() => pickView("grid")}>Grid</button>
          <button className={`seg-btn ${view === "list" ? "on" : ""}`} onClick={() => pickView("list")}>List</button>
        </div>
      </div>

      {shown.length === 0 && <div className="empty">No games for this filter.</div>}
      {view === "grid" && <GamesGrid games={shown} allCategories={allCategories} courts={court === "all" ? courts : [court]} reports={reports} results={results}
        teamLabel={teamLabel} teamKits={teamKits} onOpen={(m) => nav(`${base}/game/${m.id}`)} />}
      {view === "list" && <div className="card-grid">
      {shown.map((m) => {
        const rep = reports[m.id] || {};
        const st = rep.status || "not_started";
        const locked = rep.lockedBy || null;
        const inProgress = st === "in_progress";
        const stateLabel = st === "submitted" ? "Submitted"
          : inProgress ? `In progress · ${locked?.name || "…"}`
          : "Not started";
        const canUnlock = isAdmin && !archived && locked && locked.uid !== me.uid && st !== "submitted";
        return (
          <div className="match-card" key={m.id} onClick={() => nav(`${base}/game/${m.id}`)}>
            <div className="mc-top">
              <span className="tag">#{m.nr}</span>
              <span className="tag day">{dayLabel(m.date)}</span>
              <span>{m.time}</span>
              <span className="tag">Court {m.court}</span>
              <span>{m.round}</span>
              <span className="tag">{m.category}</span>
              <span className={`state ${st === "submitted" ? "submitted" : inProgress ? "progress" : "none"}`}>
                {inProgress && <span className="live-dot" />}{stateLabel}
              </span>
              {canUnlock && (
                <button className="btn danger sm" onClick={(e) => { e.stopPropagation(); adminUnlock(m.id); }}>Unlock</button>
              )}
            </div>
            <div className="mc-teams">
              <KitSwatch kit={resolveKit(m.kit?.A, teamKitsFor(teamKits, m.teamA.name, m.category))} />
              <span className="flag">{flagFor(m.teamA.name)}</span>{teamLabel(m.teamA)}
              <span className="vs">vs</span>
              <KitSwatch kit={resolveKit(m.kit?.B, teamKitsFor(teamKits, m.teamB.name, m.category))} />
              <span className="flag">{flagFor(m.teamB.name)}</span>{teamLabel(m.teamB)}
            </div>
          </div>
        );
      })}
      </div>}
    </>
  );
}

// Read-only timetable of the games: one table per day, a row per start time,
// a column per court. Click a game to open its report.
function GamesGrid({ games, allCategories, courts, reports, results, teamLabel, teamKits, onOpen }) {
  const cats = allCategories;
  const catColor = (c) => PALETTE[Math.max(0, cats.indexOf(c)) % PALETTE.length];
  const toMin = (t) => { const [h, mm] = String(t || "").split(":").map(Number); return (h || 0) * 60 + (mm || 0); };
  const days = [...new Set(games.map((g) => g.date))].sort((a, b) => parseDate(a) - parseDate(b));
  return days.map((date) => {
    const dayGames = games.filter((g) => g.date === date);
    const times = [...new Set(dayGames.map((g) => g.time))].sort((a, b) => toMin(a) - toMin(b));
    return (
      <div className="ag-day" key={date}>
        <div className="day-head" style={{ position: "static" }}>{dayLabel(date)}</div>
        <div className="ag-grid-wrap">
          <table className="ag-grid">
            <thead><tr><th className="ag-th-time" />{courts.map((c) => <th key={c} className="ag-th-court">Court {c}</th>)}</tr></thead>
            <tbody>
              {times.map((time) => (
                <tr key={time}>
                  <td className="ag-time">{time}</td>
                  {courts.map((c) => (
                    <td key={c} className="ag-cell">
                      {dayGames.filter((g) => g.time === time && String(g.court) === String(c)).map((g) => {
                        const st = reports[g.id]?.status || "not_started";
                        const r = results[g.id] || {};
                        const score = (Number(r.setsA) || 0) + (Number(r.setsB) || 0) > 0 ? `${r.setsA}–${r.setsB}` : "";
                        return (
                          <div key={g.id} className={`ag-card gg-card gg-${st}`} style={{ borderLeftColor: catColor(g.category) }} onClick={() => onOpen(g)}
                            title={`${g.category} · ${g.round}`}>
                            <div className="ag-card-cat" style={{ color: catColor(g.category) }}>#{g.nr} · {g.category}</div>
                            <div className="ag-card-teams">
                              <KitSwatch kit={resolveKit(g.kit?.A, teamKitsFor(teamKits, g.teamA?.name, g.category))} size={11} />{teamLabel(g.teamA)}
                              <span className="muted-sm"> {score || "v"} </span>
                              <KitSwatch kit={resolveKit(g.kit?.B, teamKitsFor(teamKits, g.teamB?.name, g.category))} size={11} />{teamLabel(g.teamB)}
                            </div>
                            <div className="ag-card-round muted-sm">
                              {g.round}
                              {st === "in_progress" && <span className="gg-state live"><span className="live-dot" /> live</span>}
                              {st === "submitted" && <span className="gg-state done">✓</span>}
                            </div>
                          </div>
                        );
                      })}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  });
}
