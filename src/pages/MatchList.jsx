import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { subscribeGames, subscribeReports, adminUnlock } from "../cloud.js";
import { flagFor } from "../flags.js";

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

export default function MatchList({ me, onSignOut }) {
  const nav = useNavigate();
  const [games, setGames] = useState([]);
  const [reports, setReports] = useState({});
  const [court, setCourt] = useState(() => localStorage.getItem("fb_court") || "all");
  const [day, setDay] = useState(() => localStorage.getItem("fb_day") || "all");

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

  const shown = games
    .filter((m) => (court === "all" || String(m.court) === String(court)) && (day === "all" || m.date === day))
    .sort((a, b) => parseDate(a.date) - parseDate(b.date) || String(a.time).localeCompare(b.time) || a.nr - b.nr);

  const pickCourt = (c) => { setCourt(c); localStorage.setItem("fb_court", c); };
  const pickDay = (d) => { setDay(d); localStorage.setItem("fb_day", d); };

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand-logo"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <div>
          <div className="title">Fistball Arena</div>
          <div className="sub">Game reports · U18 WC &amp; Women's EFA 2026</div>
        </div>
        <div className="spacer" />
        {me.admin && <Link className="iconbtn" to="/roster" title="Players & staff">Teams</Link>}
        {me.admin && <Link className="iconbtn" to="/schedule" title="Schedule generator">Schedule</Link>}
        <button className="iconbtn" onClick={onSignOut} title="Switch user">
          {me.name}{me.admin ? " · admin" : ""}
        </button>
      </header>

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

      <div className="content">
        {shown.length === 0 && <div className="empty">No games for this filter.</div>}
        {shown.map((m) => {
          const rep = reports[m.id] || {};
          const st = rep.status || "not_started";
          const locked = rep.lockedBy || null;
          const inProgress = st === "in_progress";
          const stateLabel = st === "submitted" ? "Submitted"
            : inProgress ? `In progress · ${locked?.name || "…"}`
            : "Not started";
          const canUnlock = me.admin && locked && locked.uid !== me.uid && st !== "submitted";
          return (
            <div className="match-card" key={m.id} onClick={() => nav(`/game/${m.id}`)}>
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
                <span className="flag">{flagFor(m.teamA.name)}</span>{m.teamA.name.split(" - ")[0]}
                <span className="vs">vs</span>
                <span className="flag">{flagFor(m.teamB.name)}</span>{m.teamB.name.split(" - ")[0]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
