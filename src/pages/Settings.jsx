import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  setEventStatus, subscribeLivePointer, setLiveEvent, clearLiveEvent,
  subscribeLogos, addLogo, deleteLogo, saveBranding, updateEventDetails, updateEventFields, publishEventImport, publishGames,
} from "../cloud.js";
import { fetchEventFromSheet } from "../schedule/importEventSheet.js";
import { TYPES, COMMON_AGES, expandBuilder, buildColumns, sexWord } from "../categories.js";
import { describeFormat, formatMatches, formatWarnings, slotOptions, parseSlot, slotValue, normalizeOverride, ROUND_OPTIONS } from "../schedule/format.js";
import SlotsEditor from "../schedule/SlotsEditor.jsx";
import { generateSchedule } from "../schedule/generator.js";
import { eventToConfig } from "../schedule/eventToConfig.js";
import ExcelImport from "../roster/ExcelImport.jsx";
import { fileToLogoDataUrl } from "../img.js";
import { formatRange } from "../dates.js";
import { useEvent } from "../eventContext.js";

const fromEvent = (ev) => ({
  name: ev?.name || "", place: ev?.place || "", startDate: ev?.startDate || "", endDate: ev?.endDate || "",
  categoryBuilder: ev?.categoryBuilder || { types: [], sexes: [], ages: [] },
  entries: ev?.entries || [], // [{ name, cats: [categoryName…] }]
  formatOverrides: ev?.formatOverrides || {}, // { [category]: { [matchId]: { a?, b? } } }
  slots: ev?.slots || { courts: [], days: [], gameMinutes: 45, breakMinutes: 0 },
});

export default function Settings({ me }) {
  const nav = useNavigate();
  const { eventId, event, archived, isAdmin, branding } = useEvent();
  const [live, setLive] = useState(undefined);
  const [status, setStatus] = useState("");
  const [details, setDetails] = useState(() => fromEvent(event));
  const [dirty, setDirty] = useState(false); // has unsaved local edits
  // Guided setup accordion: the open step (0 = all closed). Starts on the first
  // step that isn't done yet.
  const [openStep, setOpenStep] = useState(() => {
    const d = fromEvent(event);
    const nt = (d.entries || []).length > 0;
    const courts = (d.slots?.courts || []).length > 0 && (d.slots?.days || []).length > 0;
    const flags = [!!(d.name && d.startDate), expandBuilder(d.categoryBuilder).length > 0, nt, nt, courts, false, false, false];
    const i = flags.findIndex((f) => !f);
    return i === -1 ? 0 : i + 1;
  });
  const openOrToggle = (n) => setOpenStep((s) => (s === n ? 0 : n));
  const [bracketIdx, setBracketIdx] = useState(null); // category index shown in the bracket modal
  const teamsInCat = (cat) => (details.entries || []).filter((t) => (t.cats || []).includes(cat)).map((t) => t.name);
  // Per-category format override: edit slots, remove or add knockout matches.
  const mutateOv = (cat, fn) => edit((d) => {
    const fo = { ...(d.formatOverrides || {}) };
    const cur = normalizeOverride(fo[cat]);
    const ov = { edits: { ...cur.edits }, removed: [...cur.removed], added: cur.added.map((m) => ({ ...m })) };
    fn(ov);
    fo[cat] = ov;
    return { ...d, formatOverrides: fo };
  });
  const setSlot = (cat, matchId, slot, value, isAdded) => mutateOv(cat, (ov) => {
    const src = parseSlot(value);
    if (isAdded) { const m = ov.added.find((x) => x.id === matchId); if (m) m[slot] = src; }
    else ov.edits[matchId] = { ...(ov.edits[matchId] || {}), [slot]: src };
  });
  const setRound = (cat, matchId, round) => mutateOv(cat, (ov) => { const m = ov.added.find((x) => x.id === matchId); if (m) m.round = round; });
  const addMatch = (cat) => mutateOv(cat, (ov) => ov.added.push({ id: `x${Date.now()}`, round: "Placement 5-6", a: { type: "seed", rank: 5 }, b: { type: "seed", rank: 6 } }));
  const removeMatch = (cat, matchId, isAdded) => mutateOv(cat, (ov) => {
    if (isAdded) ov.added = ov.added.filter((m) => m.id !== matchId);
    else if (!ov.removed.includes(matchId)) ov.removed.push(matchId);
  });
  const resetFormat = (cat) => edit((d) => { const fo = { ...(d.formatOverrides || {}) }; delete fo[cat]; return { ...d, formatOverrides: fo }; });
  const saveOverrides = () => { setStatus("Saving format…"); updateEventFields({ formatOverrides: details.formatOverrides }).then(() => afterSave("Format saved.")).catch((e) => setStatus("Save failed: " + (e?.message || e))); };
  const [remote, setRemote] = useState(false); // someone else changed it while editing

  // Live sync: pull the event doc into the form whenever it changes remotely,
  // unless the user has unsaved edits (then just flag that it changed).
  const lastEvent = useRef(event);
  useEffect(() => {
    if (event === lastEvent.current) return;
    lastEvent.current = event;
    if (dirty) setRemote(true);
    else setDetails(fromEvent(event));
  }, [event, dirty]);
  const reloadFromEvent = () => { setDetails(fromEvent(event)); setDirty(false); setRemote(false); };

  const [ageInput, setAgeInput] = useState("");
  const [teamInput, setTeamInput] = useState("");
  const edit = (updater) => { setDirty(true); setDetails(updater); };
  const cb = details.categoryBuilder;
  const setBuilder = (patch) => edit((d) => ({ ...d, categoryBuilder: { ...d.categoryBuilder, ...patch } }));
  const toggleIn = (key, val) => setBuilder({ [key]: (cb[key] || []).includes(val) ? cb[key].filter((x) => x !== val) : [...(cb[key] || []), val] });
  const addAge = (a) => { const v = a.trim(); if (v && !(cb.ages || []).includes(v)) setBuilder({ ages: [...(cb.ages || []), v] }); setAgeInput(""); };
  const previewCats = expandBuilder(cb);
  const afterSave = (msg) => { setDirty(false); setRemote(false); lastEvent.current = event; setStatus(msg); };
  const saveCategories = () => {
    setStatus("Saving…");
    updateEventFields({ categoryBuilder: details.categoryBuilder })
      .then(() => { afterSave(`Saved — ${previewCats.length} categor${previewCats.length === 1 ? "y" : "ies"} defined.`); setOpenStep(3); })
      .catch((e) => setStatus("Save failed: " + (e?.message || e)));
  };

  // Team-entry matrix (rows = clubs/nations, columns = categories).
  const addTeam = (name) => {
    const v = name.trim();
    if (v && !(details.entries || []).some((t) => t.name.toLowerCase() === v.toLowerCase())) {
      edit((d) => ({ ...d, entries: [...(d.entries || []), { name: v, cats: [] }] }));
    }
    setTeamInput("");
  };
  const removeTeam = (i) => edit((d) => ({ ...d, entries: (d.entries || []).filter((_, j) => j !== i) }));
  const renameTeam = (i, name) => edit((d) => { const e = [...(d.entries || [])]; e[i] = { ...e[i], name }; return { ...d, entries: e }; });
  const toggleEntry = (i, cat) => edit((d) => {
    const e = [...(d.entries || [])]; const cur = e[i].cats || [];
    e[i] = { ...e[i], cats: cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat] };
    return { ...d, entries: e };
  });
  const saveTeams = () => {
    setStatus("Saving teams…");
    updateEventFields({ entries: details.entries })
      .then(() => { afterSave(`Saved ${(details.entries || []).length} team(s).`); setOpenStep(4); })
      .catch((e) => setStatus("Save failed: " + (e?.message || e)));
  };

  const [evUrl, setEvUrl] = useState("");
  const [evPreview, setEvPreview] = useState(null);
  const readEvent = async () => {
    setStatus("Reading sheet…");
    try {
      const id = evUrl.match(/[-\w]{25,}/)?.[0] || evUrl.trim();
      const r = await fetchEventFromSheet(id);
      setEvPreview(r);
      setStatus(`Found ${r.gameCount} games (${r.finished} finished) + ${r.teamCount} teams + ${r.cautionCount} carded players.` + (r.warnings.length ? " " + r.warnings.join("; ") : ""));
    } catch (e) { setStatus("Read failed: " + (e?.message || e)); }
  };
  const publishEvent = async () => {
    if (!evPreview?.gameCount) return;
    if (!window.confirm(`Replace this event's games, reports and results with ${evPreview.gameCount} imported games (and ${evPreview.teamCount} rosters)? This cannot be undone.`)) return;
    setStatus("Importing…");
    try {
      await publishEventImport(evPreview, { replaceAll: true });
      setStatus(`Imported ${evPreview.gameCount} games + ${evPreview.teamCount} rosters. Open the games list / Fistball Live to see them.`);
      setEvPreview(null);
    } catch (e) { setStatus("Import failed: " + (e?.message || e)); }
  };

  const saveDetails = async () => {
    setStatus("Saving event…");
    try { await updateEventDetails({ name: details.name, place: details.place, startDate: details.startDate, endDate: details.endDate, dates: formatRange(details.startDate, details.endDate) }); afterSave("Event details saved."); setOpenStep(2); }
    catch (e) { setStatus("Save failed: " + (e?.message || e)); }
  };

  // logo library + this event's selection
  const [logos, setLogos] = useState([]);
  const [eventLogo, setEventLogo] = useState(null);
  const [promoters, setPromoters] = useState([]);
  const fileRef = useRef(null);
  const initedRef = useRef(false);

  useEffect(() => subscribeLivePointer(setLive), []);
  useEffect(() => subscribeLogos(setLogos), []);
  // Load the saved selection once branding arrives.
  useEffect(() => {
    if (branding && !initedRef.current) {
      setEventLogo(branding.eventLogo || null);
      setPromoters(branding.promoters || []);
      initedRef.current = true;
    }
  }, [branding]);

  if (!isAdmin) return <div className="empty">Admins only.</div>;

  const thisIsLive = live?.eventId === eventId;
  const publishLive = async () => { try { await setLiveEvent(event); } catch (e) { setStatus("Failed: " + (e?.message || e)); } };
  const stopLive = async () => {
    if (!window.confirm("Stop showing this event on Fistball Live?")) return;
    try { await clearLiveEvent(); } catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };
  const toggleArchive = async () => {
    const next = archived ? "active" : "archived";
    if (!window.confirm(archived ? "Re-activate this event?" : "Archive this event? It becomes read-only for everyone.")) return;
    try { await setEventStatus(next); } catch (e) { setStatus("Failed: " + (e?.message || e)); }
  };

  const onUpload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("Uploading logo…");
    try {
      const dataUrl = await fileToLogoDataUrl(file);
      await addLogo({ name: file.name.replace(/\.[^.]+$/, ""), dataUrl }, me);
      setStatus("Logo added to the library.");
    } catch (e2) { setStatus("Upload failed: " + (e2?.message || e2)); }
  };
  const asLogo = (l) => ({ name: l.name, dataUrl: l.dataUrl });
  const addPromoter = (l) => setPromoters((p) => (p.some((x) => x.dataUrl === l.dataUrl) ? p : [...p, asLogo(l)]));
  const removePromoter = (i) => setPromoters((p) => p.filter((_, j) => j !== i));

  const saveLogos = async () => {
    setStatus("Saving branding…");
    try { await saveBranding({ name: event?.name, eventLogo, promoters }); setStatus("Branding saved."); setOpenStep(7); }
    catch (e) { setStatus("Save failed: " + (e?.message || e)); }
  };
  const setSlots = (next) => edit((d) => ({ ...d, slots: next }));
  const saveSlots = () => { setStatus("Saving courts…"); updateEventFields({ slots: details.slots }).then(() => { afterSave("Courts & schedule saved."); setOpenStep(6); }).catch((e) => setStatus("Save failed: " + (e?.message || e))); };

  // Step 8 — generate & publish the schedule from the saved setup.
  const [genResult, setGenResult] = useState(null);
  const [published, setPublished] = useState(false);
  const doGenerate = () => {
    // Use the current (possibly unsaved) setup so the preview is WYSIWYG.
    const r = generateSchedule(eventToConfig({
      categoryBuilder: details.categoryBuilder, entries: details.entries,
      formatOverrides: details.formatOverrides, slots: details.slots,
    }));
    setGenResult(r);
    setStatus(`${r.games.length} games generated${r.unplaced.length ? `, ${r.unplaced.length} unplaced` : ""}.`);
  };
  const doPublish = async () => {
    if (!genResult?.games.length) return;
    if (!window.confirm(`Publish ${genResult.games.length} games? This replaces ALL current games, reports and results for this event.`)) return;
    setStatus("Publishing…");
    try { await publishGames(genResult.games, { replaceAll: true }); setPublished(true); setStatus(`Published ${genResult.games.length} games. See the games list / Fistball Live.`); }
    catch (e) { setStatus("Publish failed: " + (e?.message || e)); }
  };

  // Guided-setup step state: which are done, and which are still locked.
  const nTeams = (details.entries || []).length;
  const courtsDone = (details.slots?.courts || []).length > 0 && (details.slots?.days || []).length > 0;
  const done = [
    !!(details.name && details.startDate),
    previewCats.length > 0,
    nTeams > 0,
    nTeams > 0,
    courtsDone,
    !!(branding?.eventLogo || (branding?.promoters || []).length),
    thisIsLive,
    published,
  ];
  const locked = [false, !done[0], !done[1], !done[2], !done[3], !done[3], !done[3], !done[4]];

  return (
    <div className="app">
      <header className="topbar">
        <button className="iconbtn" onClick={() => nav(`/e/${eventId}`)}>‹ Games</button>
        <div className="brand-logo sm"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <div className="spacer" />
        <div style={{ textAlign: "right" }}>
          <div className="title">Event settings{archived && <span className="arch-badge">Archived</span>}</div>
          <div className="sub">{event?.name}</div>
        </div>
      </header>

      <div className="content">
        {remote && (
          <div className="sync-banner">
            <span>Another admin just changed this event.</span>
            <button className="btn sm" onClick={reloadFromEvent}>Load latest</button>
          </div>
        )}
        {/* ---- 1. Event details ---- */}
        <Step n={1} title="Event details" sub={done[0] ? details.name : ""} done={done[0]} locked={locked[0]} open={openStep === 1} onToggle={() => openOrToggle(1)}>
          <div className="field"><span>Name</span>
            <input value={details.name} disabled={archived} onChange={(e) => edit((d) => ({ ...d, name: e.target.value }))} /></div>
          <div className="field"><span>Place</span>
            <input value={details.place} disabled={archived} onChange={(e) => edit((d) => ({ ...d, place: e.target.value }))} placeholder="City · Country" /></div>
          <div className="grid2">
            <div className="field"><span>Starts</span>
              <input type="date" disabled={archived} value={details.startDate} onChange={(e) => edit((d) => ({ ...d, startDate: e.target.value, endDate: d.endDate && d.endDate < e.target.value ? e.target.value : d.endDate }))} /></div>
            <div className="field"><span>Ends</span>
              <input type="date" disabled={archived} min={details.startDate || undefined} value={details.endDate} onChange={(e) => edit((d) => ({ ...d, endDate: e.target.value }))} /></div>
          </div>
          {(details.startDate || details.endDate) && <p className="muted-sm">{formatRange(details.startDate, details.endDate)}</p>}
          {!archived && <button className="btn primary" onClick={saveDetails}>Save details</button>}
        </Step>

        {/* ---- 2. Categories (chip builder) ---- */}
        <Step n={2} title="Categories" sub={done[1] ? `${previewCats.length} categories` : ""} done={done[1]} locked={locked[1]} open={openStep === 2} onToggle={() => openOrToggle(2)}>
          <p className="muted-sm">Mark the chips and the app creates every category (type × age × sex).</p>

          <div className="chip-row">
            <span className="chip-row-label">Type</span>
            {TYPES.map((t) => (
              <button key={t.id} disabled={archived} className={`selchip ${(cb.types || []).includes(t.id) ? "on" : ""}`} onClick={() => toggleIn("types", t.id)}>{t.label}</button>
            ))}
          </div>

          <div className="chip-row">
            <span className="chip-row-label">Gender</span>
            <button disabled={archived} className={`selchip ${(cb.sexes || []).includes("men") ? "on men" : ""}`} onClick={() => toggleIn("sexes", "men")}>♂ Men</button>
            <button disabled={archived} className={`selchip ${(cb.sexes || []).includes("women") ? "on women" : ""}`} onClick={() => toggleIn("sexes", "women")}>♀ Women</button>
          </div>

          <div className="chip-row">
            <span className="chip-row-label">Ages <span className="muted-sm" style={{ fontWeight: 400 }}>(optional)</span></span>
            {[...COMMON_AGES, ...(cb.ages || []).filter((a) => !COMMON_AGES.includes(a))].map((a) => (
              <button key={a} disabled={archived} className={`selchip ${(cb.ages || []).includes(a) ? "on" : ""}`} onClick={() => toggleIn("ages", a)}>{a}</button>
            ))}
            {!archived && (
              <input className="age-input" value={ageInput} onChange={(e) => setAgeInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addAge(ageInput)} placeholder="+ custom" />
            )}
          </div>

          <div className="cat-preview-box">
            {previewCats.length ? (
              <>
                <div className="subhead">Creates {previewCats.length} categor{previewCats.length === 1 ? "y" : "ies"}</div>
                <div className="chips">{previewCats.map((n) => <span className="team-chip" key={n}>{n}</span>)}</div>
              </>
            ) : <p className="muted-sm" style={{ margin: 0 }}>Pick a type and a sex to see the categories.</p>}
          </div>

          {!archived && <button className="btn primary" style={{ marginTop: 12 }} onClick={saveCategories} disabled={!previewCats.length}>Save categories</button>}
        </Step>

        {/* ---- 3. Team-entry matrix (teams × categories) ---- */}
        <Step n={3} title="Teams & categories" sub={done[2] ? `${nTeams} teams` : ""} done={done[2]} locked={locked[2]} open={openStep === 3} onToggle={() => openOrToggle(3)}>
          <div>
            <p className="muted-sm">Add each club / national team and tick the categories it plays. This is what the schedule uses.</p>
            {!archived && (
              <div className="add-row">
                <input value={teamInput} onChange={(e) => setTeamInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && addTeam(teamInput)} placeholder="Add club / national team" />
                <button className="btn sm" onClick={() => addTeam(teamInput)}>Add</button>
              </div>
            )}
            {!(details.entries || []).length ? (
              <p className="muted-sm" style={{ marginTop: 10 }}>No teams yet.</p>
            ) : (
              (() => {
                const cols = buildColumns(cb);
                const headRows = cols.hasAges ? 3 : 2;
                return (
                  <div className="matrix-wrap">
                    <table className="matrix">
                      <thead>
                        <tr>
                          <th className="mx-team" rowSpan={headRows}>Team</th>
                          {cols.types.map((t, ti) => (
                            <th key={ti} className="mx-type" colSpan={cols.sexes.length * cols.agesList.length}>{t}</th>
                          ))}
                          <th rowSpan={headRows} aria-label="Remove" />
                        </tr>
                        <tr>
                          {cols.types.map((t, ti) => cols.sexes.map((s) => (
                            <th key={ti + s} className={`mx-sex mx-sex-${s}`} colSpan={cols.agesList.length}>{s === "women" ? "♀ Women" : "♂ Men"}</th>
                          )))}
                        </tr>
                        {cols.hasAges && (
                          <tr>
                            {cols.types.map((t, ti) => cols.sexes.map((s) => cols.agesList.map((a) => (
                              <th key={ti + s + a} className="mx-age">{a}</th>
                            ))))}
                          </tr>
                        )}
                      </thead>
                      <tbody>
                        {(details.entries || []).map((t, i) => (
                          <tr key={i}>
                            <td className="mx-team"><input className="mx-team-input" value={t.name} disabled={archived} onChange={(e) => renameTeam(i, e.target.value)} aria-label="Team name" /></td>
                            {cols.leaves.map((lf) => (
                              <td key={lf.name} className="mx-cell">
                                <input type="checkbox" checked={(t.cats || []).includes(lf.name)} disabled={archived} onChange={() => toggleEntry(i, lf.name)} title={lf.name} />
                              </td>
                            ))}
                            <td>{!archived && <button className="btn danger sm" onClick={() => removeTeam(i)} aria-label="Remove">✕</button>}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td className="mx-team dim">Teams</td>
                          {cols.leaves.map((lf) => <td key={lf.name} className="mx-cell dim">{(details.entries || []).filter((t) => (t.cats || []).includes(lf.name)).length}</td>)}
                          <td />
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                );
              })()
            )}
            {!archived && (details.entries || []).length > 0 && <button className="btn primary" style={{ marginTop: 12 }} onClick={saveTeams}>Save teams</button>}
          </div>
        </Step>

        {/* ---- 4. Format per category (auto by team count) ---- */}
        <Step n={4} title="Format" sub={done[3] ? `${previewCats.length} categories` : ""} done={done[3]} locked={locked[3]} open={openStep === 4} onToggle={() => openOrToggle(4)}>
          <div>
            <p className="muted-sm">Auto-selected for each category by the number of teams (from the matrix). This is what the schedule will use.</p>
            {previewCats.length > 0 && (
              <button className="btn" style={{ marginBottom: 10 }} onClick={() => setBracketIdx(0)}>👁 Review each bracket →</button>
            )}
            {previewCats.map((cat, ci) => {
              const count = (details.entries || []).filter((t) => (t.cats || []).includes(cat)).length;
              const d = describeFormat(count, details.formatOverrides?.[cat]);
              return (
                <div className="fmt-cat" key={cat}>
                  <div className="fmt-head"><b>{cat}</b><span className="tag">{count} team{count === 1 ? "" : "s"}</span>
                    {count > 0 && d && formatWarnings(count, details.formatOverrides?.[cat]).length > 0 && <span className="tag" style={{ background: "#fff4e5", color: "#8a5a00" }}>⚠️ check</span>}
                    {count > 0 && d && <button className="btn sm" style={{ marginLeft: "auto" }} onClick={() => setBracketIdx(ci)}>View bracket</button>}
                  </div>
                  {!count ? (
                    <p className="muted-sm" style={{ margin: "2px 0 0" }}>No teams ticked yet.</p>
                  ) : d ? (
                    <>
                      <div className="fmt-line"><span className="fmt-round">Qualification Round</span> one group · round-robin · {d.qrGames} games</div>
                      {d.rounds.map((r, i) => (
                        <div className="fmt-line" key={i}><span className="fmt-round">{r.round}</span> {r.matches.join(" · ")}</div>
                      ))}
                      <div className="muted-sm" style={{ marginTop: 4 }}>Total <b>{d.total}</b> games · best of 3</div>
                    </>
                  ) : (
                    <p className="muted-sm" style={{ margin: "2px 0 0" }}>No preset for {count} teams yet — a manual format will be needed.</p>
                  )}
                </div>
              );
            })}
          </div>
          {!archived && <button className="btn primary" style={{ marginTop: 12 }} onClick={() => setOpenStep(5)}>Looks good — continue</button>}
        </Step>

        {/* ---- 5. Courts & schedule ---- */}
        <Step n={5} title="Courts & schedule" sub={done[4] ? `${(details.slots?.courts || []).length} courts · ${(details.slots?.days || []).length} days` : ""} done={done[4]} locked={locked[4]} open={openStep === 5} onToggle={() => openOrToggle(5)}>
          <p className="muted-sm">Define the courts and each day’s window. The schedule generator uses this to place the games.</p>
          <SlotsEditor value={details.slots} onChange={setSlots} disabled={archived} />
          {!archived && <button className="btn primary" style={{ marginTop: 12 }} onClick={saveSlots} disabled={!courtsDone}>Save courts &amp; continue</button>}
        </Step>

        {/* ---- 6. Event logos ---- */}
        <Step n={6} title="Event logos" sub={done[5] ? "set" : "optional"} done={done[5]} locked={locked[5]} open={openStep === 6} onToggle={() => openOrToggle(6)}>
          <div className="row-between">
            <span className="muted-sm">Shown on the game report (PDF), the app topbar and Fistball Live.</span>
            <button className="btn sm" onClick={() => fileRef.current?.click()} disabled={archived}>+ Upload logo</button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" hidden onChange={onUpload} />

          <div className="subhead">This event</div>
          <div className="brand-picks">
            <div className="brand-pick">
              <div className="brand-pick-label">Event logo</div>
              {eventLogo
                ? <div className="logo-chip"><img src={eventLogo.dataUrl} alt="" /><button onClick={() => setEventLogo(null)} disabled={archived}>✕</button></div>
                : <div className="logo-empty">none</div>}
            </div>
            <div className="brand-pick">
              <div className="brand-pick-label">Promoters</div>
              <div className="chips">
                {promoters.map((p, i) => (
                  <div className="logo-chip" key={i}><img src={p.dataUrl} alt="" /><button onClick={() => removePromoter(i)} disabled={archived}>✕</button></div>
                ))}
                {!promoters.length && <div className="logo-empty">none</div>}
              </div>
            </div>
          </div>
          {!archived && <button className="btn primary" style={{ marginTop: 12 }} onClick={saveLogos}>Save logos &amp; continue</button>}

          <div className="subhead">Library ({logos.length})</div>
          {logos.length === 0 && <p className="muted-sm">No logos yet — upload one above.</p>}
          <div className="logo-grid">
            {logos.map((l) => (
              <div className="logo-lib" key={l.id}>
                <img src={l.dataUrl} alt={l.name} title={l.name} />
                <div className="logo-name">{l.name}</div>
                {!archived && (
                  <div className="logo-actions">
                    <button className="btn sm" onClick={() => setEventLogo(asLogo(l))}>Event logo</button>
                    <button className="btn sm" onClick={() => addPromoter(l)}>Add promoter</button>
                    <button className="btn danger sm" onClick={() => window.confirm(`Delete “${l.name}” from the library?`) && deleteLogo(l.id)}>Delete</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </Step>

        {/* ---- 7. Publish to Fistball Live ---- */}
        <Step n={7} title="Publish to Fistball Live" sub={done[6] ? "On air" : ""} done={done[6]} locked={locked[6]} open={openStep === 7} onToggle={() => openOrToggle(7)}>
          <p className="muted-sm">
            {live === undefined ? "Checking…"
              : thisIsLive ? "✅ This event is showing on the public scoreboard."
              : live?.eventId ? `Another event is live: “${live.name || live.eventId}”.`
              : "No event is on the public scoreboard yet."}
          </p>
          {thisIsLive
            ? <button className="btn danger" onClick={stopLive}>Stop showing</button>
            : <button className="btn primary" onClick={publishLive}>{live?.eventId ? "Show this instead" : "Publish to Live"}</button>}
        </Step>

        {/* ---- 8. Generate & publish schedule ---- */}
        <Step n={8} title="Generate & publish schedule" sub={done[7] ? "published" : ""} done={done[7]} locked={locked[7]} open={openStep === 8} onToggle={() => openOrToggle(8)}>
          <p className="muted-sm">Builds all games from your categories, teams, format and courts — then publishes them (they appear on the games list and Fistball Live).</p>
          {!archived && <button className="btn" onClick={doGenerate}>{genResult ? "Regenerate" : "Generate schedule"}</button>}
          {genResult && (
            <>
              {genResult.warnings?.length > 0 && <div className="warn-box" style={{ marginTop: 10 }}>{genResult.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}</div>}
              <p className="muted-sm" style={{ marginTop: 8 }}>Ready: <b>{genResult.games.length}</b> games{genResult.unplaced.length ? ` · ${genResult.unplaced.length} unplaced` : ""}.</p>
              {Object.entries(genResult.games.reduce((a, g) => { a[g.category] = (a[g.category] || 0) + 1; return a; }, {})).map(([c, cnt]) => (
                <div className="fmt-line" key={c}><span className="fmt-round">{c}</span> {cnt} games</div>
              ))}
              {!archived && <button className="btn primary" style={{ marginTop: 12, width: "100%" }} onClick={doPublish} disabled={!genResult.games.length}>Publish {genResult.games.length} games (replace all)</button>}
              {done[7] && <p className="muted-sm">✅ Published. Open the games list or Fistball Live to see them.</p>}
            </>
          )}
        </Step>

        <div className="tools-divider">Tools (optional)</div>

        {/* ---- Import a past event from a Google Sheet ---- */}
        {!archived && (
          <div className="card">
            <h2>Import a past event (Google Sheet)</h2>
            <p className="muted-sm">Brings the schedule + final scores (Results tab) and rosters (DB tab) into this event, so Fistball Live shows the full standings. Súmula line-up/card detail is separate.</p>
            <div className="add-row" style={{ marginTop: 8 }}>
              <input value={evUrl} onChange={(e) => setEvUrl(e.target.value)} placeholder="Google Sheet URL or ID" />
              <button className="btn primary" onClick={readEvent}>Read</button>
            </div>
            {evPreview?.gameCount > 0 && (
              <div style={{ marginTop: 12 }}>
                <p className="muted-sm">Ready: <b>{evPreview.gameCount}</b> games ({evPreview.finished} finished) · <b>{evPreview.teamCount}</b> rosters · <b>{evPreview.cautionCount}</b> carded players.</p>
                <button className="btn primary" style={{ width: "100%" }} onClick={publishEvent}>Import into this event (replace)</button>
              </div>
            )}
          </div>
        )}

        {/* ---- Import players & staff from Excel ---- */}
        {!archived && <ExcelImport me={me} />}

        {/* ---- Status ---- */}
        <div className="card">
          <div className="row-between">
            <div><h2 style={{ margin: 0 }}>Event status</h2>
              <p className="muted-sm">{archived ? "Archived — read-only for everyone." : "Active — members can score."}</p></div>
            <button className={`btn ${archived ? "primary" : "danger"}`} onClick={toggleArchive}>{archived ? "Re-activate" : "Archive"}</button>
          </div>
        </div>

        {status && <p className="muted-sm">{status}</p>}
      </div>

      {bracketIdx !== null && previewCats[bracketIdx] && (
        <BracketModal
          category={previewCats[bracketIdx]}
          teams={teamsInCat(previewCats[bracketIdx])}
          override={details.formatOverrides?.[previewCats[bracketIdx]]}
          onSlot={(matchId, slot, value, isAdded) => setSlot(previewCats[bracketIdx], matchId, slot, value, isAdded)}
          onRound={(matchId, round) => setRound(previewCats[bracketIdx], matchId, round)}
          onAdd={() => addMatch(previewCats[bracketIdx])}
          onRemove={(matchId, isAdded) => removeMatch(previewCats[bracketIdx], matchId, isAdded)}
          onReset={() => resetFormat(previewCats[bracketIdx])}
          onSave={saveOverrides}
          archived={archived}
          idx={bracketIdx}
          total={previewCats.length}
          onClose={() => setBracketIdx(null)}
          onNext={() => { saveOverrides(); setBracketIdx((i) => (i + 1 < previewCats.length ? i + 1 : null)); }}
        />
      )}
    </div>
  );
}

// Editable bracket of one category (group + every knockout match) in a modal.
// Each slot is a dropdown (seed / winner-of / loser-of); changes are saved as a
// per-category override. Stepped through one category at a time.
function BracketModal({ category, teams, override, onSlot, onRound, onAdd, onRemove, onReset, onSave, archived, idx, total, onClose, onNext }) {
  const n = teams.length;
  const matches = formatMatches(n, override);
  const warnings = formatWarnings(n, override);
  const last = idx + 1 >= total;
  const Slot = ({ m, side }) => {
    const slot = side === "a" ? m.a : m.b;
    if (archived) return <span className="brk-slot-ro">{slot.label}</span>;
    return (
      <select className="brk-slot" value={slotValue(slot.src)} onChange={(e) => onSlot(m.id, side, e.target.value, m.added)}>
        {slotOptions(n, m.id, override).map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  };
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal bracket-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
        <button className="modal-x" onClick={onClose} aria-label="Close">✕</button>
        <h3 className="modal-title" style={{ marginBottom: 2 }}>{category}</h3>
        <p className="muted-sm" style={{ marginTop: 0 }}>{n} teams · category {idx + 1} of {total}</p>
        {!matches.length ? (
          <p className="muted-sm">No preset for {n} teams yet.</p>
        ) : (
          <>
            <div className="brk-group">
              <div className="brk-col-title">Qualification Round · one group</div>
              <div className="chips">{teams.map((t) => <span className="team-chip" key={t}>{t}</span>)}</div>
            </div>
            <div className="brk-edit-list">
              {matches.map((m) => (
                <div className="brk-edit-row" key={m.id}>
                  {m.added && !archived
                    ? <select className="brk-erd-sel" value={m.round} onChange={(e) => onRound(m.id, e.target.value)}>
                        {ROUND_OPTIONS.map((r) => <option key={r} value={r}>{r}</option>)}
                      </select>
                    : <span className="brk-erd">{m.round}</span>}
                  <Slot m={m} side="a" /><span className="brk-x">×</span><Slot m={m} side="b" />
                  {!archived && <button className="brk-del" title="Remove match" onClick={() => onRemove(m.id, m.added)}>✕</button>}
                </div>
              ))}
            </div>
            {!archived && (
              <div className="brk-editnote">
                <button className="btn sm" onClick={onAdd}>+ Add match</button>
                {override && normalizeOverride(override) && (normalizeOverride(override).removed.length || normalizeOverride(override).added.length || Object.keys(normalizeOverride(override).edits).length)
                  ? <button className="btn sm" onClick={onReset}>Reset to preset</button> : null}
              </div>
            )}
            {warnings.length > 0 && (
              <div className="warn-box">{warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}</div>
            )}
            <p className="muted-sm">Remove a match with ✕, or add one. Placeholders (“Winner SF1”…) fill in automatically as games finish.</p>
          </>
        )}
        <div className="modal-actions">
          <button className="btn" onClick={onClose}>Close</button>
          <button className="btn primary" onClick={onNext}>{last ? "Save — done" : "Save — next category"}</button>
        </div>
      </div>
    </div>
  );
}

// One numbered, collapsible step of the guided event setup. The number stays on
// completed steps (turns green); the current step is open, later steps locked.
function Step({ n, title, sub, done, locked, open, onToggle, children }) {
  return (
    <div className="sec-card">
      <button className="sec-head" onClick={onToggle} disabled={locked}>
        <span className={`sec-num ${done ? "done" : ""} ${locked ? "locked" : ""}`}>{n}</span>
        <span className={`sec-title ${locked ? "locked" : ""}`}>{title}</span>
        {sub ? <span className="sec-sub">{sub}</span> : null}
        <span className="sec-chev">{open ? "▾" : "▸"}</span>
      </button>
      {open && !locked && <div className="sec-body">{children}</div>}
    </div>
  );
}
