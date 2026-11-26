import { useEffect, useMemo, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { subscribeGames, subscribeResults, subscribeMdp, saveMdp } from "../cloud.js";
import { useEvent } from "../eventContext.js";
import { flagFor } from "../flags.js";
import { useT } from "../i18n.js";
import { mdpPageUrl } from "../broadcast.js";
import { ACTIONS, replay, teamStats, STAT_ROWS, other } from "../mdp/mdp.js";

// MDP — Map Definition Point. The scout records, for every point, which team
// won it and the action that defined it (one tap); the statistics compare both
// teams head to head per set or for the whole game.

const short = (n) => String(n || "").split(" - ")[0];
const nameOf = (t) => (t && typeof t === "object" ? t.name : t) || "";

export default function Mdp({ me }) {
  const { id } = useParams();
  const nav = useNavigate();
  const tr = useT();
  const { eventId, canScout } = useEvent();
  const [games, setGames] = useState([]);
  const [results, setResults] = useState([]);
  const [mdp, setMdp] = useState(null);
  const [loadErr, setLoadErr] = useState(null);
  const [tab, setTab] = useState(canScout ? "scout" : "stats");
  useEffect(() => subscribeGames(setGames), []);
  useEffect(() => subscribeResults(setResults), []);
  useEffect(() => subscribeMdp(id, (d) => { setLoadErr(null); setMdp(d); }, setLoadErr), [id]);

  const game = games.find((g) => g.id === id);
  const result = results.find((r) => r.id === id);
  const A = short(nameOf(game?.teamA) || result?.teamA) || "A";
  const B = short(nameOf(game?.teamB) || result?.teamB) || "B";
  const name = { A, B };
  const rp = useMemo(() => replay(mdp), [mdp]);

  const save = (next) => {
    setMdp(next);
    saveMdp(id, next, me?.email).catch((e) => alert(tr("Could not save: {e}", { e: String(e?.code || e?.message || e) })));
  };
  const add = (w, a) => save({ ...mdp, log: [...(mdp?.log || []), { w, a }] });
  const undo = () => { const log = [...(mdp?.log || [])]; log.pop(); save({ ...mdp, log }); };
  const endSet = () => { if (window.confirm(tr("End set {n} now?", { n: rp.current + 1 }))) save({ ...mdp, log: [...(mdp?.log || []), { next: true }] }); };
  const setServe = (t) => save({ ...mdp, serve: { ...(mdp?.serve || {}), [rp.current]: t } });

  if (!mdp && loadErr) return (
    <div className="empty">
      {loadErr.code === "permission-denied"
        ? tr("MDP is not enabled on the server yet (database rules not published). Ask the system administrator.")
        : tr("Could not load MDP: {e}", { e: String(loadErr.code || loadErr.message || loadErr) })}
    </div>
  );
  if (!mdp) return <div className="empty">{tr("Loading…")}</div>;
  const curSet = rp.sets[rp.current] || { points: [], a: 0, b: 0 };
  const opening = !curSet.points.length; // no point yet in the set being scouted

  return (
    <>
      <div className="page-h game-h">
        <button className="iconbtn" onClick={() => nav(`/e/${eventId}/game/${id}`)}>{tr("‹ Game")}</button>
        <div>
          <div className="gh-title">MDP · {game?.nr ? `#${game.nr} · ` : ""}{flagFor(A)} {A} {tr("vs")} {B} {flagFor(B)}</div>
          <div className="gh-sub">{tr("Map Definition Point — how each point was decided")}</div>
        </div>
        <div className="gh-actions">
          <a className="btn sm" href={mdpPageUrl(eventId, id)} target="_blank" rel="noreferrer" title={tr("Public statistics page for TV and commentators")}>{tr("📺 TV page")}</a>
        </div>
      </div>
      <div className="plan-bar">
        <span className="filter-pill-group">
          {canScout && <button className={`filter-pill ${tab === "scout" ? "active" : ""}`} onClick={() => setTab("scout")}>{tr("Scout")}</button>}
          <button className={`filter-pill ${tab === "stats" ? "active" : ""}`} onClick={() => setTab("stats")}>{tr("Statistics")}</button>
        </span>
      </div>

      {tab === "scout" && canScout ? (
        <section className="card mdp-scout">
          <div className="mdp-score">
            <span className="mdp-set">{tr("Set {n}", { n: rp.current + 1 })}</span>
            <span className="mdp-team a">{A}</span>
            <b>{curSet.a} : {curSet.b}</b>
            <span className="mdp-team b">{B}</span>
            {result?.sets?.[rp.current] && <span className="muted-sm" title={tr("Score in the game report")}>{tr("Game report")}: {result.sets[rp.current].a}:{result.sets[rp.current].b}</span>}
          </div>
          <div className="mdp-serve">
            {tr("Serve")}: <b>{name[rp.nextServer]}</b>
            {opening && <button className="btn sm" onClick={() => setServe(other(rp.nextServer))}>{tr("Switch — {team} serves", { team: name[other(rp.nextServer)] })}</button>}
          </div>
          <div className="mdp-cols">
            {["A", "B"].map((T) => {
              const O = other(T);
              return (
                <div key={T} className={`mdp-col ${T === "A" ? "a" : "b"}`}>
                  <div className="mdp-col-h">{tr("Point for {team}", { team: name[T] })}</div>
                  {ACTIONS.filter((x) => x.by === "winner").map((x) => (
                    <button key={x.key} className={`mdp-btn ${x.key === "ace" && rp.nextServer !== T ? "dim" : ""}`} onClick={() => add(T, x.key)}>{tr(x.label)}</button>
                  ))}
                  <div className="mdp-col-sub">{tr("Error by {team}", { team: name[O] })}</div>
                  {ACTIONS.filter((x) => x.by === "loser").map((x) => (
                    <button key={x.key} className={`mdp-btn err ${x.key === "serviceError" && rp.nextServer !== O ? "dim" : ""}`} onClick={() => add(T, x.key)}>{tr(x.label)}</button>
                  ))}
                </div>
              );
            })}
          </div>
          <div className="mdp-actions">
            <button className="btn sm" onClick={undo} disabled={!(mdp.log || []).length}>{tr("↶ Undo last")}</button>
            <span className="spacer" />
            <button className="btn sm" onClick={endSet} disabled={opening}>{tr("End set")}</button>
          </div>
          <ol className="mdp-last" reversed>
            {rp.sets.flatMap((s, si) => {
              let a = 0, b = 0;
              return s.points.map((p) => { if (p.w === "A") a++; else b++; return { ...p, si, sc: `${a}:${b}` }; });
            }).slice(-8).reverse().map((p) => (
              <li key={`${p.si}-${p.n}`}><span className="muted-sm">{tr("Set {n}", { n: p.si + 1 })} · {p.sc}</span> <b className={p.w === "A" ? "mdp-a" : "mdp-b"}>{name[p.w]}</b> — {tr(ACTIONS.find((x) => x.key === p.a).label)}{ACTIONS.find((x) => x.key === p.a).by === "loser" ? ` (${name[other(p.w)]})` : ""}</li>
            ))}
          </ol>
        </section>
      ) : (
        <MdpStats rp={rp} name={name} />
      )}
    </>
  );
}

// Head-to-head table: whole game or one set.
export function MdpStats({ rp, name }) {
  const tr = useT();
  const [scope, setScope] = useState("game");
  const points = scope === "game" ? rp.sets.flatMap((s) => s.points) : rp.sets[scope]?.points || [];
  const st = teamStats(points);
  const fmt = (v, unit) => (v == null ? "—" : unit === "%" ? `${Math.round(v)}%` : v);
  if (!rp.sets.length) return <section className="card"><p className="muted-sm">{tr("No points scouted yet.")}</p></section>;
  return (
    <section className="card mdp-stats">
      <div className="filter-pill-group" style={{ marginBottom: 10 }}>
        <button className={`filter-pill ${scope === "game" ? "active" : ""}`} onClick={() => setScope("game")}>{tr("Whole game")}</button>
        {rp.sets.map((s, i) => <button key={i} className={`filter-pill ${scope === i ? "active" : ""}`} onClick={() => setScope(i)}>{tr("Set {n}", { n: i + 1 })} ({s.a}:{s.b})</button>)}
      </div>
      <table className="mdp-h2h">
        <thead><tr><th className="a">{name.A}</th><th /><th className="b">{name.B}</th></tr></thead>
        <tbody>
          {STAT_ROWS.map((g) => [
            <tr key={g.group} className="mdp-group"><td colSpan={3}>{tr(g.group)}</td></tr>,
            ...g.rows.map(([k, label, unit]) => {
              const a = st.A[k], b = st.B[k];
              const sum = unit === "%" ? 100 : (a || 0) + (b || 0);
              const w = (v) => `${sum ? Math.round(((v || 0) / (unit === "%" ? 100 : sum)) * 100) : 0}%`;
              return (
                <tr key={k}>
                  <td className="mdp-val a"><span className="mdp-bar a" style={{ width: w(a) }} /><b>{fmt(a, unit)}</b></td>
                  <td className="mdp-label">{tr(label)}</td>
                  <td className="mdp-val b"><span className="mdp-bar b" style={{ width: w(b) }} /><b>{fmt(b, unit)}</b></td>
                </tr>
              );
            }),
          ])}
        </tbody>
      </table>
    </section>
  );
}
