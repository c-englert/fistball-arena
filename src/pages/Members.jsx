import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { subscribeMembers, addMember, removeMember, subscribePeople } from "../cloud.js";
import { useEvent } from "../eventContext.js";

const ROLES = ["admin", "official", "viewer"];

export default function Members({ me }) {
  const nav = useNavigate();
  const { eventId, event, archived, isAdmin } = useEvent();
  const [members, setMembers] = useState([]);
  const [people, setPeople] = useState([]);
  const [form, setForm] = useState({ email: "", name: "", role: "official" });
  const [status, setStatus] = useState("");

  useEffect(() => subscribeMembers(setMembers), [eventId]);
  useEffect(() => subscribePeople(setPeople), []);

  if (!isAdmin) return <div className="empty">Admins only.</div>;

  const memberEmails = useMemo(() => new Set(members.map((m) => m.email)), [members]);
  const directory = useMemo(
    () => people.filter((p) => !memberEmails.has(p.email)).sort((a, b) => (a.name || a.email).localeCompare(b.name || b.email)),
    [people, memberEmails]
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
  // Autofill name when the typed email matches a known person.
  const onEmail = (v) => {
    const hit = people.find((p) => p.email === v.toLowerCase().trim());
    setForm((f) => ({ ...f, email: v, name: hit ? hit.name || f.name : f.name }));
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="iconbtn" onClick={() => nav(`/e/${eventId}`)}>‹ Games</button>
        <div className="brand-logo sm"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <div className="spacer" />
        <div style={{ textAlign: "right" }}>
          <div className="title">Access{archived && <span className="arch-badge">Archived</span>}</div>
          <div className="sub">{event?.name}</div>
        </div>
      </header>

      <div className="content">
        {!archived && (
          <div className="card">
            <h2>Authorize a person</h2>
            <div className="add-row" style={{ flexWrap: "wrap" }}>
              <input style={{ flex: "2 1 200px" }} list="people-dl" value={form.email} onChange={(e) => onEmail(e.target.value)} placeholder="email@example.com" />
              <input style={{ flex: "1 1 120px" }} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Name (optional)" />
              <select value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
              <button className="btn primary" onClick={() => add(null)}>Add</button>
            </div>
            <datalist id="people-dl">{people.map((p) => <option key={p.email} value={p.email}>{p.name}</option>)}</datalist>
            <p className="muted-sm">admin = manage event · official = fill súmulas · viewer = read only. {status}</p>
          </div>
        )}

        {!archived && directory.length > 0 && (
          <div className="card">
            <h2>From the directory ({directory.length})</h2>
            <p className="muted-sm">People used in other events — authorize with one click.</p>
            {directory.map((p) => (
              <DirRow key={p.email} person={p} onAuthorize={(role) => add(p, role)} />
            ))}
          </div>
        )}

        <div className="card">
          <h2>{members.length} in this event</h2>
          {members.length === 0 && <p className="muted-sm">No one authorized yet.</p>}
          {members.map((m) => (
            <div className="roster-row" key={m.id}>
              <span className="roster-nr role">{(m.role || "?")[0].toUpperCase()}</span>
              <span className="roster-name">{m.name || m.email} {m.name && <span className="muted-sm">{m.email}</span>}</span>
              <span className="tag">{m.role}</span>
              {!archived && <button className="btn danger sm" style={{ marginLeft: 8 }} onClick={() => remove(m.email)}>Remove</button>}
            </div>
          ))}
        </div>
      </div>
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
