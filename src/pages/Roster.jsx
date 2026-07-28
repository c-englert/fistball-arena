import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchRosters } from "../roster/importRoster.js";
import { subscribeRosters, publishRosters } from "../cloud.js";

const DB_SHEET_ID = "1og9dwLSgjdlozwb79R0Au1s48etQKlVf1EHILRyyhxM";

export default function Roster({ me }) {
  const nav = useNavigate();
  const [rosters, setRosters] = useState(null);   // live registry from Firestore
  const [preview, setPreview] = useState(null);     // parsed import { rosters, teamCount, count, warnings }
  const [sheetId, setSheetId] = useState(DB_SHEET_ID);
  const [tab, setTab] = useState("DB");
  const [status, setStatus] = useState("");
  const [open, setOpen] = useState(null);           // expanded team

  useEffect(() => subscribeRosters(setRosters), []);

  if (!me?.admin) {
    return <div className="empty">Admins only. <button className="btn" onClick={() => nav("/")}>Back</button></div>;
  }

  const doImport = async () => {
    setStatus("Reading DB tab…");
    try {
      const id = sheetId.match(/[-\w]{25,}/)?.[0] || sheetId.trim();
      const r = await fetchRosters(id, tab.trim() || "DB");
      setPreview(r);
      setStatus(`Found ${r.count} people across ${r.teamCount} teams.`);
    } catch (e) {
      setStatus("Import failed: " + (e?.message || e));
    }
  };

  const doPublish = async () => {
    if (!preview?.count) return;
    setStatus("Saving registry…");
    try {
      await publishRosters(preview.rosters);
      setStatus(`Saved ${preview.count} people across ${preview.teamCount} teams. Line-ups will now pre-fill when a game is opened.`);
      setPreview(null);
    } catch (e) {
      setStatus("Save failed: " + (e?.message || e));
    }
  };

  const teams = useMemo(() => {
    const src = rosters || {};
    return Object.keys(src).sort((a, b) => a.localeCompare(b)).map((k) => ({ key: k, ...src[k] }));
  }, [rosters]);

  return (
    <div className="app">
      <header className="topbar">
        <button className="iconbtn" onClick={() => nav("/")}>‹ Games</button>
        <div className="brand-logo sm"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <div className="spacer" />
        <div style={{ textAlign: "right" }}>
          <div className="title">Players &amp; staff</div>
          <div className="sub">Team registry</div>
        </div>
      </header>

      <div className="content">
        <div className="card">
          <h2>Import players &amp; staff from the DB sheet</h2>
          <p className="muted-sm">Reads the “DB” tab and stores one roster per team. Súmula line-ups then pre-fill automatically.</p>
          <div className="add-row" style={{ marginTop: 8 }}>
            <input value={sheetId} onChange={(e) => setSheetId(e.target.value)} placeholder="Sheet URL or ID" />
            <input value={tab} onChange={(e) => setTab(e.target.value)} placeholder="Tab" style={{ maxWidth: 90, flex: "none" }} />
            <button className="btn primary" onClick={doImport}>Read</button>
          </div>
          {preview?.warnings?.length > 0 && (
            <div className="warn-box">{preview.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}</div>
          )}
          {preview?.count > 0 && (
            <div style={{ marginTop: 12 }}>
              <p className="muted-sm">Ready to save <b>{preview.count}</b> people across <b>{preview.teamCount}</b> teams.</p>
              <button className="btn primary" style={{ width: "100%" }} onClick={doPublish}>
                Save {preview.count} people to the registry
              </button>
            </div>
          )}
          {status && <p className="muted-sm" style={{ marginTop: 10 }}>{status}</p>}
        </div>

        {rosters === null && <div className="empty">Loading registry…</div>}
        {rosters !== null && teams.length === 0 && (
          <div className="empty">No teams in the registry yet — import from the DB sheet above.</div>
        )}

        {teams.map((t) => (
          <div className="card" key={t.key}>
            <button className="row-between roster-head" onClick={() => setOpen(open === t.key ? null : t.key)}>
              <span className="group-title">{t.name}</span>
              <span className="muted-sm">{t.players?.length || 0} players · {t.staff?.length || 0} staff {open === t.key ? "▾" : "▸"}</span>
            </button>
            {open === t.key && (
              <div style={{ marginTop: 10 }}>
                {(t.players || []).map((p, i) => (
                  <div className="roster-row" key={"p" + i}>
                    <span className="roster-nr">{p.nr}</span>
                    <span className="roster-name">{p.name} <span className="muted-sm">{p.first}</span></span>
                    <span className="muted-sm">{p.position}</span>
                  </div>
                ))}
                {(t.staff || []).length > 0 && <div className="subhead">Staff</div>}
                {(t.staff || []).map((s, i) => (
                  <div className="roster-row" key={"s" + i}>
                    <span className="roster-nr role">{(s.role || "").split(" ").map((w) => w[0]).join("").slice(0, 3)}</span>
                    <span className="roster-name">{s.name} <span className="muted-sm">{s.first}</span></span>
                    <span className="muted-sm">{s.role}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
