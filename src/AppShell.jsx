import { useEffect, useState } from "react";
import { Outlet, useNavigate, useLocation, useMatch } from "react-router-dom";
import { useEvent } from "./eventContext.js";
import { subscribeLivePointer } from "./cloud.js";
import AccountMenu from "./AccountMenu.jsx";
import LangPicker from "./LangPicker.jsx";
import { useT } from "./i18n.js";
import { IconBack, IconGames, IconStandings, IconRoster, IconSettings, IconSchedule, IconGuide, IconWhistle, IconShirt, IconClipboard, IconMap } from "./icons.jsx";

const LIVE_URL = "https://c-englert.github.io/fistball-live/";

// Left-sidebar app shell for the event context. Pages render into <Outlet/>.
export default function AppShell({ me, onSignOut }) {
  const t = useT();
  const nav = useNavigate();
  const loc = useLocation();
  const { eventId, event, isAdmin, archived } = useEvent();
  const base = `/e/${eventId}`;
  const [live, setLive] = useState(null);
  const [open, setOpen] = useState(false); // mobile drawer
  useEffect(() => subscribeLivePointer(setLive), []);
  const onAir = !!live?.ids?.has(eventId);
  const go = (to) => { setOpen(false); nav(to); };

  // active section from the sub-path (after /e/:eventId)
  const sub = loc.pathname.replace(base, "").replace(/^\//, "").split("/")[0]; // "", "standings", "game", …
  const gameMatch = useMatch("/e/:eventId/game/:id");

  const items = [
    { key: "", label: "Games", Icon: IconGames },
    { key: "standings", label: "Standings", Icon: IconStandings },
    { key: "plans", label: "Plans", Icon: IconClipboard },
    ...(isAdmin ? [
      { key: "arrange", label: "Schedule", Icon: IconSchedule },
      { key: "roster", label: "Players & staff", Icon: IconRoster },
      { key: "referees", label: "Referees", Icon: IconWhistle },
      { key: "colors", label: "Uniforms", Icon: IconShirt },
      { key: "venue", label: "Venue & training", Icon: IconMap },
      { key: "reports", label: "Reports", Icon: IconStandings },
      { key: "settings", label: "Settings", Icon: IconSettings },
    ] : []),
  ];
  const activeKey = gameMatch ? "" : sub;
  const activeLabel = (items.find((i) => i.key === activeKey) || {}).label || "";
  const evName = event?.name || t("Event");

  return (
    <div className="shell">
      <div className={`sb-scrim ${open ? "show" : ""}`} onClick={() => setOpen(false)} />
      <aside className={`sidebar ${open ? "open" : ""}`}>
        <div className="sb-eventhead">
          <button className="sb-back" onClick={() => go("/")}><IconBack size={13} /> {t("Events")}</button>
          <div className="sb-eventname">{evName}</div>
          <div className="sb-eventmeta">{[event?.place, event?.dates].filter(Boolean).join(" · ")}{archived ? ` · ${t("Archived")}` : ""}</div>
          {onAir && (
            <div className="sb-state">
              <span className="dot-live" /> {t("Live on Fistball Live")}
              <a className="live-link" href={`${LIVE_URL}?event=${eventId}`} target="_blank" rel="noreferrer">{t("View ↗")}</a>
            </div>
          )}
        </div>
        <div className="sb-label">{t("Event")}</div>
        <nav className="sb-nav">
          {items.map((it) => (
            <button key={it.key} className={`navitem ${activeKey === it.key ? "active" : ""}`}
              onClick={() => go(it.key ? `${base}/${it.key}` : base)}>
              <span className="ic"><it.Icon /></span> {t(it.label)}
            </button>
          ))}
        </nav>
        <button className="navitem sb-guide" onClick={() => go("/guide")}>
          <span className="ic"><IconGuide /></span> {t("Guide")}
        </button>
        <div className="sb-foot">
          <AccountMenu me={me} onSignOut={onSignOut} />
          <LangPicker />
          <div className="sb-who"><div className="who">{me.name}</div><div className="role">{me.admin ? t("org-admin") : t("member")}</div></div>
        </div>
      </aside>

      <div className="main">
        <header className="appbar">
          <button className="sb-toggle" onClick={() => setOpen(true)} aria-label={t("Menu")}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
          </button>
          <nav className="crumbs" aria-label={t("Breadcrumb")}>
            <button className="crumb-link" onClick={() => nav("/")}>Arena</button>
            <span className="sep">›</span>
            <button className="crumb-link" onClick={() => nav("/")}>{t("Events")}</button>
            <span className="sep">›</span>
            {gameMatch || activeKey === "" ? (
              <span className="crumb-cur">{evName}</span>
            ) : (
              <>
                <button className="crumb-link" onClick={() => nav(base)}>{evName}</button>
                <span className="sep">›</span>
                <span className="crumb-cur">{activeLabel && t(activeLabel)}</span>
              </>
            )}
            {gameMatch && (<><span className="sep">›</span><button className="crumb-link" onClick={() => nav(base)}>{t("Games")}</button><span className="sep">›</span><span className="crumb-cur">{t("Game report")}</span></>)}
          </nav>
        </header>
        <div className="content">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
