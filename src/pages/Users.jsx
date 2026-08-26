import { useEffect, useMemo, useState } from "react";
import { subscribeOrgAdmins, addOrgAdmin, removeOrgAdmin, subscribePeople, BOOTSTRAP_ORG_ADMINS } from "../cloud.js";

// Same Gmail account written differently — used only to warn.
function canonEmail(e) {
  const s = String(e || "").trim().toLowerCase();
  const at = s.indexOf("@");
  if (at < 0) return s;
  const local = s.slice(0, at), domain = s.slice(at + 1);
  if (domain === "gmail.com" || domain === "googlemail.com") return `${local.split("+")[0].replace(/\./g, "")}@gmail.com`;
  return s;
}

// GLOBAL users & access area (org-admins only). Org-admins have full access to
// every event; per-event access is still granted inside each event's Settings.
export default function Users({ me }) {
  const [orgAdmins, setOrgAdmins] = useState([]);
  const [people, setPeople] = useState([]);
  const [oaForm, setOaForm] = useState({ email: "", name: "" });
  const [status, setStatus] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => subscribeOrgAdmins(setOrgAdmins), []);
  useEffect(() => subscribePeople(setPeople), []);

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

  const shownPeople = useMemo(() => {
    const t = q.trim().toLowerCase();
    return [...people]
      .filter((p) => !t || (p.email || "").toLowerCase().includes(t) || (p.name || "").toLowerCase().includes(t))
      .sort((a, b) => (a.name || a.email || "").localeCompare(b.name || b.email || ""));
  }, [people, q]);

  if (!me?.admin) return <div className="empty">Org-admins only.</div>;

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
    <>
      <h2 className="page-h">Usuários & acessos</h2>

      <div className="card">
        <h2>Org-admins <span className="muted-sm" style={{ fontWeight: 400 }}>· acesso total a TODOS os eventos</span></h2>
        <p className="muted-sm">Org-admins criam e gerenciam qualquer evento. Para dar acesso a <b>um único evento</b>, abra o evento → <b>Configurações → Acesso a este evento</b>.</p>
        <div className="add-row" style={{ marginTop: 8 }}>
          <input style={{ flex: "2 1 200px" }} value={oaForm.email} onChange={(e) => setOaForm({ ...oaForm, email: e.target.value })} placeholder="email@example.com" />
          <input style={{ flex: "1 1 120px" }} value={oaForm.name} onChange={(e) => setOaForm({ ...oaForm, name: e.target.value })} placeholder="Nome (opcional)" />
          <button className="btn primary" onClick={addOrgA}>Add org-admin</button>
        </div>
        {suggest && (
          <div className="warn-box" style={{ marginTop: 8 }}>
            ⚠️ Isto parece a mesma conta que <b>{suggest}</b>, que já entrou. Use o <b>e-mail exato de login</b>.{" "}
            <button className="btn sm" style={{ marginLeft: 4 }} onClick={() => setOaForm({ ...oaForm, email: suggest })}>Usar {suggest}</button>
          </div>
        )}
        <div style={{ marginTop: 10 }}>
          {[...orgAdminEmails].sort().map((emailAddr) => {
            const isBootstrap = BOOTSTRAP_ORG_ADMINS.includes(emailAddr);
            const rec = orgAdmins.find((o) => o.email === emailAddr);
            return (
              <div className="roster-row" key={emailAddr}>
                <span className="roster-nr role">A</span>
                <span className="roster-name">{rec?.name || emailAddr} {rec?.name && <span className="muted-sm">{emailAddr}</span>}</span>
                {isBootstrap
                  ? <span className="tag">built-in</span>
                  : <button className="btn danger sm" style={{ marginLeft: 8 }} onClick={() => removeOrgA(emailAddr)}>Remover</button>}
              </div>
            );
          })}
        </div>
        <p className="muted-sm" style={{ marginTop: 6 }}>Org-admins “built-in” são definidos no código e não podem ser removidos aqui. Os demais passam a valer quando a pessoa entrar de novo. {status}</p>
      </div>

      <div className="card">
        <div className="row-between" style={{ alignItems: "center" }}>
          <h2 style={{ margin: 0 }}>Todos os usuários <span className="muted-sm" style={{ fontWeight: 400 }}>· {people.length}</span></h2>
        </div>
        <p className="muted-sm">Pessoas que já entraram no app pelo menos uma vez. O acesso por evento (quem pontua/gerencia cada evento) aparecerá aqui em grid na próxima fase.</p>
        <input className="game-search" style={{ marginTop: 8, width: "100%" }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar por nome ou e-mail…" />
        <div style={{ marginTop: 10 }}>
          {shownPeople.length === 0 && <div className="empty">Nenhum usuário encontrado.</div>}
          {shownPeople.map((p) => (
            <div className="roster-row" key={p.email}>
              <span className="roster-name">{p.name || "—"} <span className="muted-sm">{p.email}</span></span>
              {orgAdminEmails.has(p.email) && <span className="tag tag-org">org-admin</span>}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
