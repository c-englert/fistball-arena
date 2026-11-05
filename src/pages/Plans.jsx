import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import { subscribeGames, subscribeReferees, subscribeTeamKits, subscribeRefKits } from "../cloud.js";
import { KitSwatch } from "../KitSwatch.jsx";
import { flagFor } from "../flags.js";
import { useEvent } from "../eventContext.js";
import { SLOT_LABEL } from "../officials/rules.js";
import { teamPlans, officialPlans, planDays, refSchedule } from "../officials/plans.js";
import PlansPDF from "../pdf/PlansPDF.jsx";

// Plans for handing out: which uniform each team wears in which game, and
// each official's day — every round with their role, court, game and referee
// shirt colour, or "free". Readable by every event member; print or PDF.

const parseDate = (s) => { const [d, m, y] = String(s).split("/").map(Number); return new Date(2000 + (y || 0), (m || 1) - 1, d || 1); };
const dayLabel = (s) => { const dt = parseDate(s); return `${dt.toLocaleDateString("en-US", { weekday: "short" })} ${dt.getDate()} ${dt.toLocaleDateString("en-US", { month: "short" })}`; };
const shortTeam = (t) => String(t?.name || t || "").split(" - ")[0];
const fileSafe = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");

export default function Plans() {
  const { event } = useEvent();
  const [games, setGames] = useState([]);
  const [refs, setRefs] = useState([]);
  const [teamKits, setTeamKits] = useState({});
  const [refKits, setRefKits] = useState([]);
  const [params] = useSearchParams();
  const [view, setView] = useState(() => (["teams", "officials", "schedule"].includes(params.get("view")) ? params.get("view") : "teams"));
  const [who, setWho] = useState("all");
  const [day, setDay] = useState(() => params.get("day") || "");
  const [court, setCourt] = useState(() => params.get("court") || "all");
  const [busy, setBusy] = useState(false);

  useEffect(() => subscribeGames(setGames), []);
  useEffect(() => subscribeReferees(setRefs), []);
  useEffect(() => subscribeTeamKits(setTeamKits), []);
  useEffect(() => subscribeRefKits(setRefKits), []);

  const days = useMemo(() => planDays(games), [games]);
  const theDay = days.includes(day) ? day : days[0] || "";
  // The referees' schedule can also span all days (e.g. everything on court 3).
  const schedDay = day === "all" ? "all" : theDay;
  const courts = useMemo(() => [...new Set(games.map((g) => String(g.court ?? "")).filter(Boolean))].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [games]);
  const schedTitle = [schedDay === "all" ? "All days" : dayLabel(schedDay), court !== "all" ? `Court ${court}` : ""].filter(Boolean).join(" · ");
  const teams = useMemo(() => teamPlans(games, teamKits), [games, teamKits]);
  const officials = useMemo(() => officialPlans(games, refs, refKits, theDay), [games, refs, refKits, theDay]);
  const schedule = useMemo(() => refSchedule(games, schedDay, court), [games, schedDay, court]);
  const hasR2 = schedule.some((r) => r.games.some((g) => String(g.refs?.r2 ?? "").trim()));

  const list = view === "teams" ? teams : view === "officials" ? officials.plans : [];
  const shown = view === "schedule" ? schedule : who === "all" ? list : list.filter((x) => x.key === who);

  const downloadPdf = async () => {
    setBusy(true);
    try {
      const doc = view === "teams"
        ? <PlansPDF event={event} teams={shown} />
        : view === "schedule"
          ? <PlansPDF event={event} schedule={schedule} hasR2={hasR2} title={schedTitle} allDays={schedDay === "all"} />
          : <PlansPDF event={event} officials={shown} rounds={officials.rounds.length} day={theDay} />;
      const blob = await pdf(doc).toBlob();
      const one = view !== "schedule" && who !== "all" && shown[0] ? (view === "teams" ? `${shown[0].name}-${shown[0].category}` : shown[0].name) : "";
      const name = ["Plan", event?.name, view === "teams" ? "uniforms" : view === "schedule" ? `referees-${schedDay === "all" ? "all-days" : schedDay.replace(/\//g, "-")}${court !== "all" ? `-court-${court}` : ""}` : `officials-${theDay.replace(/\//g, "-")}`, one].map(fileSafe).filter(Boolean).join("_");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${name}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { alert("Could not create the PDF: " + (e?.message || e)); }
    setBusy(false);
  };

  return (
    <>
      <h2 className="page-h no-print">Plans</h2>
      <div className="plan-bar no-print">
        <span className="filter-pill-group">
          <button className={`filter-pill ${view === "teams" ? "active" : ""}`} onClick={() => { setView("teams"); setWho("all"); }}>Teams — uniforms</button>
          <button className={`filter-pill ${view === "officials" ? "active" : ""}`} onClick={() => { setView("officials"); setWho("all"); }}>Officials — day plan</button>
          <button className={`filter-pill ${view === "schedule" ? "active" : ""}`} onClick={() => { setView("schedule"); setWho("all"); }}>Referees — day schedule</button>
        </span>
        {view !== "schedule" && <select className="ag-role" value={who} onChange={(e) => setWho(e.target.value)} aria-label={view === "teams" ? "Team" : "Official"}>
          <option value="all">{view === "teams" ? "All teams" : "All officials"}</option>
          {list.map((x) => <option key={x.key} value={x.key}>{view === "teams" ? `${shortTeam(x)}${x.category ? ` — ${x.category}` : ""}` : x.name}</option>)}
        </select>}
        {view !== "teams" && (
          <select className="ag-role" value={view === "schedule" ? schedDay : theDay} onChange={(e) => setDay(e.target.value)} aria-label="Day">
            {view === "schedule" && <option value="all">All days</option>}
            {days.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
          </select>
        )}
        {view === "schedule" && (
          <select className="ag-role" value={court} onChange={(e) => setCourt(e.target.value)} aria-label="Court">
            <option value="all">All courts</option>
            {courts.map((c) => <option key={c} value={c}>Court {c}</option>)}
          </select>
        )}
        <button className="btn sm" onClick={() => window.print()}>Print</button>
        <button className="btn sm" onClick={downloadPdf} disabled={busy || !shown.length}>{busy ? "Creating PDF…" : "PDF"}</button>
      </div>
      <p className="muted-sm no-print">{view === "teams"
        ? "Which uniform each team wears in which game (set on the Uniforms page). Print / PDF: one page per team."
        : view === "schedule"
          ? "Games round by round with their referees — to tell the teams when and where their referee is needed. Pick a day (or all days) and a court."
          : "Every round of the day for each official: role, court, game and referee shirt colour — or free. Print / PDF: one page per official."}</p>

      {shown.length === 0 && <div className="empty">{view === "teams" ? "No games with teams yet." : view === "schedule" ? "No games for this day / court." : "No officials yet."}</div>}

      {view === "schedule" && shown.length > 0 && (
        <section className="card plan-card">
          <h3 className="plan-title">Referees · {schedTitle}</h3>
          <div className="grid-scroll">
            <table className="ref-grid plan-table">
              <thead><tr><th>#</th><th>Time</th><th>Court</th><th>Match</th><th>Referee{hasR2 ? " 1" : ""}</th>{hasR2 && <th>Referee 2</th>}<th>Category</th><th>Round</th><th>Best of</th></tr></thead>
              <tbody>
                {schedule.map(({ date, time, games: list }, ri) => [
                  schedDay === "all" && schedule[ri - 1]?.date !== date
                    ? <tr key={"d" + date} className="plan-dayrow"><td colSpan={hasR2 ? 9 : 8}><b>{dayLabel(date)}</b></td></tr> : null,
                  ...list.map((g, i) => (
                  <tr key={g.id} className={i === 0 ? "plan-round" : ""}>
                    <td>#{g.nr}</td>
                    <td>{i === 0 ? <b>{time}</b> : ""}</td>
                    <td>{g.court}</td>
                    <td><span className="flag">{flagFor(g.teamA?.name)}</span>{shortTeam(g.teamA)} <span className="muted-sm">v</span> <span className="flag">{flagFor(g.teamB?.name)}</span>{shortTeam(g.teamB)}</td>
                    <td><b>{g.refs?.r1 || <span className="muted-sm">—</span>}</b></td>
                    {hasR2 && <td>{g.refs?.r2 || <span className="muted-sm">—</span>}</td>}
                    <td>{g.category}</td>
                    <td>{g.round}{g.group ? ` · Group ${g.group}` : ""}</td>
                    <td>{g.bestOf}</td>
                  </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {view === "teams" && shown.map((t) => (
        <section key={t.key} className="card plan-card">
          <h3 className="plan-title"><span className="flag">{flagFor(t.name)}</span>{shortTeam(t)}{t.category && <span className="muted-sm"> · {t.category}</span>}</h3>
          <table className="ref-grid plan-table">
            <thead><tr><th>Day</th><th>Time</th><th>Court</th><th>Game</th><th>Opponent</th><th>Uniform</th></tr></thead>
            <tbody>
              {t.rows.map(({ g, opponent, kit }, i) => (
                <tr key={g.id}>
                  <td>{t.rows[i - 1]?.g.date === g.date ? "" : dayLabel(g.date)}</td>
                  <td>{g.time}</td>
                  <td>{g.court}</td>
                  <td>#{g.nr} <span className="muted-sm">{g.round}</span></td>
                  <td><span className="flag">{flagFor(opponent?.name)}</span>{shortTeam(opponent)}</td>
                  <td>{kit ? <><KitSwatch kit={kit} size={14} /> Uniform {kit.n || ""}</> : <span className="muted-sm">not set</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}

      {view === "officials" && shown.map((o) => (
        <section key={o.key} className="card plan-card">
          <h3 className="plan-title"><span className="flag">{flagFor(o.country)}</span>{o.name}
            <span className="muted-sm"> · {dayLabel(theDay)} · {o.onDuty} of {officials.rounds.length} rounds on duty</span></h3>
          <table className="ref-grid plan-table">
            <thead><tr><th>Time</th><th>Role</th><th>Court</th><th>Game</th><th>Shirt</th></tr></thead>
            <tbody>
              {o.rows.map(({ time, duties }) => (!duties.length
                ? <tr key={time} className="plan-free"><td>{time}</td><td colSpan={4} className="muted-sm">free</td></tr>
                : duties.map((d, i) => (
                  <tr key={time + i}>
                    <td>{i === 0 ? time : ""}</td>
                    <td><b>{SLOT_LABEL[d.slot]}</b></td>
                    <td>{d.courts.join(", ")}</td>
                    <td>{d.games.map((g) => (
                      <div key={g.id}>#{g.nr} {g.category && <b className="plan-cat">{g.category}</b>} <span className="flag">{flagFor(g.teamA?.name)}</span>{shortTeam(g.teamA)} <span className="muted-sm">v</span> <span className="flag">{flagFor(g.teamB?.name)}</span>{shortTeam(g.teamB)}</div>
                    ))}</td>
                    <td>{d.shirts.length ? d.shirts.map((r) => <span key={r.id} className="plan-shirt"><KitSwatch kit={{ colors: [r.shirt] }} size={14} /> {r.name}</span>) : <span className="muted-sm">—</span>}</td>
                  </tr>
                ))))}
            </tbody>
          </table>
        </section>
      ))}
    </>
  );
}
