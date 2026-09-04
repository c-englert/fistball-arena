import { useRef, useState, useEffect } from "react";
import { parseExcelRoster } from "./importExcel.js";
import { publishRosters, publishReferees, appendImportLog, subscribeImportLog, subscribeRosters, clearRosters } from "../cloud.js";

// Normalize a team name for fuzzy matching (case/accents/punctuation-insensitive).
const strip = (s) =>
  String(s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^a-z0-9]/g, "");
// Lower + de-accent but keep spaces (so \bword\b boundaries survive).
const low = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "");

// Best registered team (from step 3) for an imported club, or null if none is confident.
function bestMatch(club, registered) {
  const c = strip(club);
  if (!c) return null;
  let best = null, bestScore = 0;
  for (const name of registered) {
    const n = strip(name);
    let score = 0;
    if (n === c) score = 3;
    else if (n.startsWith(c) || c.startsWith(n)) score = 2;
    else if (n.includes(c) || c.includes(n)) score = 1;
    if (score > bestScore) { bestScore = score; best = name; }
  }
  return bestScore >= 2 ? best : null; // only auto-accept strong matches
}

// Guess which event category a file belongs to, from its filename.
function guessCategory(filename, categories) {
  const flags = (s) => ({
    men: /masculino|\bmen\b|\bmale\b|masc|varonil/.test(s),
    women: /feminino|femenino|\bwomen\b|female|\bfem\b|damas/.test(s),
    clubs: /club/.test(s),
    nat: /national|nacional|seleccion|selecao|\bnt\b/.test(s),
  });
  const ff = flags(low(filename));
  let best = "", bestScore = 0;
  for (const c of categories) {
    const cf = flags(low(c));
    let s = 0;
    if (ff.men && cf.men) s++; if (ff.women && cf.women) s++;
    if (ff.men && cf.women) s--; if (ff.women && cf.men) s--;
    if (ff.clubs && cf.clubs) s++; if (ff.nat && cf.nat) s++;
    if (ff.clubs && cf.nat) s--; if (ff.nat && cf.clubs) s--;
    if (s > bestScore) { bestScore = s; best = c; }
  }
  return bestScore > 0 ? best : "";
}

// Searchable combobox: filters options by ANY substring, but accepts a free-typed value too.
function TeamCombo({ value, options, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const boxRef = useRef(null);
  const q = strip(value);
  const filtered = q ? options.filter((o) => strip(o).includes(q)) : options;

  useEffect(() => {
    const h = (e) => { if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const pick = (v) => { onChange(v); setOpen(false); setHi(-1); };

  return (
    <div className="combo" ref={boxRef}>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => { onChange(e.target.value); setOpen(true); setHi(-1); }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setOpen(true); setHi((h) => Math.min(h + 1, filtered.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && open && hi >= 0 && filtered[hi]) { e.preventDefault(); pick(filtered[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && filtered.length > 0 && (
        <ul className="combo-list">
          {filtered.map((o, i) => (
            <li key={o} className={`combo-opt ${i === hi ? "hi" : ""} ${strip(o) === q ? "sel" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }} onMouseEnter={() => setHi(i)}>{o}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// Import players & staff from one Excel file PER CATEGORY. Load several files;
// assign each to a category (from step 3). Rosters are stored as "<team> - <category>".
export default function ExcelImport({ me, teamNames = [], categories = [] }) {
  const registered = [...teamNames].filter(Boolean).sort((a, b) => a.localeCompare(b));
  const [files, setFiles] = useState([]); // [{ id, filename, category, teams, referees, count, teamCount, refereeCount, warnings, names }]
  const [status, setStatus] = useState("");
  const [history, setHistory] = useState([]);
  const [registrySize, setRegistrySize] = useState(0);
  const fileRef = useRef(null);
  const seqRef = useRef(0);

  useEffect(() => subscribeImportLog(setHistory), []);
  useEffect(() => subscribeRosters((r) => setRegistrySize(Object.keys(r || {}).length)), []);

  const clearRegistry = async () => {
    if (!registrySize) return;
    if (!window.confirm(`Delete ALL ${registrySize} rosters currently saved in this event? This only clears the players & staff registry — games and results are untouched. Cannot be undone.`)) return;
    setStatus("Clearing registry…");
    try { await clearRosters(); setStatus("Registry cleared."); }
    catch (e) { setStatus("Clear failed: " + (e?.message || e)); }
  };

  const onExcel = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus(`Reading ${file.name}…`);
    try {
      const r = await parseExcelRoster(file);
      const names = {};
      Object.entries(r.teams).forEach(([k, t]) => {
        const hit = registered.length ? bestMatch(t.name, registered) : null;
        names[k] = hit || t.name;
      });
      const id = `f${seqRef.current++}`;
      setFiles((prev) => [...prev, {
        id, filename: file.name, category: guessCategory(file.name, categories),
        teams: r.teams, referees: r.referees, count: r.count, teamCount: r.teamCount,
        refereeCount: r.refereeCount, warnings: r.warnings, names,
      }]);
      setStatus("");
    } catch (e2) { setStatus("Excel read failed: " + (e2?.message || e2)); }
  };

  const patchFile = (id, patch) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const removeFile = (id) => setFiles((prev) => prev.filter((f) => f.id !== id));
  const setTeamName = (id, orig, v) => setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, names: { ...f.names, [orig]: v } } : f)));

  // Final roster key per team: "<team> - <category>" (or plain "<team>" if no categories).
  const finalKey = (f, orig) => {
    const name = (f.names[orig] ?? orig).trim();
    return categories.length && f.category ? `${name} - ${f.category}` : name;
  };
  const allKeys = files.flatMap((f) => Object.keys(f.teams).map((orig) => finalKey(f, orig)));
  const dupKeys = new Set(allKeys.filter((k, i) => k && allKeys.indexOf(k) !== i));
  // Category is only meaningful for team rosters; a referees-only file needs none.
  const needCategory = categories.length > 0 && files.some((f) => !f.category && Object.keys(f.teams).length > 0);
  const totalPeople = files.reduce((s, f) => s + f.count, 0);
  const totalRefs = files.reduce((s, f) => s + (f.refereeCount || 0), 0);
  const nothingToSave = totalPeople === 0 && totalRefs === 0;
  const saveLabel = [
    totalPeople ? `${totalPeople} people` : "",
    totalRefs ? `${totalRefs} referee${totalRefs === 1 ? "" : "s"}` : "",
  ].filter(Boolean).join(" & ") || "nothing";

  const saveAll = async () => {
    if (!files.length || dupKeys.size || needCategory) return;
    setStatus("Saving…");
    try {
      const rosters = {};
      const refs = [];
      for (const f of files) {
        for (const [orig, t] of Object.entries(f.teams)) {
          const name = (f.names[orig] ?? orig).trim();
          if (!name) continue;
          rosters[finalKey(f, orig)] = { ...t, name, category: f.category || "" };
        }
        refs.push(...(f.referees || []));
      }
      await publishRosters(rosters);
      if (refs.length) {
        const seen = new Set();
        const uniq = refs.filter((r) => { const k = `${r.name}|${r.first}`.toLowerCase(); if (seen.has(k)) return false; seen.add(k); return true; });
        await publishReferees(uniq, { replaceAll: true });
      }
      for (const f of files) {
        try {
          await appendImportLog({
            by: me?.name || me?.email || "—", file: f.filename, category: f.category || "",
            people: f.count, teams: f.teamCount, referees: f.refereeCount,
            teamNames: Object.keys(f.teams).map((o) => (f.names[o] ?? o).trim()).sort(),
          });
        } catch (_) { /* history is best-effort */ }
      }
      setStatus(`Saved ${totalPeople} people across ${files.length} file${files.length === 1 ? "" : "s"}.`);
      setFiles([]);
    } catch (e) { setStatus("Save failed: " + (e?.message || e)); }
  };

  return (
    <div className="card">
      <div className="row-between">
        <h2 style={{ margin: 0 }}>Import players &amp; staff from Excel</h2>
        <button className="btn primary" onClick={() => fileRef.current?.click()}>+ Add file…</button>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={onExcel} />
      <p className="muted-sm">One file per category — load each file and assign it to its category.</p>
      {categories.length === 0 && <div className="warn-box">⚠️ No categories defined yet — set them in step 2 to assign each file.</div>}

      {files.map((f) => {
        const rows = Object.entries(f.teams);
        return (
          <div className="import-file" key={f.id}>
            <div className="row-between" style={{ alignItems: "center", gap: 8, marginBottom: 6 }}>
              <span className="import-file-name" title={f.filename}>📄 {f.filename}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {categories.length > 0 && Object.keys(f.teams).length > 0 && (
                  <select className={`cat-select ${f.category ? "" : "cat-missing"}`} value={f.category} onChange={(e) => patchFile(f.id, { category: e.target.value })}>
                    <option value="">— pick category —</option>
                    {categories.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                )}
                {Object.keys(f.teams).length === 0 && f.refereeCount > 0 && (
                  <span className="tag" title="Referees are event-wide — no category needed">referees only</span>
                )}
                <button className="btn danger sm" onClick={() => removeFile(f.id)} title="Remove this file">✕</button>
              </div>
            </div>
            {f.warnings?.length > 0 && <div className="warn-box">{f.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}</div>}
            {rows.map(([orig, t]) => {
              const raw = f.names[orig] ?? orig;
              const cur = raw.trim();
              const isReg = registered.includes(cur);
              const isDup = dupKeys.has(finalKey(f, orig));
              return (
                <div className={`roster-row ${!isReg && registered.length ? "row-warn" : ""} ${isDup ? "row-dup" : ""}`} key={orig}>
                  <span className="muted-sm" style={{ flex: "0 0 150px", overflow: "hidden", textOverflow: "ellipsis" }} title={orig}>{t.name}</span>
                  <span className="muted-sm">→</span>
                  {registered.length ? (
                    <TeamCombo value={raw} options={registered} placeholder="pick or type a team name"
                      onChange={(v) => setTeamName(f.id, orig, v)} />
                  ) : (
                    <input style={{ flex: 1 }} value={raw} placeholder="team name" onChange={(e) => setTeamName(f.id, orig, e.target.value)} />
                  )}
                  {registered.length > 0 && (
                    <span className={`tag ${isReg ? "tag-ok" : "tag-warn"}`} title={isReg ? "Matches a registered team" : "Not in your registered teams — will be created as new"}>
                      {isReg ? "✓" : "new"}
                    </span>
                  )}
                  <span className="tag" title={`${t.players.length} player${t.players.length === 1 ? "" : "s"} · ${t.staff.length} staff in the file`}>{t.players.length}P · {t.staff.length}S</span>
                </div>
              );
            })}
            {f.refereeCount > 0 && <p className="muted-sm" style={{ marginTop: 6 }}>+ <b>{f.refereeCount}</b> referees from this file.</p>}
          </div>
        );
      })}

      {dupKeys.size > 0 && (
        <div className="warn-box" style={{ marginTop: 8 }}>
          ⚠️ Two teams resolve to the same team+category ({[...dupKeys].join(", ")}) — one roster would overwrite the other.
        </div>
      )}
      {needCategory && <div className="warn-box" style={{ marginTop: 8 }}>⚠️ Pick a category for every file before saving.</div>}

      {files.length > 0 && (
        <button className="btn primary" style={{ width: "100%", marginTop: 10 }} onClick={saveAll} disabled={dupKeys.size > 0 || needCategory || nothingToSave}>
          Save {saveLabel} from {files.length} file{files.length === 1 ? "" : "s"}
        </button>
      )}
      {status && <p className="muted-sm" style={{ marginTop: 10 }}>{status}</p>}

      {registrySize > 0 && (
        <div className="row-between" style={{ marginTop: 12, alignItems: "center" }}>
          <span className="muted-sm">{registrySize} team roster{registrySize === 1 ? "" : "s"} saved in this event.</span>
          <button className="btn danger sm" onClick={clearRegistry}>🗑 Clear all rosters</button>
        </div>
      )}

      {history.length > 0 && (
        <details className="import-history" style={{ marginTop: 14 }}>
          <summary>Import history ({history.length})</summary>
          <ul className="import-log">
            {history.map((h, i) => (
              <li key={i}>
                <span className="il-when">{fmtWhen(h.at)}</span>
                <span className="il-what">
                  {h.people} people · {h.teams} teams{h.category ? ` · ${h.category}` : ""}{h.referees ? ` · ${h.referees} refs` : ""}
                </span>
                <span className="il-by muted-sm">{h.by}</span>
                {h.teamNames?.length > 0 && <div className="il-teams muted-sm" title={h.teamNames.join(", ")}>{h.teamNames.join(" · ")}</div>}
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

function fmtWhen(iso) {
  const d = new Date(iso);
  if (isNaN(d)) return iso || "—";
  return d.toLocaleString(undefined, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}
