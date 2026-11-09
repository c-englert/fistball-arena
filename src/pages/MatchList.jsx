import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import { subscribeGames, subscribeReports, subscribeResults, subscribeTeamKits, adminUnlock, runAdvancementAll, purgePublicStartingFive, syncResultShorts, syncResultSlots } from "../cloud.js";
import { PALETTE } from "../schedule/ScheduleGrid.jsx";
import { resolveKit, teamKitsFor } from "../kits.js";
import { KitSwatch } from "../KitSwatch.jsx";
import { flagFor } from "../flags.js";
import { useEvent } from "../eventContext.js";
import SchedulePDF from "../pdf/SchedulePDF.jsx";
import { useT, useLang, tRound, currentLang, localeOf } from "../i18n.js";

function parseDate(s) {
  const [d, m, y] = String(s).split("/").map(Number);
  return new Date(2000 + (y || 0), (m || 1) - 1, d || 1);
}
function dayLabel(s) {
  const dt = parseDate(s);
  const loc = currentLang() === "en" ? "en-US" : localeOf(currentLang());
  const wd = dt.toLocaleDateString(loc, { weekday: "short" });
  const mo = dt.toLocaleDateString(loc, { month: "short" });
  return `${wd} ${dt.getDate()} ${mo}`;
}

export default function MatchList({ me }) {
  const nav = useNavigate();
  const tr = useT();
  const [lang] = useLang();
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

  // Repair public short names that drifted from the games (Fistball Live and
  // Standings show them): e.g. a team swapped into a group kept the old team's.
  useEffect(() => {
    if (!isAdmin || archived || !games.length) return;
    const want = (t) => (t?.short || shortOf[t?.name] || "").trim();
    const fixes = games.flatMap((g) => {
      const r = results[g.id];
      if (!r || r.teamA !== g.teamA?.name || r.teamB !== g.teamB?.name) return [];
      const a = want(g.teamA), b = want(g.teamB);
      return (r.teamAShort || "") !== a || (r.teamBShort || "") !== b ? [{ id: g.id, teamAShort: a, teamBShort: b }] : [];
    });
    if (fixes.length) syncResultShorts(fixes).catch((e) => console.warn("short names sync failed:", e?.code || e));
  }, [games, results, shortOf, isAdmin, archived]);

  // Repair public results whose number/day/time/court drifted from the games
  // (Fistball Live reads the results): e.g. a súmula opened before a court
  // change wrote its old court back.
  useEffect(() => {
    if (!isAdmin || archived || !games.length) return;
    const fixes = games.flatMap((g) => {
      const r = results[g.id];
      if (!r) return [];
      const want = { nr: g.nr, date: g.date || "", time: g.time || "", court: g.court ?? "" };
      return Object.keys(want).some((k) => String(r[k] ?? "") !== String(want[k] ?? "")) ? [{ id: g.id, ...want }] : [];
    });
    if (fixes.length) syncResultSlots(fixes).then((n) => console.info(`schedule sync: ${n} public result(s) fixed`)).catch((e) => console.warn("schedule sync failed:", e?.code || e));
  }, [games, results, isAdmin, archived]);

  // Self-heal the bracket: whenever a game finishes, an admin's open Games page
  // fills the knockout slots it feeds (covers submits that couldn't advance).
  const finishedKey = useMemo(() => Object.values(results).filter((r) => r.status === "Finished").map((r) => r.id).sort().join(","), [results]);
  useEffect(() => {
    if (!isAdmin || archived || !finishedKey) return;
    runAdvancementAll();
  }, [finishedKey, isAdmin, archived]);

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
          placeholder={tr("Search by game # or team…")} aria-label={tr("Search games")} />
        {q && <button className="filter-pill" onClick={() => setQ("")}>{tr("Clear")}</button>}
        <button className="filter-pill" onClick={downloadSchedule} title={tr("Print / save the schedule as PDF")}>🖨 PDF</button>
        {isAdmin && !archived && (
          <button className="filter-pill" title={tr("Fill knockout games with the teams that qualified (winners / group ranking)")}
            onClick={async () => {
              try { const n = await runAdvancementAll({ silent: false }); alert(n ? tr("Advanced {n} game slot(s).", { n }) : tr("Nothing to advance yet — finish the feeding games first.")); }
              catch (e) { alert(tr("Advance failed: ") + (e?.code || e?.message || e)); }
            }}>{tr("↻ Advance bracket")}</button>
        )}
      </div>

      <div className="filter-bar">
        <span className="filter-label">{tr("Day")}</span>
        <button className={`filter-pill ${day === "all" ? "active" : ""}`} onClick={() => pickDay("all")}>{tr("All")}</button>
        {days.map((d) => (
          <button key={d} className={`filter-pill ${day === d ? "active" : ""}`} onClick={() => pickDay(d)}>{dayLabel(d)}</button>
        ))}
      </div>
      <div className="filter-bar">
        <span className="filter-label">{tr("Court")}</span>
        <button className={`filter-pill ${court === "all" ? "active" : ""}`} onClick={() => pickCourt("all")}>{tr("All")}</button>
        {courts.map((c) => (
          <button key={c} className={`filter-pill ${String(court) === String(c) ? "active" : ""}`} onClick={() => pickCourt(c)}>{tr("Court {c}", { c })}</button>
        ))}
      </div>

      <div className="filter-bar">
        <div className="seg">
          <button className={`seg-btn ${view === "grid" ? "on" : ""}`} onClick={() => pickView("grid")}>{tr("Grid")}</button>
          <button className={`seg-btn ${view === "list" ? "on" : ""}`} onClick={() => pickView("list")}>{tr("List")}</button>
        </div>
      </div>

      {shown.length === 0 && <div className="empty">{tr("No games for this filter.")}</div>}
      {view === "grid" && <GamesGrid games={shown} allCategories={allCategories} courts={court === "all" ? courts : [court]} reports={reports} results={results}
        teamLabel={teamLabel} teamKits={teamKits} onOpen={(m) => nav(`${base}/game/${m.id}`)} />}
      {view === "list" && <div className="card-grid">
      {shown.map((m) => {
        const rep = reports[m.id] || {};
        const st = rep.status || "not_started";
        const locked = rep.lockedBy || null;
        const inProgress = st === "in_progress";
        const stateLabel = st === "submitted" ? tr("Submitted")
          : inProgress ? tr("In progress · {name}", { name: locked?.name || "…" })
          : tr("Not started");
        const canUnlock = isAdmin && !archived && locked && locked.uid !== me.uid && st !== "submitted";
        return (
          <div className="match-card" key={m.id} onClick={() => nav(`${base}/game/${m.id}`)}>
            <div className="mc-top">
              <span className="tag">#{m.nr}</span>
              <span className="tag day">{dayLabel(m.date)}</span>
              <span>{m.time}</span>
              <span className="tag">{tr("Court {c}", { c: m.court })}</span>
              <span>{tRound(lang, m.round)}</span>
              <span className="tag">{m.category}</span>
              <span className={`state ${st === "submitted" ? "submitted" : inProgress ? "progress" : "none"}`}>
                {inProgress && <span className="live-dot" />}{stateLabel}
              </span>
              {canUnlock && (
                <button className="btn danger sm" onClick={(e) => { e.stopPropagation(); adminUnlock(m.id); }}>{tr("Unlock")}</button>
              )}
            </div>
            <div className="mc-teams">
              <KitSwatch kit={resolveKit(m.kit?.A, teamKitsFor(teamKits, m.teamA.name, m.category))} />
              <span className="flag">{flagFor(m.teamA.name)}</span>{teamLabel(m.teamA)}
              <span className="vs">{tr("vs")}</span>
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
  const tr = useT();
  const [lang] = useLang();
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
            <thead><tr><th className="ag-th-time" />{courts.map((c) => <th key={c} className="ag-th-court">{tr("Court {c}", { c })}</th>)}</tr></thead>
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
                            title={`${g.category} · ${tRound(lang, g.round)}`}>
                            <div className="ag-card-cat" style={{ color: catColor(g.category) }}>#{g.nr} · {g.category}</div>
                            <div className="ag-card-teams">
                              <KitSwatch kit={resolveKit(g.kit?.A, teamKitsFor(teamKits, g.teamA?.name, g.category))} size={11} />{teamLabel(g.teamA)}
                              <span className="muted-sm"> {score || "v"} </span>
                              <KitSwatch kit={resolveKit(g.kit?.B, teamKitsFor(teamKits, g.teamB?.name, g.category))} size={11} />{teamLabel(g.teamB)}
                            </div>
                            <div className="ag-card-round muted-sm">
                              {tRound(lang, g.round)}
                              {st === "in_progress" && <span className="gg-state live"><span className="live-dot" /> {tr("live")}</span>}
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
