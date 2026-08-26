import { useEffect, useMemo, useState } from "react";
import { subscribeMembers, addMember, removeMember, subscribePeople, subscribeOrgAdmins, BOOTSTRAP_ORG_ADMINS } from "../cloud.js";
import { useEvent } from "../eventContext.js";

const ROLES = ["admin", "official", "viewer"];

// Same Gmail account written differently (gmail ⇄ googlemail, dots, +tags) —
// used only to WARN; access still needs the exact login email (rules match the raw token).
function canonEmail(e) {
  const s = String(e || "").trim().toLowerCase();
  const at = s.indexOf("@");
  if (at < 0) return s;
  const local = s.slice(0, at), domain = s.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
  return s;
}

// Per-event access panel: who can access THIS event, plus a read-only note that
// org-admins already have full access. Embedded in the setup wizard and the
// standalone Access page. Managing org-admins themselves lives elsewhere (global).
export default function EventAccess({ me }) {
  const { eventId, archived } = useEvent();
  const [members, setMembers] = useState([]);
  const [people, setPeople] = useState([]);
  const [orgAdmins, setOrgAdmins] = useState([]);
  const [form, setForm] = useState({ email: "", name: "", role: "official" });
  const [status, setStatus] = useState("");

  useEffect(() => subscribeMembers(setMembers), [eventId]);
  useEffect(() => subscribePeople(setPeople), []);
  useEffect(() => subscribeOrgAdmins(setOrgAdmins), []);

  const orgAdminList = useMemo(() => {
    const byEmail = new Map(orgAdmins.map((o) => [o.email, o]));
    return [...new Set([...BOOTSTRAP_ORG_ADMINS, ...orgAdmins.map((o) => o.email)])]
      .sort()
      .map((email) => ({ email, name: byEmail.get(email)?.name || "", builtin: BOOTSTRAP_ORG_ADMINS.includes(email) }));
  }, [orgAdmins]);

  const memberEmails = useMemo(() => new Set(members.map((m) => m.email)), [members]);
  const orgAdminEmails = useMemo(() => new Set(orgAdminList.map((o) => o.email)), [orgAdminList]);
  const directory = useMemo(
    () => people
      .filter((p) => !memberEmails.has(p.email) && !orgAdminEmails.has(p.email))
      .sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)),
    [people, memberEmails, orgAdminEmails]
  );

  const add = async (person, role) => {
    const payload = person || form;
    if (!payload.email.trim()) return;
    setStatus("Adding…");
    try {
      await addMember({ email: payload.email, name: payload.name, role: role || payload.role || "official" }, me);
      if (!person) setForm({ email: "", name: "", role: "official" });
      setStatus("");
    } catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };
  const remove = async (email) => {
    if (!window.confirm(`Remove ${email} from this event?`)) return;
    try { await removeMember(email); } catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };
  const onEmail = (v) => {
    const hit = people.find((p) => p.email === v.toLowerCase().trim());
    setForm((f) => ({ ...f, email: v, name: hit ? hit.name || f.name : f.name }));
  };
  const suggestFor = (email) => {
    const t = String(email || "").trim().toLowerCase();
    if (!t.includes("@")) return null;
    const c = canonEmail(t);
    const hit = people.find((p) => canonEmail(p.email) === c && (p.email || "").toLowerCase() !== t);
    return hit ? hit.email : null;
  };
  const memberSuggest = suggestFor(form.email);

  return (
    <div className="access-panel">
      <div className="callout-box">🔑 You’re granting access to <b>this event</b>. The event creator and the organization admins (org-admins) already have full access to every event — no need to add them here.</div>

      <div className="subhead">Already have access automatically</div>
      <div className="acc-auto">
        {orgAdminList.map((o) => (
          <div className="roster-row" key={o.email}>
            <span className="roster-nr role">A</span>
            <span className="roster-name">{o.name || o.email} {o.name && <span className="muted-sm">{o.email}</span>}</span>
            <span className="tag tag-org">org-admin · all events</span>
          </div>
        ))}
        {orgAdminList.length === 0 && <p className="muted-sm">—</p>}
      </div>

      {!archived && (
        <>
          <div className="subhead" style={{ marginTop: 14 }}>Authorize a person for this event</div>
          <div className="add-row" style={{ flexWrap: "wrap" }}>
            <input style={{ flex: "2 1 200px" }} list="ea-people-dl" value={form.email} onChange={(e) => onEmail(e.target.value)} placeholder="email@example.com" />
            <input style={{ flex: "1 1 120px" }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name (optional)" />
            <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <button className="btn primary" onClick={() => add(null)}>Add</button>
          </div>
          <datalist id="ea-people-dl">{people.map((p) => <option key={p.email} value={p.email}>{p.name}</option>)}</datalist>
          {memberSuggest && (
            <div className="warn-box" style={{ marginTop: 8 }}>
              ⚠️ This looks like the same account as <b>{memberSuggest}</b>, which already signed in. Access needs the <b>exact login email</b> (gmail ≠ googlemail, and dots matter).{" "}
              <button className="btn sm" style={{ marginLeft: 4 }} onClick={() => onEmail(memberSuggest)}>Use {memberSuggest}</button>
            </div>
          )}
          <p className="muted-sm">admin = manage event · official = fill game reports · viewer = read only. {status}</p>
        </>
      )}

      {!archived && directory.length > 0 && (
        <>
          <div className="subhead" style={{ marginTop: 14 }}>From the directory ({directory.length})</div>
          <p className="muted-sm" style={{ marginTop: 0 }}>People used in other events — authorize with one click.</p>
          {directory.map((p) => <DirRow key={p.email} person={p} onAuthorize={(role) => add(p, role)} />)}
        </>
      )}

      <div className="subhead" style={{ marginTop: 14 }}>With access to this event ({members.length})</div>
      {members.length === 0 && <p className="muted-sm">No one added yet — org-admins above still have access.</p>}
      {members.map((m) => (
        <div className="roster-row" key={m.id}>
          <span className="roster-nr role">{(m.role || "?")[0].toUpperCase()}</span>
          <span className="roster-name">{m.name || m.email} {m.name && <span className="muted-sm">{m.email}</span>}</span>
          <span className="tag">{m.role}</span>
          {!archived && <button className="btn danger sm" style={{ marginLeft: 8 }} onClick={() => remove(m.email)}>Remove</button>}
        </div>
      ))}
    </div>
  );
}

function DirRow({ person, onAuthorize }) {
  const [role, setRole] = useState("official");
  return (
    <div className="roster-row">
      <span className="roster-name">{person.name || person.email} {person.name && <span className="muted-sm">{person.email}</span>}</span>
      <select value={role} onChange={(e) => setRole(e.target.value)}>{ROLES.map((r) => <option key={r} value={r}>{r}</option>)}</select>
      <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => onAuthorize(role)}>Authorize</button>
    </div>
  );
}
