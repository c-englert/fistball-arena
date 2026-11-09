import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listMyEvents, createEvent, setEvent, publishEventImport, subscribeLivePointer, setLiveEvent, clearLiveEvent, subscribeAllBranding } from "./cloud.js";
import { fetchEventFromSheet } from "./schedule/importEventSheet.js";
import { formatRange } from "./dates.js";
import { IconStar, IconShield, IconWhistle, IconEye, IconEdit } from "./icons.jsx";
import EventsTimeline from "./EventsTimeline.jsx";
import { useT, tNow } from "./i18n.js";

export default function EventPicker({ me, onSignOut }) {
  const t = useT();
  const nav = useNavigate();
  const [events, setEvents] = useState(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: "", place: "", startDate: "", endDate: "" });
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("active");
  const [view, setView] = useState(() => localStorage.getItem("fb_events_view") || "cards");
  const pickView = (v) => { setView(v); localStorage.setItem("fb_events_view", v); };
  const [live, setLive] = useState(null);
  const [brandings, setBrandings] = useState({});
  const [imp, setImp] = useState(null); // Google-Sheet import modal: null = closed
  const [impPreview, setImpPreview] = useState(null);
  const [impStatus, setImpStatus] = useState("");
  const [impBusy, setImpBusy] = useState(false);

  useEffect(() => listMyEvents(me, setEvents), [me]);
  useEffect(() => subscribeLivePointer(setLive), []);
  useEffect(() => subscribeAllBranding(setBrandings), []);

  const shown = (events || []).filter((e) => (tab === "archived" ? e.status === "archived" : e.status !== "archived"));
  const canManageLive = (ev) => me.admin || ev.myRole === "admin";
  const toggleLive = async (ev, isLive) => {
    try { if (isLive) { if (window.confirm(tNow("Remove this event from Fistball Live?"))) await clearLiveEvent(ev.id); } else await setLiveEvent(ev); }
    catch (e) { alert(tNow("Failed: ") + (e?.message || e)); }
  };

  const create = async () => {
    if (!form.name.trim()) return;
    setBusy(true);
    try {
      const id = await createEvent({ ...form, dates: formatRange(form.startDate, form.endDate) }, me);
      nav(`/e/${id}`);
    } catch (e) {
      alert(tNow("Could not create event: ") + (e?.message || e));
      setBusy(false);
    }
  };

  // Import a past event from a Google Sheet: read a preview, then create a new
  // event and publish the games/rosters/results into it.
  const openImport = () => { setImp({ name: "", place: "", startDate: "", endDate: "", url: "" }); setImpPreview(null); setImpStatus(""); };
  const readImport = async () => {
    setImpStatus(tNow("Reading sheet…")); setImpPreview(null);
    try {
      const id = imp.url.match(/[-\w]{25,}/)?.[0] || imp.url.trim();
      const r = await fetchEventFromSheet(id);
      setImpPreview(r);
      setImpStatus(tNow("Found {games} games ({finished} finished) · {teams} teams · {carded} carded.", { games: r.gameCount, finished: r.finished, teams: r.teamCount, carded: r.cautionCount }) + (r.warnings.length ? " " + r.warnings.join("; ") : ""));
    } catch (e) { setImpStatus(tNow("Read failed: ") + (e?.message || e)); }
  };
  const runImport = async () => {
    if (!impPreview?.gameCount || !imp.name.trim()) return;
    setImpBusy(true); setImpStatus(tNow("Creating event & importing…"));
    try {
      const id = await createEvent({ name: imp.name, place: imp.place, startDate: imp.startDate, endDate: imp.endDate, dates: formatRange(imp.startDate, imp.endDate), status: imp.active ? "active" : "archived" }, me);
      setEvent(id);
      await publishEventImport(impPreview, { replaceAll: true });
      nav(`/e/${id}`);
    } catch (e) { setImpStatus(tNow("Import failed: ") + (e?.message || e)); setImpBusy(false); }
  };

  return (
    <>
      <h2 className="page-h">{t("Events")}</h2>
      <div>
        {me.admin && !creating && (
          <button className="btn primary" style={{ width: "100%", marginBottom: 16 }} onClick={() => setCreating(true)}>{t("+ New event")}</button>
        )}
        {me.admin && creating && (
          <div className="card">
            <h2>{t("New event")}</h2>
            <div className="field"><span>{t("Name")}</span>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder={t("e.g. 2026 U18 WC & Women's EFA")} autoFocus /></div>
            <div className="field"><span>{t("Place")}</span>
              <input value={form.place} onChange={(e) => setForm({ ...form, place: e.target.value })} placeholder={t("Reiden · Switzerland")} /></div>
            <div className="grid2">
              <div className="field"><span>{t("Starts")}</span>
                <input type="date" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value, endDate: form.endDate && form.endDate < e.target.value ? e.target.value : form.endDate })} /></div>
              <div className="field"><span>{t("Ends")}</span>
                <input type="date" min={form.startDate || undefined} value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} /></div>
            </div>
            {(form.startDate || form.endDate) && <p className="muted-sm">{formatRange(form.startDate, form.endDate) || t("Pick a start and end date")}</p>}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="btn" onClick={() => setCreating(false)}>{t("Cancel")}</button>
              <button className="btn primary" disabled={busy || !form.name.trim()} onClick={create}>{busy ? t("Creating…") : t("Create & open")}</button>
            </div>
          </div>
        )}

        <div className="filter-bar" style={{ padding: "0 0 12px", alignItems: "center" }}>
          <button className={`filter-pill ${tab === "active" ? "active" : ""}`} onClick={() => setTab("active")}>{t("Active & upcoming")}</button>
          <button className={`filter-pill ${tab === "archived" ? "active" : ""}`} onClick={() => setTab("archived")}>{t("Archived")}</button>
          <span style={{ flex: 1 }} />
          {me.admin && tab === "archived" && (
            <button className="btn sm" onClick={openImport} title={t("Create an archived event from a past Google Sheet")}>{t("⬇ Import from Google Sheet")}</button>
          )}
          <div className="seg">
            <button className={`seg-btn ${view === "cards" ? "active" : ""}`} onClick={() => pickView("cards")}>{t("Cards")}</button>
            <button className={`seg-btn ${view === "timeline" ? "active" : ""}`} onClick={() => pickView("timeline")}>{t("Timeline")}</button>
            <button className={`seg-btn ${view === "table" ? "active" : ""}`} onClick={() => pickView("table")}>{t("Table")}</button>
          </div>
        </div>

        {events === null && <div className="empty">{t("Loading events…")}</div>}
        {events !== null && shown.length === 0 && (
          <div className="empty">{tab === "archived" ? t("No archived events.") : me.admin ? t("No active events — create one above.") : t("You're not a member of any active event yet.")}</div>
        )}

        {view === "timeline" && shown.length > 0 && (
          <EventsTimeline
            events={shown} brandings={brandings} live={live}
            roleOf={(ev) => (me.admin ? "org-admin" : ev.myRole)}
            onOpen={(id) => nav(`/e/${id}`)}
          />
        )}

        {view === "table" && shown.length > 0 && (
          <div className="grid-scroll">
            <table className="ev-table">
              <thead>
                <tr>
                  <th></th><th>{t("Event")}</th><th>{t("Place")}</th><th>{t("Dates")}</th><th>{t("Status")}</th><th>{t("Your role")}</th><th>{t("Live")}</th><th></th>
                </tr>
              </thead>
              <tbody>
                {shown.map((ev) => {
                  const isLive = !!live?.ids?.has(ev.id);
                  const role = me.admin ? "org-admin" : ev.myRole;
                  const RoleIcon = role === "org-admin" ? IconStar : role === "admin" ? IconShield : role === "official" ? IconWhistle : IconEye;
                  const logo = brandings[ev.id]?.eventLogo?.dataUrl;
                  const canEdit = me.admin || ev.myRole === "admin";
                  return (
                    <tr key={ev.id} className="ev-row" onClick={() => nav(`/e/${ev.id}`)}>
                      <td className="et-logo">{logo ? <img src={logo} alt="" /> : <span className="et-logo-ph">{(ev.name || "?").trim()[0]}</span>}</td>
                      <td className="et-name">{ev.name}</td>
                      <td className="muted-sm">{ev.place || "—"}</td>
                      <td className="muted-sm">{ev.dates || "—"}</td>
                      <td><span className={`state ${ev.status === "archived" ? "none" : "submitted"}`}>{ev.status === "archived" ? t("Archived") : t("Active")}</span></td>
                      <td><span className={`ev-role role-${role}`}><RoleIcon size={13} /> {t(role)}</span></td>
                      <td>{isLive ? <span className="live-ind"><span className="live-dot" /> {t("Live")}</span> : <span className="muted-sm">—</span>}</td>
                      <td className="et-actions">{canEdit && <button className="ev-edit sm" title={t("Edit event")} onClick={(e) => { e.stopPropagation(); nav(`/e/${ev.id}/settings`); }}><IconEdit size={15} /></button>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {view === "cards" && (
        <div className="card-grid">
        {shown.map((ev) => {
          const isLive = !!live?.ids?.has(ev.id);
          const canEdit = me.admin || ev.myRole === "admin";
          const role = me.admin ? "org-admin" : ev.myRole;
          const RoleIcon = role === "org-admin" ? IconStar : role === "admin" ? IconShield : role === "official" ? IconWhistle : IconEye;
          const promos = (brandings[ev.id]?.promoters || []).slice(0, 4);
          return (
            <div className="ev-card" key={ev.id} onClick={() => nav(`/e/${ev.id}`)}>
              <div className="ev-head">
                <div className="ev-badges">
                  <span className={`state ${ev.status === "archived" ? "none" : "submitted"}`}>{ev.status === "archived" ? t("Archived") : t("Active")}</span>
                  <span className={`ev-role role-${role}`} title={t("Your role: {role}", { role: t(role) })}><RoleIcon size={14} /> {t(role)}</span>
                </div>
                {canEdit && (
                  <button className="ev-edit" title={t("Edit event")} aria-label={t("Edit event")} onClick={(e) => { e.stopPropagation(); nav(`/e/${ev.id}/settings`); }}>
                    <IconEdit size={17} />
                  </button>
                )}
              </div>

              <div className="ev-body">
                {brandings[ev.id]?.eventLogo?.dataUrl && <img className="ev-logo" src={brandings[ev.id].eventLogo.dataUrl} alt="" />}
                <div className="ev-info">
                  <div className="ev-name">{ev.name}</div>
                  <div className="ev-meta">{[ev.place, ev.dates].filter(Boolean).join(" · ")}</div>
                </div>
              </div>

              <div className="ev-foot">
                <div className="ev-promos">{promos.map((p, i) => <img key={i} src={p.dataUrl} alt="" />)}</div>
                <div className="ev-live">
                  {canManageLive(ev) ? (
                    <button className={`btn sm ${isLive ? "danger" : ""}`} onClick={(e) => { e.stopPropagation(); toggleLive(ev, isLive); }}>
                      {isLive ? t("Remove from Live") : t("Show on Live")}
                    </button>
                  ) : (isLive && <span className="live-ind"><span className="live-dot" /> {t("On Fistball Live")}</span>)}
                </div>
              </div>
            </div>
          );
        })}
        </div>
        )}
      </div>

      {imp && me.admin && (
        <div className="modal-overlay" onClick={() => !impBusy && setImp(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <button className="modal-x" onClick={() => setImp(null)} aria-label={t("Close")}>✕</button>
            <h3 className="modal-title" style={{ marginBottom: 2 }}>{t("Import a past event (Google Sheet)")}</h3>
            <p className="muted-sm" style={{ marginTop: 0 }}>{t("Creates a new event from a results sheet — schedule + final scores (Results tab) and rosters (DB tab), so Fistball Live shows the full standings.")}</p>

            <div className="field"><span>{t("Name")}</span>
              <input value={imp.name} onChange={(e) => setImp({ ...imp, name: e.target.value })} placeholder={t("e.g. 2025 South American Championship")} autoFocus /></div>
            <div className="field"><span>{t("Place")}</span>
              <input value={imp.place} onChange={(e) => setImp({ ...imp, place: e.target.value })} placeholder={t("Rosario · Argentina")} /></div>
            <div className="grid2">
              <div className="field"><span>{t("Starts")}</span>
                <input type="date" value={imp.startDate} onChange={(e) => setImp({ ...imp, startDate: e.target.value, endDate: imp.endDate && imp.endDate < e.target.value ? e.target.value : imp.endDate })} /></div>
              <div className="field"><span>{t("Ends")}</span>
                <input type="date" min={imp.startDate || undefined} value={imp.endDate} onChange={(e) => setImp({ ...imp, endDate: e.target.value })} /></div>
            </div>

            <div className="field"><span>{t("Google Sheet URL or ID")}</span>
              <div className="add-row">
                <input value={imp.url} onChange={(e) => setImp({ ...imp, url: e.target.value })} placeholder="https://docs.google.com/spreadsheets/d/…" />
                <button className="btn" onClick={readImport} disabled={!imp.url.trim()}>{t("Read")}</button>
              </div>
            </div>

            {impPreview?.gameCount > 0 && (
              <p className="muted-sm">{t("Ready:")} <b>{impPreview.gameCount}</b> {t("games")} ({t("{n} finished", { n: impPreview.finished })}) · <b>{impPreview.teamCount}</b> {t("rosters")} · <b>{impPreview.cautionCount}</b> {t("carded.")}</p>
            )}
            {impStatus && <p className="muted-sm">{impStatus}</p>}

            <label className="imp-active">
              <input type="checkbox" checked={!!imp.active} onChange={(e) => setImp({ ...imp, active: e.target.checked })} />
              <span>{t("Create as an {active} event (editable & scorable). Leave off to archive it as past history.").split(/(\{active\})/).map((part, i) => (part === "{active}" ? <b key={i}>{t("active")}</b> : part))}</span>
            </label>

            <div style={{ display: "flex", gap: 8, marginTop: 6 }}>
              <button className="btn" onClick={() => setImp(null)} disabled={impBusy}>{t("Cancel")}</button>
              <button className="btn primary" style={{ flex: 1 }} disabled={impBusy || !impPreview?.gameCount || !imp.name.trim()} onClick={runImport}>
                {impBusy ? t("Importing…") : t("Create event & import")}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
