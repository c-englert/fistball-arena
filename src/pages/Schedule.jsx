import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { TEAM_NAMES } from "../seed.js";
import { generateSchedule } from "../schedule/generator.js";
import { hasFormat } from "../schedule/format.js";
import { eventCategoryNames } from "../categories.js";
import { fetchSheetGames } from "../schedule/importSheet.js";
import { saveScheduleConfig, subscribeScheduleConfig, publishGames } from "../cloud.js";
import { useEvent } from "../eventContext.js";

const EVENT_SHEET_ID = "1IWuv2zOZtIJDZCFnItp_z8p546azRGlD8I052jVe8Mk";

const STEPS = [
  ["cats", "Groups"],
  ["format", "Format"],
  ["slots", "Slots"],
  ["preview", "Preview & Publish"],
];

const LABELS = "ABCDEFGH";

function defaultConfig() {
  return {
    categories: [
      { name: "U18 Men", bestOf: 5, double: false, qualifiersPerGroup: 2, knockout: true,
        groups: [{ label: "A", teams: [] }, { label: "B", teams: [] }] },
    ],
    slots: { courts: ["1", "2"], days: ["23/07/26"], startTime: "09:00", slotMinutes: 45, slotsPerDay: 8 },
    startNr: 1,
  };
}

// A generator category seeded from a concrete category name + its teams (from the
// event's Teams × categories matrix), plus any per-category format override.
function seedCategory(name, teams, override) {
  return { name, bestOf: 5, double: false, qualifiersPerGroup: 2, knockout: true, override: override || null, groups: [{ label: "A", teams: teams || [] }] };
}
// Pre-fill the generator with the categories the admin defined on the event
// (Settings → Categories chip-builder) and the teams ticked for each (matrix).
function initialConfig(event) {
  const base = defaultConfig();
  const names = eventCategoryNames(event);
  if (names.length) {
    const entries = event?.entries || [];
    const overrides = event?.formatOverrides || {};
    base.categories = names.map((name) => seedCategory(name, entries.filter((t) => (t.cats || []).includes(name)).map((t) => t.name), overrides[name]));
  }
  return base;
}

// date helpers between internal "DD/MM/YY" and the <input type=date> "YYYY-MM-DD".
const toISO = (s) => {
  const [d, m, y] = String(s).split("/");
  return d ? `20${y}-${m}-${d}` : "";
};
const fromISO = (iso) => {
  const [y, m, d] = String(iso).split("-");
  return d ? `${d}/${m}/${y.slice(2)}` : "";
};

export default function Schedule({ me }) {
  const nav = useNavigate();
  const { eventId, isAdmin, event } = useEvent();
  const [config, setConfig] = useState(() => initialConfig(event));
  const [step, setStep] = useState(() => {
    const cats = initialConfig(event).categories || [];
    const preset = cats.length > 0 && cats.every((c) => hasFormat((c.groups || []).flatMap((g) => g.teams || []).length));
    return preset ? "slots" : "cats";
  });
  const [result, setResult] = useState(null); // { games, warnings, unplaced }
  const [replaceAll, setReplaceAll] = useState(true);
  const [status, setStatus] = useState("");
  const [sheetId, setSheetId] = useState(EVENT_SHEET_ID);
  const [confirm, setConfirm] = useState(null); // { title, message, danger, okLabel, onOk }
  const loadedRef = useState({ done: false })[0];

  useEffect(() => {
    const unsub = subscribeScheduleConfig((cfg) => {
      if (cfg && !loadedRef.done) { setConfig(cfg); loadedRef.done = true; }
    });
    return unsub;
  }, [loadedRef]);

  // When every category has a preset format, teams + format come from the event —
  // skip the Groups/Format steps so it's just Slots → Generate.
  const presetOnly = (config.categories || []).length > 0 &&
    config.categories.every((c) => hasFormat((c.groups || []).flatMap((g) => g.teams || []).length));
  const steps = presetOnly ? STEPS.filter(([k]) => k === "slots" || k === "preview") : STEPS;
  useEffect(() => { if (!steps.some(([k]) => k === step)) setStep(steps[0][0]); }, [presetOnly]); // eslint-disable-line

  if (!isAdmin) {
    return <div className="empty">Admins only. <button className="btn" onClick={() => nav(`/e/${eventId}`)}>Back</button></div>;
  }

  const patch = (fn) => setConfig((c) => { const n = structuredClone(c); fn(n); return n; });

  const saveSetup = async () => {
    setStatus("Saving…");
    try { await saveScheduleConfig(config); setStatus("Setup saved"); }
    catch (e) { setStatus("Save failed: " + (e?.message || e)); }
  };

  const generate = () => {
    const r = generateSchedule(config);
    setResult(r);
    setStatus(`${r.games.length} match(es) generated${r.unplaced.length ? `, ${r.unplaced.length} unplaced` : ""}.`);
  };

  const doImport = async () => {
    setStatus("Reading spreadsheet…");
    try {
      const id = sheetId.match(/[-\w]{25,}/)?.[0] || sheetId.trim(); // accept a full URL or a bare id
      const r = await fetchSheetGames(id, "0");
      setResult(r);
      setStep("preview");
      setStatus(`Imported ${r.games.length} match(es) from the sheet.`);
    } catch (e) {
      setStatus("Import failed: " + (e?.message || e));
    }
  };

  const runPublish = async () => {
    setConfirm(null);
    setStatus("Publishing…");
    try {
      try { await saveScheduleConfig(config); } catch (_) { /* meta rules optional */ }
      await publishGames(result.games, { replaceAll });
      setStatus(`Published ${result.games.length} games. Open the games list to see them.`);
    } catch (e) {
      setStatus("Publish failed: " + (e?.message || e));
    }
  };

  const doPublish = () => {
    if (!result?.games.length) return;
    setConfirm({
      title: replaceAll ? "Replace the whole schedule?" : "Publish games?",
      message: replaceAll
        ? `This replaces ALL current games, reports and results with the ${result.games.length} matches below. Existing súmulas and scores will be deleted. This cannot be undone.`
        : `Add ${result.games.length} games to the database.`,
      danger: replaceAll,
      okLabel: replaceAll ? "Replace all" : "Publish",
      onOk: runPublish,
    });
  };

  return (
    <div className="app">
      <header className="topbar">
        <button className="iconbtn" onClick={() => nav(`/e/${eventId}`)}>‹ Games</button>
        <div className="brand-logo sm"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <div className="spacer" />
        <div style={{ textAlign: "right" }}>
          <div className="title">Schedule generator</div>
          <div className="sub">Groups · round-robin · knockout · auto slots</div>
        </div>
      </header>

      <nav className="steps">
        {steps.map(([k, label]) => (
          <button key={k} className={`step ${step === k ? "active" : ""}`} onClick={() => setStep(k)}>{label}</button>
        ))}
      </nav>

      <div className="content">
        {step === "cats" && <CatsStep config={config} patch={patch} />}
        {step === "format" && <FormatStep config={config} patch={patch} />}
        {step === "slots" && <SlotsStep config={config} patch={patch} />}
        {step === "preview" && (
          <PreviewStep config={config} result={result} generate={generate}
            replaceAll={replaceAll} setReplaceAll={setReplaceAll} doPublish={doPublish}
            sheetId={sheetId} setSheetId={setSheetId} doImport={doImport} />
        )}
      </div>

      <div className="bottombar">
        <span className="status">{status}</span>
        <div style={{ display: "flex", gap: 8 }}>
          <button className="btn" onClick={saveSetup}>Save setup</button>
          {step !== "preview"
            ? <button className="btn primary" onClick={() => setStep((steps[steps.findIndex((s) => s[0] === step) + 1] || steps[steps.length - 1])[0])}>Next ›</button>
            : <button className="btn primary" onClick={generate}>Generate</button>}
        </div>
      </div>

      {confirm && <ConfirmModal confirm={confirm} onClose={() => setConfirm(null)} />}
    </div>
  );
}

/* ---------------- confirm modal ---------------- */
function ConfirmModal({ confirm, onClose }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        {confirm.danger && <div className="modal-icon">⚠️</div>}
        <h3 className="modal-title">{confirm.title}</h3>
        <p className="modal-msg">{confirm.message}</p>
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className={`btn ${confirm.danger ? "danger-solid" : "primary"}`} onClick={confirm.onOk} autoFocus>
            {confirm.okLabel || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------------- Step 1: categories & groups ---------------- */
function CatsStep({ config, patch }) {
  return (
    <>
      {config.categories.map((cat, ci) => (
        <div className="card" key={ci}>
          <div className="row-between">
            <input className="h-input" value={cat.name}
              onChange={(e) => patch((n) => (n.categories[ci].name = e.target.value))} placeholder="Category name" />
            <button className="btn danger sm" onClick={() => patch((n) => n.categories.splice(ci, 1))}>Remove</button>
          </div>
          {cat.groups.map((g, gi) => (
            <div className="group-box" key={gi}>
              <div className="row-between">
                <div className="group-title">Group {g.label}</div>
                <button className="btn sm" onClick={() => patch((n) => n.categories[ci].groups.splice(gi, 1))}>✕</button>
              </div>
              <TeamEditor teams={g.teams}
                onAdd={(name) => patch((n) => { if (name && !n.categories[ci].groups[gi].teams.includes(name)) n.categories[ci].groups[gi].teams.push(name); })}
                onRemove={(ti) => patch((n) => n.categories[ci].groups[gi].teams.splice(ti, 1))} />
            </div>
          ))}
          <button className="btn sm" onClick={() => patch((n) => {
            const used = n.categories[ci].groups.map((x) => x.label);
            const label = [...LABELS].find((L) => !used.includes(L)) || String(used.length + 1);
            n.categories[ci].groups.push({ label, teams: [] });
          })}>+ Add group</button>
        </div>
      ))}
      <button className="btn primary" onClick={() => patch((n) => n.categories.push(
        { name: "New category", bestOf: 5, double: false, qualifiersPerGroup: 2, knockout: true, groups: [{ label: "A", teams: [] }] }
      ))}>+ Add category</button>
    </>
  );
}

function TeamEditor({ teams, onAdd, onRemove }) {
  const [val, setVal] = useState("");
  const add = () => { onAdd(val.trim()); setVal(""); };
  return (
    <>
      <div className="chips">
        {teams.map((t, ti) => (
          <span className="team-chip" key={ti}>{t}<button onClick={() => onRemove(ti)}>✕</button></span>
        ))}
        {!teams.length && <span className="muted-sm">No teams yet</span>}
      </div>
      <div className="add-row">
        <input list="known-teams" value={val} onChange={(e) => setVal(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()} placeholder="Add team name" />
        <button className="btn sm" onClick={add}>Add</button>
        <datalist id="known-teams">{TEAM_NAMES.map((t) => <option key={t} value={t} />)}</datalist>
      </div>
    </>
  );
}

/* ---------------- Step 2: format ---------------- */
function FormatStep({ config, patch }) {
  return config.categories.map((cat, ci) => (
    <div className="card" key={ci}>
      <h2>{cat.name || "Category"}</h2>
      <div className="grid2">
        <label className="field"><span>Best of</span>
          <select value={cat.bestOf} onChange={(e) => patch((n) => (n.categories[ci].bestOf = Number(e.target.value)))}>
            <option value={1}>1</option><option value={3}>3</option><option value={5}>5</option>
          </select>
        </label>
        <label className="field"><span>Qualifiers per group</span>
          <select value={cat.qualifiersPerGroup} onChange={(e) => patch((n) => (n.categories[ci].qualifiersPerGroup = Number(e.target.value)))}>
            <option value={1}>1</option><option value={2}>2</option>
          </select>
        </label>
      </div>
      <label className="check"><input type="checkbox" checked={cat.double}
        onChange={(e) => patch((n) => (n.categories[ci].double = e.target.checked))} /> Double round-robin (home &amp; away)</label>
      <label className="check"><input type="checkbox" checked={cat.knockout}
        onChange={(e) => patch((n) => (n.categories[ci].knockout = e.target.checked))} /> Generate knockout bracket</label>
    </div>
  ));
}

/* ---------------- Step 3: slots ---------------- */
function SlotsStep({ config, patch }) {
  const s = config.slots;
  const [court, setCourt] = useState("");
  return (
    <div className="card">
      <h2>Courts</h2>
      <div className="chips">
        {s.courts.map((c, i) => (
          <span className="team-chip" key={i}>Court {c}<button onClick={() => patch((n) => n.slots.courts.splice(i, 1))}>✕</button></span>
        ))}
      </div>
      <div className="add-row">
        <input value={court} onChange={(e) => setCourt(e.target.value)} placeholder="Court name/number"
          onKeyDown={(e) => e.key === "Enter" && court.trim() && (patch((n) => n.slots.courts.push(court.trim())), setCourt(""))} />
        <button className="btn sm" onClick={() => court.trim() && (patch((n) => n.slots.courts.push(court.trim())), setCourt(""))}>Add</button>
      </div>

      <h2 style={{ marginTop: 18 }}>Days</h2>
      <div className="chips">
        {s.days.map((d, i) => (
          <span className="team-chip" key={i}>{d}<button onClick={() => patch((n) => n.slots.days.splice(i, 1))}>✕</button></span>
        ))}
      </div>
      <div className="add-row">
        <input type="date" onChange={(e) => { const v = fromISO(e.target.value); if (v) patch((n) => { if (!n.slots.days.includes(v)) n.slots.days.push(v); }); }} />
      </div>

      <h2 style={{ marginTop: 18 }}>Timing</h2>
      <div className="grid2">
        <label className="field"><span>Start time</span>
          <input type="time" value={s.startTime} onChange={(e) => patch((n) => (n.slots.startTime = e.target.value))} /></label>
        <label className="field"><span>Slot length (min)</span>
          <input type="number" min="15" step="5" value={s.slotMinutes} onChange={(e) => patch((n) => (n.slots.slotMinutes = Number(e.target.value)))} /></label>
        <label className="field"><span>Slots per day</span>
          <input type="number" min="1" value={s.slotsPerDay} onChange={(e) => patch((n) => (n.slots.slotsPerDay = Number(e.target.value)))} /></label>
        <label className="field"><span>First match #</span>
          <input type="number" min="1" value={config.startNr} onChange={(e) => patch((n) => (n.startNr = Number(e.target.value)))} /></label>
      </div>
      <p className="muted-sm">Capacity: {s.courts.length} courts × {s.slotsPerDay} slots × {s.days.length} days = {s.courts.length * s.slotsPerDay * s.days.length} matches.</p>
    </div>
  );
}

/* ---------------- Step 4: preview & publish ---------------- */
function PreviewStep({ config, result, generate, replaceAll, setReplaceAll, doPublish, sheetId, setSheetId, doImport }) {
  const byDay = useMemo(() => {
    if (!result) return [];
    const map = new Map();
    for (const g of result.games) { if (!map.has(g.date)) map.set(g.date, []); map.get(g.date).push(g); }
    return [...map.entries()];
  }, [result]);

  // The assembled structure per category: group teams + each knockout round.
  const byCat = useMemo(() => {
    if (!result) return [];
    const cats = new Map();
    for (const g of result.games) {
      if (!cats.has(g.category)) cats.set(g.category, { group: new Set(), rounds: new Map() });
      const c = cats.get(g.category);
      if (g.round === "Qualification round") { c.group.add(g.teamA.name); c.group.add(g.teamB.name); }
      else { if (!c.rounds.has(g.round)) c.rounds.set(g.round, []); c.rounds.get(g.round).push(g); }
    }
    return [...cats.entries()];
  }, [result]);

  return (
    <>
      <div className="card">
        <h2>Import existing schedule from a Google Sheet</h2>
        <p className="muted-sm">Loads the real matchups, days, times and courts as-is (recommended for an event already planned in a sheet).</p>
        <div className="add-row" style={{ marginTop: 8 }}>
          <input value={sheetId} onChange={(e) => setSheetId(e.target.value)} placeholder="Sheet URL or ID" />
          <button className="btn primary" onClick={doImport}>Import</button>
        </div>
      </div>

      <div className="card">
        <div className="row-between">
          <h2 style={{ margin: 0 }}>Preview</h2>
          <button className="btn" onClick={generate}>{result ? "Regenerate" : "Generate"}</button>
        </div>
        {!result && <p className="muted-sm">Import above, or press Generate to build from your group setup.</p>}
        {result?.warnings?.length > 0 && (
          <div className="warn-box">
            {result.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}
          </div>
        )}
      </div>

      {byCat.length > 0 && (
        <div className="card">
          <h2>Structure</h2>
          <p className="muted-sm">The assembled bracket per category — check it before publishing.</p>
          {byCat.map(([cat, c]) => (
            <div className="fmt-cat" key={cat}>
              <div className="fmt-head"><b>{cat}</b><span className="tag">{c.group.size} teams</span></div>
              <div className="fmt-line"><span className="fmt-round">Qualification round</span> {[...c.group].join(" · ")}</div>
              {[...c.rounds.entries()].map(([round, gs]) => (
                <div className="fmt-line" key={round}>
                  <span className="fmt-round">{round}</span> {gs.map((g) => `${g.teamA.name} × ${g.teamB.name}`).join(" · ")}
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {byDay.map(([day, games]) => (
        <div className="card" key={day}>
          <h2>{day}</h2>
          <table className="sched-table">
            <thead><tr><th>#</th><th>Time</th><th>Court</th><th>Round</th><th>Match</th></tr></thead>
            <tbody>
              {games.map((g) => (
                <tr key={g.nr} className={g.round === "Qualification round" ? "" : "ko-row"}>
                  <td>{g.nr}</td><td>{g.time}</td><td>{g.court}</td><td>{g.round}</td>
                  <td>{g.teamA.name} <span className="vs">vs</span> {g.teamB.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {result?.games?.length > 0 && (
        <div className="card">
          <label className="check"><input type="checkbox" checked={replaceAll}
            onChange={(e) => setReplaceAll(e.target.checked)} /> Replace all existing games, reports &amp; results</label>
          <button className="btn primary" style={{ width: "100%", marginTop: 8 }} onClick={doPublish}>
            Publish {result.games.length} games to database
          </button>
        </div>
      )}
    </>
  );
}
