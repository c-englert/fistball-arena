import { useEffect, useMemo, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { pdf } from "@react-pdf/renderer";
import {
  ensureReport, subscribeReport, acquireLock, releaseLock, heartbeat,
  adminUnlock, saveReport, submitReport,
} from "../cloud.js";
import SumulaPDF from "../pdf/SumulaPDF.jsx";

const SECTIONS = [
  ["info", "Info"],
  ["lineup", "Line-ups"],
  ["score", "Score"],
  ["refs", "Referees"],
  ["finish", "Finish"],
];

export default function Sumula({ me }) {
  const { id } = useParams();
  const nav = useNavigate();
  const [draft, setDraft] = useState(null);
  const [lockedBy, setLockedBy] = useState(null);
  const [submitted, setSubmitted] = useState(false);
  const [section, setSection] = useState("info");
  const [team, setTeam] = useState("teamA");
  const [saving, setSaving] = useState(false);
  const holdRef = useRef(false);
  const draftRef = useRef(null);
  const saveTimer = useRef(null);

  const iHold = !!lockedBy && lockedBy.uid === me.uid;
  const readOnly = !iHold || submitted;

  useEffect(() => {
    let unsub;
    (async () => {
      await ensureReport(id);
      await acquireLock(id, me);
      unsub = subscribeReport(id, (data) => {
        if (!data) return;
        setLockedBy(data.lockedBy || null);
        const done = data.status === "submitted";
        setSubmitted(done);
        const holding = !!data.lockedBy && data.lockedBy.uid === me.uid;
        holdRef.current = holding;
        // Load the doc on first load, or keep live-viewing when we don't hold the lock.
        if (!draftRef.current || !holding || done) {
          const d = extractDraft(data);
          draftRef.current = d;
          setDraft(d);
        }
      });
    })();
    const hb = setInterval(() => { if (holdRef.current) heartbeat(id, me); }, 20000);
    return () => {
      clearInterval(hb);
      if (unsub) unsub();
      if (holdRef.current) releaseLock(id, me);
    };
  }, [id]);

  function update(mutator) {
    if (readOnly) return;
    setDraft((cur) => {
      const next = structuredClone(cur);
      mutator(next);
      draftRef.current = next;
      setSaving(true);
      clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        saveReport(id, me, pickSumula(next)).then(() => setSaving(false));
      }, 400);
      return next;
    });
  }

  const scoring = useMemo(() => computeScore(draft), [draft]);

  async function downloadPDF() {
    const blob = await pdf(<SumulaPDF draft={draft} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `sumula-${draft.info.nr}-${short(draft.teamA.name)}-vs-${short(draft.teamB.name)}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  if (!draft) return <div className="empty">Loading…</div>;

  return (
    <div className="app">
      <header className="topbar">
        <button className="iconbtn" onClick={() => nav("/")}>‹ Games</button>
        <div className="brand-logo sm"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <div className="spacer" />
        <div style={{ textAlign: "right" }}>
          <div className="title">#{draft.info.nr} · {short(draft.teamA.name)} vs {short(draft.teamB.name)}</div>
          <div className="sub">{draft.info.time} · Court {draft.info.court} · Best of {draft.info.bestOf}</div>
        </div>
      </header>

      {readOnly && (
        <div className="lockbar">
          <span>
            {submitted
              ? "✓ This report was submitted — read only."
              : `🔒 Being scored by ${lockedBy?.name || "another official"} — read only.`}
          </span>
          {me.admin && !submitted && lockedBy && lockedBy.uid !== me.uid && (
            <button className="btn danger sm" onClick={() => adminUnlock(id)}>Admin unlock</button>
          )}
        </div>
      )}

      <nav className="steps">
        {SECTIONS.map(([k, label]) => (
          <button key={k} className={`step ${section === k ? "active" : ""}`} onClick={() => setSection(k)}>
            {label}
          </button>
        ))}
      </nav>

      <div className="content">
        {section === "info" && <InfoSection d={draft} />}
        {section === "lineup" && (
          <LineupSection d={draft} team={team} setTeam={setTeam} update={update} />
        )}
        {section === "score" && <ScoreSection d={draft} scoring={scoring} update={update} />}
        {section === "refs" && <RefsSection d={draft} update={update} />}
        {section === "finish" && <FinishSection d={draft} scoring={scoring} update={update} onPdf={downloadPDF} />}
      </div>

      <div className="bottombar">
        <span className="status">
          {submitted ? "✓ Submitted" : readOnly ? "Read only" : saving ? "Saving…" : "✓ Saved (live)"}
        </span>
        {section !== "finish" ? (
          <button className="btn primary" onClick={() => setSection(nextSection(section))}>Next ›</button>
        ) : (
          <button className="btn primary" disabled={readOnly} onClick={() => submitReport(id, me)}>
            {submitted ? "Submitted" : "Submit report"}
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------------- sections ---------------- */

function InfoSection({ d }) {
  const rows = [
    ["Match Nr", "#" + d.info.nr],
    ["Date", d.info.date],
    ["Time", d.info.time],
    ["Court", d.info.court],
    ["Round", d.info.round],
    ["Category", d.info.category],
    ["Best of", d.info.bestOf],
    ["Team A", d.teamA.name],
    ["Team B", d.teamB.name],
  ];
  return (
    <div className="card">
      <h2>Match information</h2>
      <div className="grid2">
        {rows.map(([k, v]) => (
          <div className="field" key={k}>
            <label>{k}</label>
            <div className="readonly">{v}</div>
          </div>
        ))}
      </div>
      <p style={{ color: "var(--muted)", fontSize: 14 }}>
        Round &amp; category come from the schedule; the rest is filled in the next tabs.
      </p>
    </div>
  );
}

function PlayerAvatar({ src, name }) {
  const [err, setErr] = useState(false);
  if (src && !err) return <img className="avatar" src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setErr(true)} />;
  return <span className="avatar avatar-ph">{(name || "?").trim()[0]}</span>;
}

function LineupSection({ d, team, setTeam, update }) {
  const t = d[team];
  const toggleCaptain = (i) =>
    update((n) => n[team].players.forEach((p, j) => (p.captain = j === i ? !p.captain : false)));
  const toggleOC = (i) => update((n) => (n[team].players[i].onCourt = !n[team].players[i].onCourt));
  const toggleCard = (list, i, kind) =>
    update((n) => (n[team][list][i].cards[kind] = !n[team][list][i].cards[kind]));

  return (
    <>
      <div className="team-tabs">
        <button className={`team-tab ${team === "teamA" ? "active" : ""}`} onClick={() => setTeam("teamA")}>
          {short(d.teamA.name)}
        </button>
        <button className={`team-tab ${team === "teamB" ? "active" : ""}`} onClick={() => setTeam("teamB")}>
          {short(d.teamB.name)}
        </button>
      </div>

      <div className="card">
        <h2>Players — tap C (captain), OC (on court), or a card</h2>
        {t.players.map((p, i) => (
          <div className="player" key={i}>
            <div className="player-id">
              <PlayerAvatar src={p.photo} name={p.name} />
              <div className="pnr">{p.nr}</div>
              <div className="pname">
                <div className="sur">{p.name}</div>
                <div className="giv">{p.first}</div>
              </div>
            </div>
            <div className="player-controls">
              <button className={`chip cap ${p.captain ? "on" : ""}`} onClick={() => toggleCaptain(i)}>C</button>
              <button className={`chip oc ${p.onCourt ? "on" : ""}`} onClick={() => toggleOC(i)}>OC</button>
              <div className="card-chips">
                {["y", "yr", "r"].map((k) => (
                  <button key={k} className={`chip ${k} ${p.cards[k] ? "on" : ""}`} onClick={() => toggleCard("players", i, k)}>
                    {k.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}

        {t.staff.length > 0 && <div className="subhead">Staff</div>}
        {t.staff.map((s, i) => (
          <div className="player" key={i}>
            <div className="player-id">
              <PlayerAvatar src={s.photo} name={s.name} />
              <div className="prole">{s.role}</div>
              <div className="pname">
                <div className="sur">{s.name}</div>
                <div className="giv">{s.first}</div>
              </div>
            </div>
            <div className="player-controls">
              <div className="card-chips">
                {["y", "yr", "r"].map((k) => (
                  <button key={k} className={`chip ${k} ${s.cards[k] ? "on" : ""}`} onClick={() => toggleCard("staff", i, k)}>
                    {k.toUpperCase()}
                  </button>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function ScoreSection({ d, scoring, update }) {
  const [cur, setCur] = useState(() => {
    const i = d.sets.findIndex((s) => !(s.rallies && s.rallies.length));
    return i === -1 ? d.sets.length - 1 : i;
  });
  const scroller = useRef(null);
  const [selCol, setSelCol] = useState(null);   // rally being corrected
  const set = d.sets[cur] || { rallies: [] };
  const rallies = set.rallies || [];
  const { a, b } = setScore(set);

  useEffect(() => {
    const el = scroller.current;
    if (el && selCol == null) el.scrollLeft = el.scrollWidth;
  }, [rallies.length, cur, selCol]);
  useEffect(() => setSelCol(null), [cur]);

  const addPoint = (w) => update((n) => {
    if (!n.sets[cur].rallies) n.sets[cur].rallies = [];
    n.sets[cur].rallies.push(w);
  });
  const undo = () => update((n) => { if (n.sets[cur].rallies) n.sets[cur].rallies.pop(); });
  const setRally = (i, w) => { update((n) => { n.sets[cur].rallies[i] = w; }); setSelCol(null); };
  const removeRally = (i) => { update((n) => { n.sets[cur].rallies.splice(i, 1); }); setSelCol(null); };
  const setBall = (which, val) => update((n) => (n.ballChoice[which] = val));

  // Build the two paper rows: the scorer's running number, "/" on the other side.
  const rowA = [], rowB = [];
  let ca = 0, cb = 0;
  for (const w of rallies) {
    if (w === "A") { ca++; rowA.push(String(ca)); rowB.push("/"); }
    else { cb++; rowB.push(String(cb)); rowA.push("/"); }
  }

  return (
    <div className="card">
      <div className="set-pills">
        {d.sets.map((s, i) => {
          const sc = setScore(s);
          const played = sc.a + sc.b > 0;
          return (
            <button key={i} className={`set-pill ${i === cur ? "active" : ""}`} onClick={() => setCur(i)}>
              <span className="sp-label">Set {i + 1}</span>
              <span className="sp-score">{played ? `${sc.a}:${sc.b}` : "–"}</span>
            </button>
          );
        })}
      </div>

      <div className="score-big">
        <span className={a > b ? "lead" : ""}>{a}</span>
        <span className="colon">:</span>
        <span className={b > a ? "lead" : ""}>{b}</span>
      </div>

      <div className="rally" ref={scroller}>
        <div className="rally-row">
          <div className="rally-team">{short(d.teamA.name)}</div>
          <div className="rally-cells">
            {rowA.length === 0 && <span className="cell x">·</span>}
            {rowA.map((c, i) => (
              <button key={i} className={`cell ${c === "/" ? "x" : ""} ${selCol === i ? "sel" : ""}`} onClick={() => setSelCol(selCol === i ? null : i)}>{c}</button>
            ))}
          </div>
        </div>
        <div className="rally-row">
          <div className="rally-team">{short(d.teamB.name)}</div>
          <div className="rally-cells">
            {rowB.length === 0 && <span className="cell x">·</span>}
            {rowB.map((c, i) => (
              <button key={i} className={`cell ${c === "/" ? "x" : ""} ${selCol === i ? "sel" : ""}`} onClick={() => setSelCol(selCol === i ? null : i)}>{c}</button>
            ))}
          </div>
        </div>
      </div>
      {rallies.length > 0 && selCol == null && (
        <p className="hint">Tapped the wrong side? Tap that point in the record to fix it.</p>
      )}

      {selCol != null && (
        <div className="correct-bar">
          <span className="cb-label">Rally {selCol + 1} — who scored?</span>
          <div className="cb-actions">
            <button className="btn" onClick={() => setRally(selCol, "A")}>{short(d.teamA.name)}</button>
            <button className="btn" onClick={() => setRally(selCol, "B")}>{short(d.teamB.name)}</button>
            <button className="btn danger" onClick={() => removeRally(selCol)}>✕ Remove</button>
            <button className="btn ghost" onClick={() => setSelCol(null)}>Cancel</button>
          </div>
        </div>
      )}

      <div className="point-buttons">
        <button className="pt a" onClick={() => addPoint("A")}>
          <span className="pt-team">{short(d.teamA.name)}</span>
          <span className="pt-plus">+ point</span>
        </button>
        <button className="pt b" onClick={() => addPoint("B")}>
          <span className="pt-team">{short(d.teamB.name)}</span>
          <span className="pt-plus">+ point</span>
        </button>
      </div>
      <button className="btn undo" onClick={undo} disabled={!rallies.length}>↶ Undo last point</button>

      <div className="tally">
        <div className={`t ${scoring.setsA > scoring.setsB ? "lead" : ""}`}><div className="n">{scoring.setsA}</div><div>sets</div></div>
        <div className={`t ${scoring.setsB > scoring.setsA ? "lead" : ""}`}><div className="n">{scoring.setsB}</div><div>sets</div></div>
      </div>
      {scoring.winner && (
        <p style={{ textAlign: "center", fontWeight: 800, color: "var(--win)" }}>
          Winner: {short(scoring.winner === "A" ? d.teamA.name : d.teamB.name)}
        </p>
      )}

      <div className="subhead">Choice of ball / serve</div>
      {["set1", "set5"].map((w) => (
        <div className="field" key={w}>
          <label>{w === "set1" ? "1st set" : "5th set"}</label>
          <div className="seg">
            <button className={d.ballChoice[w] === "A" ? "on" : ""} onClick={() => setBall(w, "A")}>{short(d.teamA.name)}</button>
            <button className={d.ballChoice[w] === "B" ? "on" : ""} onClick={() => setBall(w, "B")}>{short(d.teamB.name)}</button>
          </div>
        </div>
      ))}
    </div>
  );
}

function RefsSection({ d, update }) {
  const fields = [
    ["r1", "Referee 1"], ["r2", "Referee 2"], ["clerk", "Recording Clerk"],
    ["a1", "Assistant 1"], ["a2", "Assistant 2"],
  ];
  return (
    <div className="card">
      <h2>Referee team</h2>
      {fields.map(([k, label]) => (
        <div className="field" key={k}>
          <label>{label}</label>
          <input
            value={d.referees[k]}
            onChange={(e) => update((n) => (n.referees[k] = e.target.value))}
            placeholder="Name"
          />
        </div>
      ))}
    </div>
  );
}

function FinishSection({ d, scoring, update, onPdf }) {
  const sign = (k) => update((n) => (n.signatures[k] = !n.signatures[k]));
  return (
    <>
      <div className="card">
        <h2>Summary</h2>
        <p style={{ fontSize: 18, fontWeight: 700 }}>
          {short(d.teamA.name)} {scoring.setsA} × {scoring.setsB} {short(d.teamB.name)}
        </p>
        <p style={{ color: "var(--muted)" }}>
          {d.sets.map((s) => { const { a, b } = setScore(s); return a + b ? `${a}:${b}` : null; }).filter(Boolean).join("  ·  ") || "No sets recorded yet"}
        </p>
      </div>

      <div className="card">
        <h2>Remarks / extraordinary events</h2>
        <div className="field">
          <textarea rows={3} value={d.remarks} onChange={(e) => update((n) => (n.remarks = e.target.value))} placeholder="Protests, incidents, notes…" />
        </div>
        <div className="field">
          <label>Responsible person</label>
          <input value={d.responsible} onChange={(e) => update((n) => (n.responsible = e.target.value))} placeholder="Name" />
        </div>
      </div>

      <div className="card">
        <h2>Signatures (confirm)</h2>
        {[
          ["capA", `Captain — ${short(d.teamA.name)}`],
          ["capB", `Captain — ${short(d.teamB.name)}`],
          ["referee", "Referee"],
        ].map(([k, label]) => (
          <div className="toggle-row" key={k}>
            <span>{label}</span>
            <button className={`switch ${d.signatures[k] ? "on" : ""}`} onClick={() => sign(k)}>
              {d.signatures[k] ? "Signed" : "Sign"}
            </button>
          </div>
        ))}
      </div>

      <div className="card">
        <h2>Game report PDF</h2>
        <p style={{ color: "var(--muted)", marginTop: 0 }}>
          Generates the full game report (súmula) in the tournament layout — to save, print or e-mail.
        </p>
        <button className="btn primary" style={{ width: "100%" }} onClick={onPdf}>⬇ Download PDF</button>
      </div>
    </>
  );
}

/* ---------------- helpers ---------------- */

function short(name) {
  return (name || "").split(" - ")[0];
}

// The report doc <-> editable súmula draft.
function extractDraft(data) {
  return {
    info: data.info,
    teamA: data.teamA,
    teamB: data.teamB,
    sets: data.sets,
    ballChoice: data.ballChoice || { set1: "", set5: "" },
    referees: data.referees || { r1: "", r2: "", clerk: "", a1: "", a2: "" },
    remarks: data.remarks || "",
    responsible: data.responsible || "",
    signatures: data.signatures || { capA: false, capB: false, referee: false },
    submittedAt: data.submittedAt || null,
  };
}
function pickSumula(d) {
  return {
    info: d.info, teamA: d.teamA, teamB: d.teamB, sets: d.sets,
    ballChoice: d.ballChoice, referees: d.referees,
    remarks: d.remarks, responsible: d.responsible, signatures: d.signatures,
  };
}

function nextSection(cur) {
  const i = SECTIONS.findIndex(([k]) => k === cur);
  return SECTIONS[Math.min(i + 1, SECTIONS.length - 1)][0];
}

function setScore(s) {
  const r = (s && s.rallies) || [];
  let a = 0, b = 0;
  for (const x of r) { if (x === "A") a++; else if (x === "B") b++; }
  return { a, b };
}

function computeScore(d) {
  if (!d) return { setsA: 0, setsB: 0, winner: null };
  let setsA = 0, setsB = 0;
  for (const s of d.sets) {
    const { a, b } = setScore(s);
    if (a + b === 0) continue;
    if (a > b) setsA++; else if (b > a) setsB++;
  }
  const need = Math.floor((d.info.bestOf) / 2) + 1;
  const winner = setsA >= need ? "A" : setsB >= need ? "B" : null;
  return { setsA, setsB, winner };
}
