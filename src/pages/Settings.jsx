import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  setEventStatus, subscribeLivePointer, setLiveEvent, clearLiveEvent,
  subscribeLogos, addLogo, deleteLogo, saveBranding, updateEventDetails, publishEventImport,
} from "../cloud.js";
import { fetchEventFromSheet } from "../schedule/importEventSheet.js";
import { fileToLogoDataUrl } from "../img.js";
import { formatRange } from "../dates.js";
import { useEvent } from "../eventContext.js";

export default function Settings({ me }) {
  const nav = useNavigate();
  const { eventId, event, archived, isAdmin, branding } = useEvent();
  const [live, setLive] = useState(undefined);
  const [status, setStatus] = useState("");
  const [details, setDetails] = useState(() => ({
    name: event?.name || "", place: event?.place || "", startDate: event?.startDate || "", endDate: event?.endDate || "",
  }));

  const [evUrl, setEvUrl] = useState("");
  const [evPreview, setEvPreview] = useState(null);
  const readEvent = async () => {
    setStatus("Reading sheet…");
    try {
      const id = evUrl.match(/[-\w]{25,}/)?.[0] || evUrl.trim();
      const r = await fetchEventFromSheet(id);
      setEvPreview(r);
      setStatus(`Found ${r.gameCount} games (${r.finished} finished) + ${r.teamCount} teams.` + (r.warnings.length ? " " + r.warnings.join("; ") : ""));
    } catch (e) { setStatus("Read failed: " + (e?.message || e)); }
  };
  const publishEvent = async () => {
    if (!evPreview?.gameCount) return;
    if (!window.confirm(`Replace this event's games, reports and results with ${evPreview.gameCount} imported games (and ${evPreview.teamCount} rosters)? This cannot be undone.`)) return;
    setStatus("Importing…");
    try {
      await publishEventImport(evPreview, { replaceAll: true });
      setStatus(`Imported ${evPreview.gameCount} games + ${evPreview.teamCount} rosters. Open the games list / Fistball Live to see them.`);
      setEvPreview(null);
    } catch (e) { setStatus("Import failed: " + (e?.message || e)); }
  };

  const saveDetails = async () => {
    setStatus("Saving event…");
    try { await updateEventDetails({ ...details, dates: formatRange(details.startDate, details.endDate) }); setStatus("Event details saved."); }
    catch (e) { setStatus("Save failed: " + (e?.message || e)); }
  };

  // logo library + this event's selection
  const [logos, setLogos] = useState([]);
  const [eventLogo, setEventLogo] = useState(null);
  const [promoters, setPromoters] = useState([]);
  const fileRef = useRef(null);
  const initedRef = useRef(false);

  useEffect(() => subscribeLivePointer(setLive), []);
  useEffect(() => subscribeLogos(setLogos), []);
  // Load the saved selection once branding arrives.
  useEffect(() => {
    if (branding && !initedRef.current) {
      setEventLogo(branding.eventLogo || null);
      setPromoters(branding.promoters || []);
      initedRef.current = true;
    }
  }, [branding]);

  if (!isAdmin) return <div className="empty">Admins only.</div>;

  const thisIsLive = live?.eventId === eventId;
  const publishLive = async () => { try { await setLiveEvent(event); } catch (e) { setStatus("Failed: " + (e?.message || e)); } };
  const stopLive = async () => {
    if (!window.confirm("Stop showing this event on Fistball Live?")) return;
    try { await clearLiveEvent(); } catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };
  const toggleArchive = async () => {
    const next = archived ? "active" : "archived";
    if (!window.confirm(archived ? "Re-activate this event?" : "Archive this event? It becomes read-only for everyone.")) return;
    try { await setEventStatus(next); } catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("Uploading logo…");
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      await addLogo({ name: file.name.replace(/\.[^.]+$/, ""), dataUrl }, me);
      setStatus("Logo added to the library.");
    } catch (e2) { setStatus("Upload failed: " + (e2?.message || e2)); }
  };
  const asLogo = (l) => ({ name: l.name, dataUrl: l.dataUrl });
  const addPromoter = (l) => setPromoters((p) => (p.some((x) => x.dataUrl === l.dataUrl) ? p : [...p, asLogo(l)]));
  const removePromoter = (i) => setPromoters((p) => p.filter((_, j) => j !== i));

  const saveLogos = async () => {
    setStatus("Saving branding…");
    try { await saveBranding({ name: event?.name, eventLogo, promoters }); setStatus("Branding saved."); }
    catch (e) { setStatus("Save failed: " + (e?.message || e)); }
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="iconbtn" onClick={() => nav(`/e/${eventId}`)}>‹ Games</button>
        <div className="brand-logo sm"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <div className="spacer" />
        <div style={{ textAlign: "right" }}>
          <div className="title">Event settings{archived && <span className="arch-badge">Archived</span>}</div>
          <div className="sub">{event?.name}</div>
        </div>
      </header>

      <div className="content">
        {/* ---- Event details ---- */}
        <div className="card">
          <h2>Event details</h2>
          <div className="field"><span>Name</span>
            <input value={details.name} disabled={archived} onChange={(e) => setDetails({ ...details, name: e.target.value })} /></div>
          <div className="field"><span>Place</span>
            <input value={details.place} disabled={archived} onChange={(e) => setDetails({ ...details, place: e.target.value })} placeholder="City · Country" /></div>
          <div className="grid2">
            <div className="field"><span>Starts</span>
              <input type="date" disabled={archived} value={details.startDate} onChange={(e) => setDetails({ ...details, startDate: e.target.value, endDate: details.endDate && details.endDate < e.target.value ? e.target.value : details.endDate })} /></div>
            <div className="field"><span>Ends</span>
              <input type="date" disabled={archived} min={details.startDate || undefined} value={details.endDate} onChange={(e) => setDetails({ ...details, endDate: e.target.value })} /></div>
          </div>
          {(details.startDate || details.endDate) && <p className="muted-sm">{formatRange(details.startDate, details.endDate)}</p>}
          {!archived && <button className="btn primary" onClick={saveDetails}>Save details</button>}
        </div>

        {/* ---- Import a past event from a Google Sheet ---- */}
        {!archived && (
          <div className="card">
            <h2>Import a past event (Google Sheet)</h2>
            <p className="muted-sm">Brings the schedule + final scores (Results tab) and rosters (DB tab) into this event, so Fistball Live shows the full standings. Súmula line-up/card detail is separate.</p>
            <div className="add-row" style={{ marginTop: 8 }}>
              <input value={evUrl} onChange={(e) => setEvUrl(e.target.value)} placeholder="Google Sheet URL or ID" />
              <button className="btn primary" onClick={readEvent}>Read</button>
            </div>
            {evPreview?.gameCount > 0 && (
              <div style={{ marginTop: 12 }}>
                <p className="muted-sm">Ready: <b>{evPreview.gameCount}</b> games ({evPreview.finished} finished) · <b>{evPreview.teamCount}</b> rosters.</p>
                <button className="btn primary" style={{ width: "100%" }} onClick={publishEvent}>Import into this event (replace)</button>
              </div>
            )}
            <p className="muted-sm">Or import just players/staff from an Excel file on the <b>Players &amp; staff</b> page.</p>
          </div>
        )}

        {/* ---- Logos ---- */}
        <div className="card">
          <div className="row-between">
            <h2 style={{ margin: 0 }}>Event logos</h2>
            <button className="btn sm" onClick={() => fileRef.current?.click()} disabled={archived}>+ Upload logo</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />
          <p className="muted-sm">Shown on the game report (PDF), the app topbar and Fistball Live.</p>

          <div className="subhead">This event</div>
          <div className="brand-picks">
            <div className="brand-pick">
              <div className="brand-pick-label">Event logo</div>
              {eventLogo
                ? <div className="logo-chip"><img src={eventLogo.dataUrl} alt="" /><button onClick={() => setEventLogo(null)} disabled={archived}>✕</button></div>
                : <div className="logo-empty">none</div>}
            </div>
            <div className="brand-pick">
              <div className="brand-pick-label">Promoters</div>
              <div className="chips">
                {promoters.map((p, i) => (
                  <div className="logo-chip" key={i}><img src={p.dataUrl} alt="" /><button onClick={() => removePromoter(i)} disabled={archived}>✕</button></div>
                ))}
                {!promoters.length && <div className="logo-empty">none</div>}
              </div>
            </div>
          </div>
          {!archived && <button className="btn primary" style={{ marginTop: 12 }} onClick={saveLogos}>Save logos</button>}

          <div className="subhead">Library ({logos.length})</div>
          {logos.length === 0 && <p className="muted-sm">No logos yet — upload one above.</p>}
          <div className="logo-grid">
            {logos.map((l) => (
              <div className="logo-lib" key={l.id}>
                <img src={l.dataUrl} alt={l.name} title={l.name} />
                <div className="logo-name">{l.name}</div>
                {!archived && (
                  <div className="logo-actions">
                    <button className="btn sm" onClick={() => setEventLogo(asLogo(l))}>Event logo</button>
                    <button className="btn sm" onClick={() => addPromoter(l)}>Add promoter</button>
                    <button className="btn danger sm" onClick={() => window.confirm(`Delete “${l.name}” from the library?`) && deleteLogo(l.id)}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ---- Fistball Live ---- */}
        <div className="card">
          <div className="row-between">
            <div><h2 style={{ margin: 0 }}>Fistball Live</h2>
              <p className="muted-sm">
                {live === undefined ? "Checking…"
                  : thisIsLive ? "✅ This event is showing on the public scoreboard."
                  : live?.eventId ? `Another event is live: “${live.name || live.eventId}”.`
                  : "No event is on the public scoreboard yet."}
              </p></div>
            {thisIsLive
              ? <button className="btn danger" onClick={stopLive}>Stop showing</button>
              : <button className="btn primary" onClick={publishLive}>{live?.eventId ? "Show this instead" : "Publish to Live"}</button>}
          </div>
        </div>

        {/* ---- Status ---- */}
        <div className="card">
          <div className="row-between">
            <div><h2 style={{ margin: 0 }}>Event status</h2>
              <p className="muted-sm">{archived ? "Archived — read-only for everyone." : "Active — members can score."}</p></div>
            <button className={`btn ${archived ? "primary" : "danger"}`} onClick={toggleArchive}>{archived ? "Re-activate" : "Archive"}</button>
          </div>
        </div>

        {status && <p className="muted-sm">{status}</p>}
      </div>
    </div>
  );
}
