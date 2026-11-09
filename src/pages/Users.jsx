import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  subscribeOrgAdmins, addOrgAdmin, removeOrgAdmin, subscribePeople, BOOTSTRAP_ORG_ADMINS,
  listMyEvents, subscribeMembersAt, setMemberRoleAt, removeMemberAt, mirrorMembership,
} from "../cloud.js";
import { useT, tNow } from "../i18n.js";

// Same Gmail account written differently — used only to warn.
function canonEmail(e) {
  const s = String(e || "").trim().toLowerCase();
  const at = s.indexOf("@");
  if (at < 0) return s;
  const local = s.slice(0, at), domain = s.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
  return s;
}

const ROLES = ["", "viewer", "official", "admin"];
const ROLE_LABEL = { "": "—", viewer: "Viewer", official: "Official", admin: "Admin" };

// Translated rich text: **bold** and [[tag]] markers become <b> / <span class="tag">.
const rich = (s) => String(s).split(/(\*\*[^*]+\*\*|\[\[[^\]]+\]\])/).map((p, i) =>
  p.startsWith("**") ? <b key={i}>{p.slice(2, -2)}</b>
    : p.startsWith("[[") ? <span key={i} className="tag">{p.slice(2, -2)}</span>
    : p);
// Status messages are kept in English (the "Failed" prefix is checked); translate at display.
const showStatus = (tr, s) => {
  let m = /^Failed to save (.*) in “(.*)”: ([\s\S]*)$/.exec(s);
  if (m) return tr("Failed to save {email} in “{event}”: {code}", { email: m[1], event: m[2], code: m[3] });
  m = /^Failed: ([\s\S]*)$/.exec(s);
  if (m) return tr("Failed: ") + m[1];
  return tr(s);
};

// GLOBAL users & access area (org-admins only): see every user (with or without
// access) and grant/change/revoke their role per event, inline. Per-event
// Settings → Access still works too, with the extra "this event" context.
export default function Users({ me }) {
  const tr = useT();
  const nav = useNavigate();
  const [orgAdmins, setOrgAdmins] = useState([]);
  const [people, setPeople] = useState([]);
  const [events, setEvents] = useState(null);
  const [membersByEvent, setMembersByEvent] = useState({}); // eventId -> [{email,name,role,eventId}]
  const [oaForm, setOaForm] = useState({ email: "", name: "" });
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");
  const [showAll, setShowAll] = useState(true); // include users with no access (everyone) by default
  const [onlyOrg, setOnlyOrg] = useState(false); // filter to org-admins only
  const [pending, setPending] = useState({}); // optimistic role overlay: `${email}||${eventId}` -> role
  const [saving, setSaving] = useState({});    // `${email}||${eventId}` -> true while writing
  const [errCell, setErrCell] = useState({});  // `${email}||${eventId}` -> error message
  const mirroredRef = useRef(new Set()); // backfill dedupe: `${eventId}|${email}|${role}`

  useEffect(() => subscribeOrgAdmins(setOrgAdmins), []);
  useEffect(() => subscribePeople(setPeople), []);
  useEffect(() => (me?.admin ? listMyEvents(me, setEvents) : undefined), [me]);

  // Read members per event (normal subcollection reads — org-admin allowed),
  // instead of one collection-group query (which the rules deny). Aggregate.
  const eventIds = useMemo(() => (events || []).map((e) => e.id).sort().join(","), [events]);
  useEffect(() => {
    if (!me?.admin || !eventIds) return undefined;
    const ids = eventIds.split(",").filter(Boolean);
    setMembersByEvent((prev) => { // drop events that no longer exist
      const next = {}; ids.forEach((id) => { if (prev[id]) next[id] = prev[id]; }); return next;
    });
    const unsubs = ids.map((id) =>
      subscribeMembersAt(id, (list) => {
        setMembersByEvent((prev) => ({ ...prev, [id]: list.map((m) => ({ ...m, eventId: id })) }));
        // Backfill each membership onto the person's own people/{email} doc, so
        // non-admins (whose app reads only their own doc) can see their events.
        list.forEach((m) => {
          const key = `${id}|${m.email}|${m.role}`;
          if (!mirroredRef.current.has(key)) { mirroredRef.current.add(key); mirrorMembership(id, m.email, m.role, m.name); }
        });
      }));
    return () => unsubs.forEach((u) => u && u());
  }, [me, eventIds]);
  const members = useMemo(() => Object.values(membersByEvent).flat(), [membersByEvent]);

  const orgAdminEmails = useMemo(
    () => new Set([...BOOTSTRAP_ORG_ADMINS, ...orgAdmins.map((o) => o.email)]),
    [orgAdmins]
  );
  const suggest = useMemo(() => {
    const t = String(oaForm.email || "").trim().toLowerCase();
    if (!t.includes("@")) return null;
    const c = canonEmail(t);
    const hit = people.find((p) => canonEmail(p.email) === c && (p.email || "").toLowerCase() !== t);
    return hit ? hit.email : null;
  }, [oaForm.email, people]);

  // Events as grid columns: active first, then archived, each by date.
  const cols = useMemo(() => {
    const list = [...(events || [])];
    const rank = (e) => (e.status === "archived" ? 1 : 0);
    return list.sort((a, b) => rank(a) - rank(b) || String(a.dates || "").localeCompare(String(b.dates || "")) || String(a.name).localeCompare(String(b.name)));
  }, [events]);

  // role lookup: `${email}||${eventId}` -> role (from the server snapshot)
  const roleAt = useMemo(() => {
    const m = new Map();
    (members || []).forEach((x) => m.set(`${x.email}||${x.eventId}`, x.role));
    return m;
  }, [members]);

  // Once the server snapshot catches up to an optimistic edit, drop the overlay.
  useEffect(() => {
    setPending((prev) => {
      let changed = false; const next = { ...prev };
      for (const k of Object.keys(prev)) {
        if ((roleAt.get(k) || "") === prev[k]) { delete next[k]; changed = true; }
      }
      return changed ? next : prev;
    });
  }, [roleAt]);
  const shownRole = (email, eventId) => {
    const k = `${email}||${eventId}`;
    return k in pending ? pending[k] : (roleAt.get(k) || "");
  };

  // one row per user: union of org-admins + everyone with a membership (+ directory when showAll)
  const rows = useMemo(() => {
    const byEmail = new Map();
    const nameFor = (email) => {
      const p = people.find((pp) => pp.email === email);
      if (p?.name) return p.name;
      const mem = (members || []).find((mm) => mm.email === email && mm.name);
      return mem?.name || "";
    };
    const touch = (email) => { if (!byEmail.has(email)) byEmail.set(email, { email, name: nameFor(email) }); };
    orgAdminEmails.forEach(touch);
    (members || []).forEach((x) => touch(x.email));
    if (showAll) people.forEach((p) => touch(p.email));
    const t = q.trim().toLowerCase();
    return [...byEmail.values()]
      .filter((u) => !onlyOrg || orgAdminEmails.has(u.email))
      .filter((u) => !t || u.email.toLowerCase().includes(t) || (u.name || "").toLowerCase().includes(t))
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email));
  }, [orgAdminEmails, members, people, showAll, onlyOrg, q]);

  // Possible duplicate identities: several e-mails that canonicalize to the same
  // Gmail account (gmail vs googlemail, dots, +tags). Only the exact login e-mail
  // actually grants access, so the others are "ghost" access worth cleaning up.
  const { dupEmails, dupClusters } = useMemo(() => {
    const groups = new Map(); // canon -> Set(emails)
    // consider everyone we know about, not just the filtered rows
    const universe = new Set([
      ...orgAdminEmails,
      ...(members || []).map((m) => m.email),
      ...people.map((p) => p.email),
    ]);
    universe.forEach((e) => {
      const c = canonEmail(e);
      if (!groups.has(c)) groups.set(c, new Set());
      groups.get(c).add(e);
    });
    const emails = new Set(); const clusters = [];
    for (const set of groups.values()) {
      if (set.size > 1) { clusters.push([...set].sort()); set.forEach((e) => emails.add(e)); }
    }
    return { dupEmails: emails, dupClusters: clusters };
  }, [orgAdminEmails, members, people]);

  if (!me?.admin) return <div className="empty">{tr("Org-admins only.")}</div>;

  const addOrgA = async () => {
    if (!oaForm.email.trim()) return;
    setStatus("Adding org-admin…");
    try { await addOrgAdmin(oaForm, me); setOaForm({ email: "", name: "" }); setStatus("Org-admin added."); }
    catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };
  // Toggle a user's org-admin status (iOS switch next to the name). Built-in
  // org-admins are set in code and can't be changed here.
  const toggleOrgAdmin = async (user) => {
    if (BOOTSTRAP_ORG_ADMINS.includes(user.email)) return;
    const on = orgAdminEmails.has(user.email);
    if (on && !window.confirm(tNow("Remove org-admin from {name}? They lose full access to all events.", { name: user.name || user.email }))) return;
    try {
      if (on) await removeOrgAdmin(user.email);
      else await addOrgAdmin({ email: user.email, name: user.name }, me);
      setStatus("");
    } catch (e) { setStatus("Failed: " + (e?.code || e?.message || e)); }
  };
  // Grant / change / revoke a user's role in one event, inline (optimistic).
  const changeRole = async (user, ev, role) => {
    const k = `${user.email}||${ev.id}`;
    setPending((p) => ({ ...p, [k]: role }));       // show the choice immediately
    setSaving((s) => ({ ...s, [k]: true }));
    setErrCell((x) => { const n = { ...x }; delete n[k]; return n; });
    try {
      if (!role) await removeMemberAt(ev.id, user.email);
      else await setMemberRoleAt(ev.id, { email: user.email, name: user.name, role }, me);
      setStatus("");
    } catch (e) {
      const code = e?.code || e?.message || String(e);
      console.error("[access-grid] save failed", { user: user.email, event: ev.id, role, error: e });
      setPending((p) => { const n = { ...p }; delete n[k]; return n; }); // revert overlay
      setErrCell((x) => ({ ...x, [k]: code }));
      setStatus(`Failed to save ${user.email} in “${ev.name}”: ${code}`);
    } finally {
      setSaving((s) => { const n = { ...s }; delete n[k]; return n; });
    }
  };

  const loading = events === null;

  return (
    <>
      <h2 className="page-h">{tr("Users & access")}</h2>

      {/* ---- Access grid (single container) ---- */}
      <div className="card wide">
        <div className="row-between" style={{ alignItems: "center", flexWrap: "wrap", gap: 8 }}>
          <h2 style={{ margin: 0 }}>{tr("Access by event")} <span className="muted-sm" style={{ fontWeight: 400 }}>· {tr("{n} user(s)", { n: rows.length })} · {tr("{n} event(s)", { n: cols.length })}</span></h2>
          <label className="imp-active" style={{ margin: 0 }}>
            <input type="checkbox" checked={showAll} onChange={(e) => setShowAll(e.target.checked)} />
            <span>{tr("Show users without access")}</span>
          </label>
        </div>
        <p className="muted-sm">{rich(tr("Turn on the **org-admin toggle** next to a name to grant full access to all events. For a single event, pick the role in that event's column (**—** removes). Roles: **Admin** manages · **Official** scores · **Viewer** read-only."))}</p>

        <details className="access-note">
          <summary>{rich(tr("What is **org-admin**? How do I choose a role?"))}</summary>
          <div className="access-note-body">
            <p>{rich(tr("**Org-admin** is the top level: **full access to every event** (create, archive, manage, score) without being authorized in each one — and the only role that can see this screen. In the grid, org-admins show as **TOTAL**. Use it for whoever runs the championship as a whole. Some are [[built-in]] (set in code, not removable here)."))}</p>
            <p>{rich(tr("The other roles apply to **a single event** (pick them in that event's column):"))}</p>
            <ul>
              <li>{rich(tr("**Admin** — manages that event (schedule, players, settings, format) and scores."))}</li>
              <li>{rich(tr("**Official** — scores that event's game reports."))}</li>
              <li>{rich(tr("**Viewer** — read-only for that event."))}</li>
              <li>{rich(tr("**—** — no access to that event (removes)."))}</li>
            </ul>
            <p className="muted-sm">{rich(tr("Rule of thumb: **org-admin** = championship organizer; **Admin/Official/Viewer** = participant in **one** event."))}</p>
          </div>
        </details>

        {/* pre-authorize someone who hasn't logged in yet */}
        <div className="add-row" style={{ marginTop: 8 }}>
          <input style={{ flex: "2 1 200px" }} value={oaForm.email} onChange={(e) => setOaForm({ ...oaForm, email: e.target.value })} placeholder={tr("Add org-admin by email…")} />
          <input style={{ flex: "1 1 120px" }} value={oaForm.name} onChange={(e) => setOaForm({ ...oaForm, name: e.target.value })} placeholder={tr("Name (optional)")} />
          <button className="btn" onClick={addOrgA}>{tr("+ Org-admin")}</button>
        </div>
        {suggest && (
          <div className="warn-box" style={{ marginTop: 8 }}>
            ⚠️ {rich(tr("This looks like the same account as **{email}**, which already signed in. Use the **exact login email**.", { email: suggest }))}{" "}
            <button className="btn sm" style={{ marginLeft: 4 }} onClick={() => setOaForm({ ...oaForm, email: suggest })}>{tr("Use {email}", { email: suggest })}</button>
          </div>
        )}

        {dupClusters.length > 0 && (
          <div className="warn-box" style={{ marginTop: 4 }}>
            ⚠️ {rich(tr("**Possible duplicate accounts** — several emails for the same Google account (gmail vs googlemail, dots, +tags). Only the **exact login email** grants access; the others are “ghost” access. Review:"))}
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {dupClusters.map((c, i) => <li key={i}>{c.join("  ≈  ")}</li>)}
            </ul>
          </div>
        )}

        {status && status.startsWith("Failed") && <div className="warn-box err" style={{ marginTop: 6 }}>❌ {showStatus(tr, status)}</div>}

        <div className="ag-searchrow">
          <div className="search-wrap">
            <input className="game-search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={tr("Search by name or email…")} />
            {q && <button className="search-clear" aria-label={tr("Clear search")} onClick={() => setQ("")}>✕</button>}
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={onlyOrg}
            className={`ios-switch ${onlyOrg ? "on" : ""}`}
            title={tr("Show org-admins only")}
            onClick={() => setOnlyOrg((v) => !v)}>
            <span className="knob" />
          </button>
          <span className="ag-switchlbl">{tr("Org-admins only")}</span>
        </div>

        {loading && <div className="empty">{tr("Loading access…")}</div>}
        {!loading && cols.length === 0 && <div className="empty">{tr("No events yet.")}</div>}
        {!loading && cols.length > 0 && (
          <div className="grid-scroll">
            <table className="access-grid">
              <thead>
                <tr>
                  <th className="ag-user">{tr("User")}</th>
                  {cols.map((ev) => (
                    <th key={ev.id} className={ev.status === "archived" ? "ag-arch" : ""}>
                      <button className="ag-evbtn" onClick={() => nav(`/e/${ev.id}/settings`)} title={tr("Open this event's access")}>
                        {ev.name}
                      </button>
                      <div className="ag-evsub">{ev.status === "archived" ? tr("Archived") : tr("Active")}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr><td className="ag-user muted-sm" colSpan={cols.length + 1}>{tr("No users match this filter.")}</td></tr>
                )}
                {rows.map((u) => {
                  const isOrg = orgAdminEmails.has(u.email);
                  const isDup = dupEmails.has(u.email);
                  const isBuiltin = BOOTSTRAP_ORG_ADMINS.includes(u.email);
                  return (
                    <tr key={u.email}>
                      <td className="ag-user">
                        <div className="ag-name">
                          <span className="ag-nm">{u.name || "—"}</span>
                          {isDup && <span className="tag tag-dup" title={tr("Several emails for this same Google account appear in the list — check which one is the login email.")}>{tr("⚠ duplicate?")}</span>}
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isOrg}
                            aria-label={tr("org-admin")}
                            className={`ios-switch ${isOrg ? "on" : ""} ${isBuiltin ? "locked" : ""}`}
                            disabled={isBuiltin}
                            title={isBuiltin ? tr("Org-admin set in code (not removable)") : tr("org-admin — full access to all events")}
                            onClick={() => toggleOrgAdmin(u)}>
                            <span className="knob" />
                          </button>
                          <span className="ag-switchlbl">{tr("org-admin")}</span>
                        </div>
                        <div className="ag-email muted-sm">{u.email}</div>
                      </td>
                      {cols.map((ev) => {
                        if (isOrg) return <td key={ev.id} className="ag-cell ag-full">{tr("total")}</td>;
                        const k = `${u.email}||${ev.id}`;
                        const role = shownRole(u.email, ev.id);
                        return (
                          <td key={ev.id} className={`ag-cell ${errCell[k] ? "ag-err" : ""}`}>
                            <select className={`ag-role r-${role || "none"}`} value={role}
                              disabled={!!saving[k]}
                              onChange={(e) => changeRole(u, ev, e.target.value)}>
                              {ROLES.map((r) => <option key={r} value={r}>{tr(ROLE_LABEL[r])}</option>)}
                            </select>
                            {saving[k] && <span className="ag-saving">…</span>}
                            {errCell[k] && <span className="ag-cellerr" title={errCell[k]}>⚠</span>}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
