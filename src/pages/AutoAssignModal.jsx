import { useMemo, useState } from "react";
import { autoAssign } from "../officials/assign.js";
import { SLOT_LABEL, teamsLabel } from "../officials/rules.js";
import { useT, tNow } from "../i18n.js";

// Auto-assign officials: compute a proposal (src/officials/assign.js), show it
// as a diff, and write it only when the admin clicks Apply.
export default function AutoAssignModal({ games, refs, entries, rules, days, day, dayLabel, onApply, onClose }) {
  const t = useT();
  const [scope, setScope] = useState(day === "all" ? "all" : day);
  const [overwrite, setOverwrite] = useState(false);
  const [res, setRes] = useState(null);
  const [busy, setBusy] = useState(false);
  const byId = useMemo(() => new Map(games.map((g) => [g.id, g])), [games]);

  const run = () => {
    setBusy(true); setRes(null);
    // Let the "Computing…" state paint before the (synchronous) solver runs.
    setTimeout(() => {
      try { setRes(autoAssign(games, refs, entries, { days: scope === "all" ? [] : [scope], overwrite, rules })); }
      catch (e) { alert(tNow("Auto-assign failed: {err}", { err: e?.message || e })); }
      setBusy(false);
    }, 30);
  };
  const apply = async () => {
    setBusy(true);
    try { await onApply(res); onClose(); }
    catch (e) { alert(tNow("Could not save: {err}", { err: e?.code || e?.message || e })); setBusy(false); }
  };

  const nGames = res ? new Set(res.proposals.map((p) => p.gameId)).size : 0;
  const delta = (a, b) => (a === b ? <b>{b}</b> : <><s className="muted-sm">{a}</s> → <b>{b}</b></>);

  return (
    <div className="modal-overlay" onClick={() => !busy && onClose()}>
      <div className="modal aa-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-x" onClick={onClose} aria-label={t("Close")} disabled={busy}>✕</button>
        <h3 className="modal-title">{t("Auto-assign officials")}</h3>
        <p className="muted-sm">{t("Fills empty slots from the officials registry: no conflicts, assistant pairs together, load spread evenly, breaks between games where possible. Nothing is saved until you click Apply.")}</p>

        <div className="aa-opts">
          <label>{t("Days")}{" "}
            <select value={scope} onChange={(e) => { setScope(e.target.value); setRes(null); }} disabled={busy}>
              <option value="all">{t("All days")}</option>
              {days.map((d) => <option key={d} value={d}>{dayLabel(d)}</option>)}
            </select>
          </label>
          <label title={t("Also recompute the officials auto-assign filled in before (on the selected days). Officials set by hand always stay.")}>
            <input type="checkbox" checked={overwrite} onChange={(e) => { setOverwrite(e.target.checked); setRes(null); }} disabled={busy} /> {t("Overwrite auto-assigned entries")}
          </label>
          <button className="btn sm" onClick={run} disabled={busy}>{busy && !res ? t("Computing…") : res ? t("Recompute") : t("Compute proposal")}</button>
        </div>

        {res && (
          <>
            <div className="aa-summary">
              <span>{res.proposals.length ? t(res.proposals.length === 1 ? (nGames === 1 ? "{n} change in {g} game" : "{n} change in {g} games") : (nGames === 1 ? "{n} changes in {g} game" : "{n} changes in {g} games"), { n: res.proposals.length, g: nGames }) : t("No changes")}</span>
              <span>{t("Conflicts")} {delta(res.before.counts.hard, res.after.counts.hard)}</span>
              <span>{t("Warnings")} {delta(res.before.counts.soft, res.after.counts.soft)}</span>
              <span>{t("Empty required")} {delta(res.before.counts.missing, res.after.counts.missing)}</span>
              <span className="muted-sm" title={t("Lower is better")}>{t("Penalty")} {Math.round(res.scoreBefore)} → {Math.round(res.scoreAfter)}</span>
            </div>
            {res.skipped.length > 0 && <p className="muted-sm">{t(res.skipped.length === 1 ? "{n} knockout game skipped — teams not known yet." : "{n} knockout games skipped — teams not known yet.", { n: res.skipped.length })}</p>}
            {res.unfilled.length > 0 && <p className="warn-box">{t(res.unfilled.length === 1 ? "{n} slot could not be filled — no eligible official (check availability, roles, nations)." : "{n} slots could not be filled — no eligible official (check availability, roles, nations).", { n: res.unfilled.length })}</p>}
            {res.proposals.length > 0 && (
              <div className="grid-scroll aa-diff">
                <table className="ref-grid">
                  <thead><tr><th>{t("Game")}</th><th>{t("Slot")}</th><th>{t("Change")}</th></tr></thead>
                  <tbody>
                    {res.proposals.map((p) => {
                      const g = byId.get(p.gameId);
                      const iss = res.after.cells[p.gameId]?.[p.slot];
                      return (
                        <tr key={p.gameId + p.slot}>
                          <td><b>#{g?.nr}</b> <span className="muted-sm">{dayLabel(g?.date)} {g?.time}</span><div className="muted-sm">{g && teamsLabel(g)}</div></td>
                          <td>{t(SLOT_LABEL[p.slot])}</td>
                          <td>
                            {p.from && <><s className="muted-sm">{p.from}</s> → </>}<b>{p.to || "—"}</b>
                            {iss?.length > 0 && <div className={iss.some((i) => i.level === "hard") ? "aa-hard" : "aa-soft"}>{iss.map((i) => t(i.msg)).join(" · ")}</div>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="modal-actions" style={{ marginTop: 14 }}>
              <button className="btn" onClick={onClose} disabled={busy}>{t("Cancel")}</button>
              <button className="btn primary" onClick={apply} disabled={busy || !res.proposals.length}>{busy ? t("Saving…") : t(res.proposals.length === 1 ? "Apply {n} change" : "Apply {n} changes", { n: res.proposals.length })}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
