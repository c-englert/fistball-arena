import { useEffect, useMemo, useRef, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { subscribeGames, subscribeResults, subscribeRosters, subscribeReferees, fetchReports, saveFinalReportFields, rosterKey } from "../cloud.js";
import { useEvent } from "../eventContext.js";
import { flagFor } from "../flags.js";
import { isPlaceholder } from "../schedule/advance.js";
import { finalRanking, genderOf, gameMinutes, durationByBestOf, cardsByCategory, realTeams } from "../report/finalReport.js";
import { SumulasPDF } from "../pdf/SumulaPDF.jsx";

// Reports: the event's final report (print / Word) and every game report
// (súmula) of one team in a single PDF.

const fileSafe = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
const short = (n) => String(n || "").split(" - ")[0];
const GENDERS = ["Women", "Men", "Other"];
const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };
const fmtMin = (m) => (m == null ? "—" : `${Math.floor(m / 60) ? `${Math.floor(m / 60)} h ` : ""}${Math.round(m % 60)} min`);
const byNr = (a, b) => (Number(a.nr) || 0) - (Number(b.nr) || 0);

export default function Reports() {
  const { event, branding } = useEvent();
  const [view, setView] = useState("final");
  const [games, setGames] = useState([]);
  const [results, setResults] = useState([]);
  const [rosters, setRosters] = useState({});
  const [refs, setRefs] = useState([]);
  const [reports, setReports] = useState(null);

  useEffect(() => subscribeGames(setGames), []);
  useEffect(() => subscribeResults(setResults), []);
  useEffect(() => subscribeRosters(setRosters), []);
  useEffect(() => subscribeReferees(setRefs), []);
  const loadReports = () => fetchReports().then(setReports).catch((e) => { console.warn(e); setReports([]); });
  useEffect(() => { loadReports(); }, []);

  return (
    <>
      <h2 className="page-h no-print">Reports</h2>
      <div className="plan-bar no-print">
        <span className="filter-pill-group">
          <button className={`filter-pill ${view === "final" ? "active" : ""}`} onClick={() => setView("final")}>Event final report</button>
          <button className={`filter-pill ${view === "team" ? "active" : ""}`} onClick={() => setView("team")}>Game reports by team</button>
        </span>
      </div>
      {view === "final"
        ? <FinalReport event={event} games={games} results={results} rosters={rosters} refs={refs} reports={reports} />
        : <TeamReports event={event} branding={branding} games={games} reports={reports} reload={loadReports} />}
    </>
  );
}

/* ---------------- event final report ---------------- */
function FinalReport({ event, games, results, rosters, refs, reports }) {
  const docRef = useRef(null);
  const saved = event?.finalReport || {};
  const [fields, setFields] = useState({ host: "", technical: "", notes: "", ...saved });
  const [dirty, setDirty] = useState(false);
  useEffect(() => { if (!dirty) setFields({ host: "", technical: "", notes: "", ...(event?.finalReport || {}) }); }, [event?.finalReport]);
  const set = (k) => (e) => { setFields((f) => ({ ...f, [k]: e.target.value })); setDirty(true); };
  const save = async () => {
    try { await saveFinalReportFields({ host: fields.host || "", technical: fields.technical || "", notes: fields.notes || "" }); setDirty(false); }
    catch (e) { alert("Could not save: " + (e?.message || e)); }
  };

  const data = useMemo(() => {
    const cats = [...new Set(results.map((r) => r.category).filter(Boolean))]
      .sort((a, b) => GENDERS.indexOf(genderOf(a)) - GENDERS.indexOf(genderOf(b)) || a.localeCompare(b));
    const gameById = Object.fromEntries(games.map((g) => [g.id, g]));
    const repById = Object.fromEntries((reports || []).map((r) => [r.id, r]));
    const cards = cardsByCategory(results);
    const perCat = cats.map((cat) => {
      const res = results.filter((r) => r.category === cat);
      const teams = realTeams(res);
      let players = 0, staff = 0;
      for (const t of teams) {
        const ro = rosters[rosterKey(`${t} - ${cat}`)] || rosters[rosterKey(t)];
        players += (ro?.players || []).length;
        staff += (ro?.staff || []).length;
      }
      const real = res.filter((r) => !isPlaceholder(r.teamA) && !isPlaceholder(r.teamB));
      return {
        cat, gender: genderOf(cat), teams: teams.length, players, staff,
        played: res.filter((r) => r.status === "Finished").length, scheduled: real.length,
        cards: cards[cat] || { y: 0, yr: 0, r: 0 },
        ranking: finalRanking(res),
      };
    });
    const durations = durationByBestOf(results.filter((r) => r.status === "Finished").map((r) => {
      const g = gameById[r.id] || r;
      return { bestOf: r.bestOf || g.bestOf, length: reports ? gameMinutes(repById[r.id], g) : null };
    }));
    const sum = (k) => perCat.reduce((s, c) => s + c[k], 0);
    const total = {
      teams: sum("teams"), players: sum("players"), staff: sum("staff"), played: sum("played"), scheduled: sum("scheduled"),
      cards: perCat.reduce((s, c) => ({ y: s.y + c.cards.y, yr: s.yr + c.cards.yr, r: s.r + c.cards.r }), { y: 0, yr: 0, r: 0 }),
    };
    return { perCat, durations, total };
  }, [games, results, rosters, reports]);

  const anyEstimated = data.durations.some((d) => d.estimated.n);
  const title = `Event final report — ${event?.name || ""}`;

  const downloadWord = () => {
    const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word"><head><meta charset="utf-8"><title>${title}</title>
<style>body{font-family:Calibri,Arial,sans-serif;font-size:11pt}h1{font-size:18pt}h2{font-size:13pt;margin-top:16pt}h3{font-size:11pt}
table{border-collapse:collapse;margin:4pt 0}td,th{border:1px solid #999;padding:3pt 6pt;text-align:left;vertical-align:top}th{background:#eceef3}.fr-num{text-align:right}</style></head>
<body>${docRef.current?.innerHTML || ""}</body></html>`;
    const blob = new Blob(["﻿", html], { type: "application/msword" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${fileSafe(`Final-report-${event?.name || "event"}`)}.doc`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };

  return (
    <>
      <section className="card no-print fr-edit">
        <div className="fr-edit-grid">
          <label>Host<input className="fr-input" value={fields.host} onChange={set("host")} placeholder="e.g. Federación Chilena de Fistball" /></label>
          <label>Technical responsible<input className="fr-input" value={fields.technical} onChange={set("technical")} placeholder="e.g. Technical delegate's name" /></label>
        </div>
        <label>Notes — what happened (shown at the end of the report)<textarea className="fr-input" rows={4} value={fields.notes} onChange={set("notes")} /></label>
        <div className="fr-actions">
          <button className="btn sm primary" onClick={save} disabled={!dirty}>{dirty ? "Save" : "Saved"}</button>
          <span className="spacer" />
          <button className="btn sm" onClick={() => window.print()}>Print / PDF</button>
          <button className="btn sm" onClick={downloadWord}>Word (.doc)</button>
        </div>
      </section>

      <section className="card fr-doc" ref={docRef}>
        <h1>{title}</h1>
        <table className="fr-table">
          <tbody>
            <tr><th>1. Event</th><td>{event?.name || "—"}</td></tr>
            <tr><th>2. Dates</th><td>{event?.dates || [event?.startDate, event?.endDate].filter(Boolean).join(" – ") || "—"}</td></tr>
            <tr><th>3. Venue</th><td>{[event?.place, event?.address].filter(Boolean).join(" · ") || "—"}</td></tr>
            <tr><th>4. Host</th><td>{fields.host || "—"}</td></tr>
            <tr><th>4. Technical responsible</th><td>{fields.technical || "—"}</td></tr>
          </tbody>
        </table>

        <h2>5. Categories</h2>
        {GENDERS.map((gen) => {
          const list = data.perCat.filter((c) => c.gender === gen);
          return list.length ? <p key={gen}><b>{gen}:</b> {list.map((c) => c.cat).join(", ")}</p> : null;
        })}

        <h2>6–8. Teams, players, officials and games</h2>
        <table className="fr-table">
          <thead><tr><th>Category</th><th>Teams</th><th>Players</th><th>Team officials</th><th>Games played</th></tr></thead>
          <tbody>
            {data.perCat.map((c) => (
              <tr key={c.cat}><td>{c.cat}</td><td className="fr-num">{c.teams}</td><td className="fr-num">{c.players}</td><td className="fr-num">{c.staff}</td>
                <td className="fr-num">{c.played}{c.scheduled > c.played ? ` of ${c.scheduled}` : ""}</td></tr>
            ))}
            <tr className="fr-total"><td><b>Total</b></td><td className="fr-num"><b>{data.total.teams}</b></td><td className="fr-num"><b>{data.total.players}</b></td><td className="fr-num"><b>{data.total.staff}</b></td>
              <td className="fr-num"><b>{data.total.played}</b>{data.total.scheduled > data.total.played ? ` of ${data.total.scheduled}` : ""}</td></tr>
          </tbody>
        </table>
        <p>Referees: <b>{refs.length}</b> · Players + team officials: <b>{data.total.players + data.total.staff}</b></p>

        <h2>9. Disciplinary — cards</h2>
        <table className="fr-table">
          <thead><tr><th>Category</th><th>Yellow</th><th>Yellow-red</th><th>Red</th><th>Total</th></tr></thead>
          <tbody>
            {data.perCat.map((c) => (
              <tr key={c.cat}><td>{c.cat}</td><td className="fr-num">{c.cards.y}</td><td className="fr-num">{c.cards.yr}</td><td className="fr-num">{c.cards.r}</td><td className="fr-num">{c.cards.y + c.cards.yr + c.cards.r}</td></tr>
            ))}
            <tr className="fr-total"><td><b>Total</b></td><td className="fr-num"><b>{data.total.cards.y}</b></td><td className="fr-num"><b>{data.total.cards.yr}</b></td><td className="fr-num"><b>{data.total.cards.r}</b></td>
              <td className="fr-num"><b>{data.total.cards.y + data.total.cards.yr + data.total.cards.r}</b></td></tr>
          </tbody>
        </table>

        <h2>10. Average game length</h2>
        {reports === null ? <p>Loading…</p> : (
          <>
            <table className="fr-table">
              <thead><tr><th>Best of</th><th>Games</th><th>Average</th><th>Based on</th></tr></thead>
              <tbody>
                {data.durations.map((d) => {
                  const use = d.measured.n ? d.measured : d.estimated;
                  return (
                    <tr key={d.bestOf}><td>Best of {d.bestOf || "?"}</td><td className="fr-num">{d.games}</td>
                      <td className="fr-num">{use.n ? `${d.measured.n ? "" : "≈ "}${fmtMin(use.avg)}` : "—"}</td>
                      <td>{d.measured.n ? `${d.measured.n} games timed (first to last point)` : d.estimated.n ? `${d.estimated.n} games, estimated*` : "no times recorded"}</td></tr>
                  );
                })}
              </tbody>
            </table>
            {anyEstimated && <p className="fr-foot">* Estimated from the scheduled start to the moment the game report was submitted, so delays before the start and the time to sign are included. From now on, Arena records each game's real length (first to last point) automatically.</p>}
          </>
        )}

        <h2>11. Final ranking</h2>
        {GENDERS.map((gen) => {
          const list = data.perCat.filter((c) => c.gender === gen && c.ranking);
          if (!list.length) return null;
          return (
            <div key={gen}>
              <h3>{gen}</h3>
              <div className="fr-rank-grid">
                {list.map((c) => (
                  <table key={c.cat} className="fr-table fr-rank">
                    <thead><tr><th colSpan={2}>{c.cat}{c.ranking.decided ? (c.ranking.complete ? "" : " (provisional)") : " (final not played yet)"}</th></tr></thead>
                    <tbody>
                      {c.ranking.rows.map((x) => (
                        <tr key={x.team}><td className="fr-num">{c.ranking.decided ? (MEDAL[x.pos] ? `${MEDAL[x.pos]} ${x.pos}` : x.pos) : "–"}</td><td>{flagFor(x.team)} {short(x.team)}</td></tr>
                      ))}
                    </tbody>
                  </table>
                ))}
              </div>
            </div>
          );
        })}

        {fields.notes?.trim() && (<><h2>Notes</h2><p className="fr-notes">{fields.notes}</p></>)}
      </section>
    </>
  );
}

/* ---------------- game reports by team ---------------- */
function TeamReports({ event, branding, games, reports, reload }) {
  const teams = useMemo(() => {
    const m = new Map();
    for (const g of games) for (const t of [g.teamA?.name, g.teamB?.name]) {
      if (!t || isPlaceholder(t)) continue;
      const key = `${t}|${g.category || ""}`;
      if (!m.has(key)) m.set(key, { key, name: t, category: g.category || "" });
    }
    return [...m.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [games]);
  const [key, setKey] = useState("");
  const [onlyDone, setOnlyDone] = useState(true);
  const [busy, setBusy] = useState(false);
  const team = teams.find((t) => t.key === key) || teams[0];
  const repById = useMemo(() => Object.fromEntries((reports || []).map((r) => [r.id, r])), [reports]);
  const list = useMemo(() => !team ? [] : games
    .filter((g) => (g.category || "") === team.category && (g.teamA?.name === team.name || g.teamB?.name === team.name))
    .sort(byNr), [games, team]);
  const printable = list.filter((g) => repById[g.id] && (!onlyDone || repById[g.id].status === "submitted"));

  const download = async () => {
    setBusy(true);
    try {
      await reload();
      const drafts = printable.map((g) => {
        const r = repById[g.id];
        const susp = r.suspensions || {};
        const mark = (side) => ({
          ...r[side],
          players: (r[side]?.players || []).map((p) => ({ ...p, suspended: !!p.suspended || (susp[side] || []).includes(`${p.nr}|${p.name}|${p.first}`) })),
          staff: r[side]?.staff || [],
        });
        return {
          ...r,
          info: { ...(r.info || {}), nr: g.nr, date: g.date, time: g.time, court: g.court },
          teamA: mark("teamA"), teamB: mark("teamB"),
          timeouts: r.timeouts || { teamA: [], teamB: [] },
          ballChoice: r.ballChoice || { set1: "", set5: "" },
          referees: r.referees || {},
          signatures: { capA: false, capB: false, referee: false, clerk: false, ...(r.signatures || {}) },
          amendments: r.amendments || [],
          sets: r.sets || [],
        };
      });
      const blob = await pdf(<SumulasPDF drafts={drafts} event={event} branding={branding} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${fileSafe(`Game-reports-${short(team.name)}-${team.category}`)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { alert("Could not create the PDF: " + (e?.message || e)); }
    setBusy(false);
  };

  if (!teams.length) return <div className="empty">No games with teams yet.</div>;
  return (
    <section className="card">
      <div className="plan-bar">
        <select className="ag-role" value={team?.key || ""} onChange={(e) => setKey(e.target.value)} aria-label="Team">
          {teams.map((t) => <option key={t.key} value={t.key}>{short(t.name)}{t.category ? ` — ${t.category}` : ""}</option>)}
        </select>
        <label className="muted-sm"><input type="checkbox" checked={onlyDone} onChange={(e) => setOnlyDone(e.target.checked)} /> Submitted reports only</label>
        <button className="btn sm primary" onClick={download} disabled={busy || reports === null || !printable.length}>
          {busy ? "Creating PDF…" : `PDF — ${printable.length} game report${printable.length === 1 ? "" : "s"}`}
        </button>
      </div>
      <p className="muted-sm">All game reports (súmulas) of the team in one PDF, one page per game, in game order — to print or send.</p>
      <table className="ref-grid plan-table">
        <thead><tr><th>#</th><th>Date</th><th>Time</th><th>Court</th><th>Round</th><th>Match</th><th>Report</th></tr></thead>
        <tbody>
          {list.map((g) => {
            const r = repById[g.id];
            const st = !r ? "not opened" : r.status === "submitted" ? "submitted" : r.amending ? "being amended" : "not submitted";
            return (
              <tr key={g.id} className={printable.includes(g) ? "" : "fr-skip"}>
                <td>#{g.nr}</td><td>{g.date}</td><td>{g.time}</td><td>{g.court}</td><td>{g.round}</td>
                <td>{flagFor(g.teamA?.name)} {short(g.teamA?.name)} <span className="muted-sm">v</span> {flagFor(g.teamB?.name)} {short(g.teamB?.name)}</td>
                <td>{reports === null ? "…" : st}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}
