import { useState } from "react";
import { suggestKits, checkKits, countChanges, suggestRefShirts, checkRefShirts, tid, kitsByTeam } from "../officials/kits.js";
import { resolveKit } from "../kits.js";
import { KitSwatch } from "../KitSwatch.jsx";
import { useT } from "../i18n.js";

const shortTeam = (t) => String(t?.name || t || "").split(" - ")[0];
const REF_ROW = "\u0000officials";
const sum = (o) => Object.values(o).reduce((s, d) => s + Object.values(d).reduce((a, b) => a + b, 0), 0);

// "Suggest uniforms": compute a kit proposal (src/officials/kits.js), show per
// day and team which uniform it wears (and where it changes), write only on Apply.
export default function SuggestKitsModal({ games, teamKits, refKits = [], threshold, days, day, dayLabel, onApply, onClose }) {
  const tr = useT();
  const [scope, setScope] = useState(day === "all" ? "all" : day);
  const [overwrite, setOverwrite] = useState(false);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const opts = { days: scope === "all" ? [] : [scope], overwrite, threshold };

  const run = () => {
    setBusy(true); setRes(null);
    setTimeout(() => {
      try {
        // Team uniforms first, then the officials' shirts against them.
        const r = suggestKits(games, teamKits, { ...opts, refKits });
        const rs = suggestRefShirts(r.games, teamKits, refKits, opts);
        const before = checkKits(games, teamKits, opts);
        const inScope = (g) => !opts.days.length || opts.days.includes(g.date);
        const refIssues = (gs, unres) => Object.values(checkRefShirts(gs.filter(inScope), teamKits, refKits, opts)).filter((x) => (x.level === "unresolvable") === unres).length;
        setRes({
          ...r, games: rs.games, proposals: [...r.proposals, ...rs.proposals], refUnresolvable: rs.unresolvable,
          clashesBefore: Object.values(before).filter((x) => x.level === "clash").length, changesBefore: sum(countChanges(games.filter(inScope))),
          refBefore: refIssues(games, false), refAfter: refIssues(rs.games, false),
          refUnresBefore: refIssues(games, true), refUnresAfter: refIssues(rs.games, true),
        });
      } catch (e) { alert(tr("Suggest uniforms failed: {e}", { e: String(e?.message || e) })); }
      setBusy(false);
    }, 30);
  };
  const apply = async () => {
    setBusy(true);
    try { await onApply(res.proposals); onClose(); }
    catch (e) { alert(tr("Could not save: {e}", { e: String(e?.code || e?.message || e) })); setBusy(false); }
  };

  const kitsOf = kitsByTeam(games, teamKits); // team · category → its uniforms
  // Per day → team: the sequence of uniforms over its games, marking changed cells.
  const view = (() => {
    if (!res) return [];
    const changed = new Set(res.proposals.map((p) => p.gameId + p.side));
    const out = [];
    for (const d of days) {
      if (opts.days.length && !opts.days.includes(d)) continue;
      const teams = new Map();
      for (const g of res.games.filter((x) => x.date === d)) {
        for (const side of ["A", "B"]) {
          const t = tid(g, side); // team · category
          if (!t || !kitsOf[t]) continue;
          if (!teams.has(t)) teams.set(t, []);
          teams.get(t).push({ g, v: g.kit?.[side], changed: changed.has(g.id + side) });
        }
      }
      const rows = [...teams].filter(([, xs]) => xs.some((x) => x.changed)).sort(([a], [b]) => a.localeCompare(b));
      // Officials' shirts of the day, in game order.
      const refs = res.games.filter((x) => x.date === d && x.kit?.R).map((g) => ({ g, v: g.kit.R, changed: changed.has(g.id + "R") }));
      if (refs.some((x) => x.changed)) rows.push([REF_ROW, refs]);
      if (rows.length) out.push({ d, rows });
    }
    return out;
  })();

  const nChanges = res ? sum(res.changes) : 0;
  const refLabel = (id) => { const r = refKits.find((x) => x.id === id); return r ? <><KitSwatch kit={{ colors: [r.shirt] }} size={14} /> {r.name}</> : "—"; };
  const delta = (a, b) => (a === b ? <b>{b}</b> : <><s className="muted-sm">{a}</s> → <b>{b}</b></>);

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="modal aa-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-x" onClick={onClose} aria-label={tr("Close")} disabled={busy}>✕</button>
        <h3 className="modal-title">{tr("Suggest uniforms")}</h3>
        <p className="muted-sm">{tr("Picks each team's uniform so no game has similar jerseys: one uniform per team and day where possible (otherwise as few changes as possible), alternating between days. Then the officials' shirt per game, contrasting with both teams. Nothing is saved until you click Apply.")}</p>

        <div className="aa-opts">
          <label>{tr("Days")}{" "}
            <select value={scope} onChange={(e) => { setScope(e.target.value); setRes(null); }} disabled={busy}>
              <option value="all">{tr("All days")}</option>
              {days.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
            </select>
          </label>
          <span className="muted-sm" title={tr("Set on the Uniforms page")}>{tr("Clash below ΔE")} {threshold}</span>
          <label title={tr("Also replace uniforms that are already set (on the selected days)")}>
            <input type="checkbox" checked={overwrite} onChange={(e) => { setOverwrite(e.target.checked); setRes(null); }} disabled={busy} /> {tr("Overwrite existing")}
          </label>
          <button className="btn sm" onClick={run} disabled={busy}>{busy && !res ? tr("Computing…") : res ? tr("Recompute") : tr("Compute proposal")}</button>
        </div>

        {res && (
          <>
            <div className="aa-summary">
              <span>{res.proposals.length ? <><b>{res.proposals.length}</b> {res.proposals.length === 1 ? tr("uniform set") : tr("uniforms set")}</> : tr("No changes")}</span>
              <span>{tr("Clashes")} {delta(res.clashesBefore, res.clashes.length)}</span>
              <span>{tr("Kit changes")} {delta(res.changesBefore, nChanges)}</span>
              {refKits.length > 0 && <span>{tr("Referee shirt clashes")} {delta(res.refBefore, res.refAfter)}</span>}
              {refKits.length > 0 && (res.refUnresBefore > 0 || res.refUnresAfter > 0) && <span title={tr("No referee shirt colour contrasts with both teams")}>{tr("Without a fitting referee shirt")} {delta(res.refUnresBefore, res.refUnresAfter)}</span>}
            </div>
            {res.unresolvable.length > 0 && <p className="muted-sm">{res.unresolvable.length === 1 ? tr("{n} game can't be resolved — every uniform combination of the two teams clashes.", { n: 1 }) : tr("{n} games can't be resolved — every uniform combination of the two teams clashes.", { n: res.unresolvable.length })}</p>}
            {res.refUnresolvable.length > 0 && <p className="muted-sm">{res.refUnresolvable.length === 1 ? tr("{n} game without a fitting referee shirt — no colour contrasts with both teams.", { n: 1 }) : tr("{n} games without a fitting referee shirt — no colour contrasts with both teams.", { n: res.refUnresolvable.length })}</p>}
            {Object.entries(res.changes).length > 0 && (
              <p className="warn-box">{tr("Teams that must change uniform during a day:")} {Object.entries(res.changes).map(([t, ds]) => Object.entries(ds).map(([d, n]) => tr("{team} {n}× on {day}", { team: shortTeam(t), n, day: dayLabel(d) })).join(", ")).join("; ")}</p>
            )}
            {view.length > 0 && (
              <div className="grid-scroll aa-diff">
                <table className="ref-grid">
                  <thead><tr><th>{tr("Day")}</th><th>{tr("Team")}</th><th>{tr("Uniform per game")}</th></tr></thead>
                  <tbody>
                    {view.flatMap(({ d, rows }) => rows.map(([t, xs], i) => (
                      <tr key={d + t}>
                        <td>{i === 0 ? dayLabel(d) : ""}</td>
                        <td>{t === REF_ROW ? <i>{tr("Officials")}</i> : shortTeam(t)}</td>
                        <td className="sk-seq">{xs.map(({ g, v, changed }) => (
                          <span key={g.id} className={`sk-item ${changed ? "sk-new" : ""}`} title={`#${g.nr} ${g.time}${changed ? ` — ${tr("new")}` : ""}`}>
                            <span className="muted-sm">#{g.nr}</span> {t === REF_ROW ? refLabel(v) : <><KitSwatch kit={resolveKit(v, kitsOf[t])} size={14} /> {typeof v === "number" ? v : "—"}</>}
                          </span>
                        ))}</td>
                      </tr>
                    )))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: 14 }}>
              <button className="btn" onClick={onClose} disabled={busy}>{tr("Cancel")}</button>
              <button className="btn primary" onClick={apply} disabled={busy || !res.proposals.length}>{busy ? tr("Saving…") : res.proposals.length === 1 ? tr("Apply {n} uniform", { n: 1 }) : tr("Apply {n} uniforms", { n: res.proposals.length })}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
