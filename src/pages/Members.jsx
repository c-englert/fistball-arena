import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeOrgAdmins, addOrgAdmin, removeOrgAdmin, subscribePeople, BOOTSTRAP_ORG_ADMINS } from "../cloud.js";
import { useEvent } from "../eventContext.js";

// Same Gmail account written differently — used only to warn.
function canonEmail(e) {
  const s = String(e || "").trim().toLowerCase();
  const at = s.indexOf("@");
  if (at < 0) return s;
  const local = s.slice(0, at), domain = s.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
  return s;
}

// Org-admins management (global — full access to every event). Per-event access
// now lives in Settings → “Access to this event”.
export default function Members({ me }) {
  const nav = useNavigate();
  const { eventId, event, isAdmin } = useEvent();
  const [orgAdmins, setOrgAdmins] = useState([]);
  const [people, setPeople] = useState([]);
  const [oaForm, setOaForm] = useState({ email: "", name: "" });
  const [status, setStatus] = useState("");

  useEffect(() => subscribeOrgAdmins(setOrgAdmins), []);
  useEffect(() => subscribePeople(setPeople), []);

  const orgAdminEmails = useMemo(
    () => [...new Set([...BOOTSTRAP_ORG_ADMINS, ...orgAdmins.map((o) => o.email)])].sort(),
    [orgAdmins]
  );
  const suggest = useMemo(() => {
    const t = String(oaForm.email || "").trim().toLowerCase();
    if (!t.includes("@")) return null;
    const c = canonEmail(t);
    const hit = people.find((p) => canonEmail(p.email) === c && (p.email || "").toLowerCase() !== t);
    return hit ? hit.email : null;
  }, [oaForm.email, people]);

  if (!isAdmin) return <div className="empty">Admins only.</div>;

  const addOrgA = async () => {
    if (!oaForm.email.trim()) return;
    setStatus("Adding org-admin…");
    try { await addOrgAdmin(oaForm, me); setOaForm({ email: "", name: "" }); setStatus("Org-admin added."); }
    catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };
  const removeOrgA = async (emailAddr) => {
    if (!window.confirm(`Remove org-admin ${emailAddr}? They lose full access to all events.`)) return;
    try { await removeOrgAdmin(emailAddr); } catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="iconbtn" onClick={() => nav(`/e/${eventId}`)}>‹ Games</button>
        <div className="brand-logo sm"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <div className="spacer" />
        <div style={{ textAlign: "right" }}>
          <div className="title">Org-admins</div>
          <div className="sub">{event?.name}</div>
        </div>
      </header>

      <div className="content">
        {me?.admin ? (
          <div className="card">
            <h2>Org-admins <span className="muted-sm" style={{ fontWeight: 400 }}>· full access to ALL events</span></h2>
            <p className="muted-sm">Org-admins manage and create any event. To give access to a <b>single event</b>, use <button className="linklike" onClick={() => nav(`/e/${eventId}/settings`)}>Settings → Access to this event</button>.</p>
            <div className="add-row" style={{ marginTop: 8 }}>
              <input style={{ flex: "2 1 200px" }} value={oaForm.email} onChange={(e) => setOaForm({ ...oaForm, email: e.target.value })} placeholder="email@example.com" />
              <input style={{ flex: "1 1 120px" }} value={oaForm.name} onChange={(e) => setOaForm({ ...oaForm, name: e.target.value })} placeholder="Name (optional)" />
              <button className="btn primary" onClick={addOrgA}>Add org-admin</button>
            </div>
            {suggest && (
              <div className="warn-box" style={{ marginTop: 8 }}>
                ⚠️ This looks like the same account as <b>{suggest}</b>, which already signed in. Use the <b>exact login email</b>.{" "}
                <button className="btn sm" style={{ marginLeft: 4 }} onClick={() => setOaForm({ ...oaForm, email: suggest })}>Use {suggest}</button>
              </div>
            )}
            <div style={{ marginTop: 10 }}>
              {orgAdminEmails.map((emailAddr) => {
                const isBootstrap = BOOTSTRAP_ORG_ADMINS.includes(emailAddr);
                const rec = orgAdmins.find((o) => o.email === emailAddr);
                return (
                  <div className="roster-row" key={emailAddr}>
                    <span className="roster-nr role">A</span>
                    <span className="roster-name">{rec?.name || emailAddr} {rec?.name && <span className="muted-sm">{emailAddr}</span>}</span>
                    {isBootstrap
                      ? <span className="tag">built-in</span>
                      : <button className="btn danger sm" style={{ marginLeft: 8 }} onClick={() => removeOrgA(emailAddr)}>Remove</button>}
                  </div>
                );
              })}
            </div>
            <p className="muted-sm" style={{ marginTop: 6 }}>“built-in” org-admins are set in code and can’t be removed here. Others take effect after the person signs in again. {status}</p>
          </div>
        ) : (
          <div className="card">
            <h2>Access to this event</h2>
            <p className="muted-sm">Manage who can score and manage this event in <button className="linklike" onClick={() => nav(`/e/${eventId}/settings`)}>Settings → Access to this event</button>. Org-admin management is available to org-admins only.</p>
          </div>
        )}
      </div>
    </div>
  );
}
