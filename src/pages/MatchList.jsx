import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { subscribeGames, subscribeReports, adminUnlock } from "../cloud.js";
import { flagFor } from "../flags.js";
import { useEvent } from "../eventContext.js";
import AccountMenu from "../AccountMenu.jsx";

function ManageMenu({ base }) {
  const [open, setOpen] = useState(false);
  const items = [
    ["Schedule", `${base}/schedule`],
    ["Players & staff", `${base}/roster`],
    ["Access", `${base}/members`],
    ["Settings", `${base}/settings`],
  ];
  return (
    <div className="menu-wrap">
      <button className="iconbtn" onClick={() => setOpen((o) => !o)}>Manage ▾</button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="menu-pop">
            {items.map(([label, to]) => (
              <Link key={to} className="menu-item" to={to} onClick={() => setOpen(false)}>{label}</Link>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

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
  const { eventId, event, isAdmin, archived, branding } = useEvent();
  const base = `/e/${eventId}`;
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
        <a className="brand-logo" href="#/" title="Switch event"><img src={branding?.eventLogo?.dataUrl || (import.meta.env.BASE_URL + "ifa-mark.png")} alt="" /></a>
        {(branding?.promoters || []).slice(0, 3).map((p, i) => (
          <span className="promo-logo" key={i}><img src={p.dataUrl} alt="" /></span>
        ))}
        <div>
          <div className="title">{event?.name || "Fistball Arena"}{archived && <span className="arch-badge">Archived</span>}</div>
          <div className="sub">{[event?.place, event?.dates].filter(Boolean).join(" · ") || "Game reports"}</div>
        </div>
        <div className="spacer" />
        <Link className="iconbtn" to={`${base}/standings`} title="Standings & results">Standings</Link>
        {isAdmin && <ManageMenu base={base} />}
        <AccountMenu me={me} onSignOut={onSignOut} />
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
