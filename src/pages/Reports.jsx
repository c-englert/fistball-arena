import { useEffect, useMemo, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import { subscribeGames, subscribeResults, subscribeRosters, subscribeReferees, fetchReports, saveFinalReportFields, rosterKey, subscribeVenueMap, subscribeTeamLogos, subscribeAllMdp } from "../cloud.js";
import { useEvent } from "../eventContext.js";
import { flagFor } from "../flags.js";
import { isPlaceholder } from "../schedule/advance.js";
import { reportData, reportModel, mdpBlocks } from "../report/reportModel.js";
import { SumulasPDF } from "../pdf/SumulaPDF.jsx";
import { useT, useLang, LANGS, langName, localeOf, tCategory } from "../i18n.js";
import { overlayUrl } from "../broadcast.js";
import { scheduledStart } from "../report/finalReport.js";
import { dayKey } from "../report/weather.js";

// Reports: the event's final report (print / Word) and every game report
// (súmula) of one team in a single PDF.

const fileSafe = (s) => String(s || "").normalize("NFD").replace(/\p{Diacritic}/gu, "").replace(/[^\w]+/g, "-").replace(/^-|-$/g, "");
const short = (n) => String(n || "").split(" - ")[0];
const byNr = (a, b) => (Number(a.nr) || 0) - (Number(b.nr) || 0);

export default function Reports() {
  const { event, branding, eventId } = useEvent();
  const tr = useT();
  const [view, setView] = useState("final");
  const [games, setGames] = useState([]);
  const [results, setResults] = useState([]);
  const [rosters, setRosters] = useState({});
  const [refs, setRefs] = useState([]);
  const [reports, setReports] = useState(null);
  const [mdpDocs, setMdpDocs] = useState({});
  useEffect(() => subscribeAllMdp(setMdpDocs), []);
  // Scouted games (MDP) with their teams and category.
  const mdpGames = useMemo(() => Object.entries(mdpDocs).map(([id, mdp]) => {
    const g = games.find((x) => x.id === id) || results.find((x) => x.id === id);
    const nm = (t) => (t && typeof t === "object" ? t.name : t) || "";
    return g ? { id, teamA: nm(g.teamA), teamB: nm(g.teamB), category: g.category || "", mdp } : null;
  }).filter(Boolean), [mdpDocs, games, results]);

  useEffect(() => subscribeGames(setGames), []);
  useEffect(() => subscribeResults(setResults), []);
  useEffect(() => subscribeRosters(setRosters), []);
  useEffect(() => subscribeReferees(setRefs), []);
  const loadReports = () => fetchReports().then(setReports).catch((e) => { console.warn(e); setReports([]); });
  useEffect(() => { loadReports(); }, []);

  return (
    <>
      <h2 className="page-h no-print">{tr("Reports")}</h2>
      <div className="plan-bar no-print">
        <span className="filter-pill-group">
          <button className={`filter-pill ${view === "final" ? "active" : ""}`} onClick={() => setView("final")}>{tr("Event final report")}</button>
          <button className={`filter-pill ${view === "team" ? "active" : ""}`} onClick={() => setView("team")}>{tr("Game reports by team")}</button>
          <button className={`filter-pill ${view === "links" ? "active" : ""}`} onClick={() => setView("links")}>{tr("Broadcast links")}</button>
          <button className={`filter-pill ${view === "mdp" ? "active" : ""}`} onClick={() => setView("mdp")}>{tr("MDP")}</button>
        </span>
      </div>
      {view === "final"
        ? <FinalReport event={event} branding={branding} games={games} results={results} rosters={rosters} refs={refs} reports={reports} mdpGames={mdpGames} />
        : view === "mdp" ? <MdpSummary event={event} mdpGames={mdpGames} />
        : view === "links" ? <BroadcastList eventId={eventId} event={event} games={games} />
          : <TeamReports event={event} branding={branding} games={games} reports={reports} reload={loadReports} />}
    </>
  );
}

/* ---------------- event final report ---------------- */
// One block model feeds the screen / print view and the Word document.
function FinalReport({ event, branding, games, results, rosters, refs, reports, mdpGames }) {
  const tr = useT();
  const [lang] = useLang();
  const saved = event?.finalReport || {};
  const [fields, setFields] = useState({ host: "", technical: "", notes: "", ...saved });
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [venueMap, setVenueMap] = useState(null);
  const [teamLogos, setTeamLogos] = useState({});
  const [mapPages, setMapPages] = useState([]);
  useEffect(() => subscribeVenueMap(setVenueMap), []);
  // A venue map uploaded as PDF is shown (and put in Word) as images of its pages.
  useEffect(() => {
    setMapPages([]);
    if (venueMap?.kind !== "pdf" || !venueMap.data) return;
    let live = true;
    import("../report/pdfImages.js").then(({ pdfToImages }) => pdfToImages(venueMap.data))
      .then((imgs) => { if (live) setMapPages(imgs); })
      .catch((e) => console.warn("venue map PDF not rendered:", e));
    return () => { live = false; };
  }, [venueMap]);
  useEffect(() => subscribeTeamLogos(setTeamLogos), []);
  useEffect(() => { if (!dirty) setFields({ host: "", technical: "", notes: "", ...(event?.finalReport || {}) }); }, [event?.finalReport]);
  const set = (k) => (e) => { setFields((f) => ({ ...f, [k]: e.target.value })); setDirty(true); };
  const setStream = (k) => (e) => { setFields((f) => ({ ...f, stream: { ...(f.stream || {}), [k]: e.target.value } })); setDirty(true); };
  const setStreamDay = (key) => (e) => { setFields((f) => ({ ...f, stream: { ...(f.stream || {}), days: { ...(f.stream?.days || {}), [key]: e.target.value } } })); setDirty(true); };
  const setMedia = (k) => (e) => { setFields((f) => ({ ...f, media: { ...(f.media || {}), [k]: e.target.value } })); setDirty(true); };
  // Final remarks are written per report language; the report falls back to another language's text.
  const notesOf = (l) => (fields.notesByLang || {})[l] ?? (l === "en" ? fields.notes : undefined) ?? "";
  const setNotes = (text) => { setFields((f) => ({ ...f, notesByLang: { ...(f.notesByLang || {}), [lang]: text } })); setDirty(true); };
  const otherNotes = LANGS.map((l) => l.code).filter((l) => l !== lang && notesOf(l).trim()).map((l) => ({ lang: l, text: notesOf(l) }));
  const [translating, setTranslating] = useState(false);
  const canTranslate = typeof self !== "undefined" && "Translator" in self;
  const translateNotes = async () => {
    const src = otherNotes[0];
    if (!src) return;
    setTranslating(true);
    try {
      const t = await self.Translator.create({ sourceLanguage: src.lang, targetLanguage: lang });
      const out = [];
      for (const line of src.text.split("\n")) out.push(line.trim() ? await t.translate(line) : line);
      setNotes(out.join("\n"));
    } catch (e) { alert(tr("Automatic translation is not available here — please write the text in this language.")); }
    setTranslating(false);
  };
  const save = async () => {
    try { await saveFinalReportFields({ host: fields.host || "", technical: fields.technical || "", notes: fields.notes || "", notesByLang: fields.notesByLang || {}, media: fields.media || {}, stream: fields.stream || {} }); setDirty(false); }
    catch (e) { alert(tr("Could not save: {e}", { e: String(e?.message || e) })); }
  };

  const data = useMemo(() => reportData({
    games, results, reports, defaultMinutes: event?.slots?.gameMinutes,
    rosterOf: (t, cat) => rosters[rosterKey(`${t} - ${cat}`)] || rosters[rosterKey(t)],
  }), [games, results, rosters, reports, event?.slots?.gameMinutes]);

  // Weather per playing day (Open-Meteo), refetched when the days or the place change.
  const [weather, setWeather] = useState(undefined);
  const dayList = data.days.map((d) => `${d.day.getTime()}|${d.first.getHours()}|${d.last.getHours()}`).join(",");
  useEffect(() => {
    if (!data.days.length) return;
    let live = true;
    setWeather(undefined);
    import("../report/weather.js").then(({ fetchWeather }) => fetchWeather(event?.place, data.days))
      .then((w) => { if (live) setWeather(w); })
      .catch((e) => { console.warn("weather unavailable:", e); if (live) setWeather(null); });
    return () => { live = false; };
  }, [dayList, event?.place]);

  const model = useMemo(() => reportModel({ data, lang, tr, event, branding, fields, refsCount: refs.length, reports, teamLogos, venueMap, mapPages, weather, mdpGames }),
    [data, lang, tr, event, branding, fields, refs.length, reports, teamLogos, venueMap, mapPages, weather, mdpGames]);

  const downloadWord = async () => {
    setBusy(true);
    try {
      const { buildFinalReportDocx } = await import("../report/finalReportDocx.js");
      const blob = await buildFinalReportDocx(model);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${fileSafe(`Final-report-${event?.name || "event"}`)}.docx`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { alert(tr("Could not create the Word file: {e}", { e: String(e?.message || e) })); }
    setBusy(false);
  };

  return (
    <>
      <section className="card no-print fr-edit">
        <div className="fr-edit-grid">
          <label>{tr("Host")}<input className="fr-input" value={fields.host} onChange={set("host")} placeholder={tr("e.g. Federación Chilena de Fistball")} /></label>
          <label>{tr("Technical responsible")}<input className="fr-input" value={fields.technical} onChange={set("technical")} placeholder={tr("e.g. Technical delegate's name")} /></label>
        </div>
        <label>{tr("Final remarks in {lang} — shown at the end of the report", { lang: langName(lang) })}
          <textarea className="fr-input" rows={4} value={notesOf(lang)} onChange={(e) => setNotes(e.target.value)}
            placeholder={otherNotes[0] ? `${langName(otherNotes[0].lang)}: ${otherNotes[0].text}` : ""} /></label>
        {otherNotes.length > 0 && !notesOf(lang).trim() && (
          <p className="muted-sm">
            {tr("No final remarks in {lang} yet — the report would show the {other} text.", { lang: langName(lang), other: langName(otherNotes[0].lang) })}{" "}
            {canTranslate && <button className="btn sm" onClick={translateNotes} disabled={translating}>{translating ? tr("Translating…") : tr("Translate from {other}", { other: langName(otherNotes[0].lang) })}</button>}{" "}
            <button className="btn sm" onClick={() => setNotes(otherNotes[0].text)}>{tr("Copy to edit")}</button>
          </p>
        )}
        <fieldset className="fr-media">
          <legend>{tr("Media impact (social media insights, typed in after the event)")}</legend>
          <div className="fr-media-grid">
            {[["platform", "Platform", "Instagram"], ["views", "Total views"], ["followers", "Views from followers"], ["posts", "Posts published"],
              ["likes", "Likes"], ["comments", "Comments"], ["shares", "Shares"]].map(([k, label, ph]) => (
              <label key={k}>{tr(label)}<input className="fr-input" inputMode={k === "platform" ? undefined : "numeric"} value={fields.media?.[k] || ""} onChange={setMedia(k)} placeholder={ph || ""} /></label>
            ))}
          </div>
          <p className="muted-sm">{tr("Non-followers, percentages, total interactions, averages per post and the engagement rate are calculated.")}</p>
        </fieldset>
        <fieldset className="fr-media">
          <legend>{tr("Livestream views per day")}</legend>
          <div className="fr-media-grid">
            <label>{tr("Platform")}<input className="fr-input" value={fields.stream?.platform || ""} onChange={setStream("platform")} placeholder="YouTube" /></label>
            {data.days.map((d, i) => {
              const key = dayKey(d.day);
              return <label key={key}>{tr("Day {n}", { n: i + 1 })} · {d.day.toLocaleDateString(localeOf(lang), { day: "2-digit", month: "2-digit" })}
                <input className="fr-input" inputMode="numeric" value={fields.stream?.days?.[key] || ""} onChange={setStreamDay(key)} /></label>;
            })}
          </div>
          <p className="muted-sm">{data.days.length ? tr("Total, most watched day, average per day and the total media impact (social media + livestream views) are calculated.") : tr("The playing days appear here once games have been played.")}</p>
        </fieldset>
        <div className="fr-actions">
          <button className="btn sm primary" onClick={save} disabled={!dirty}>{dirty ? tr("Save") : tr("Saved")}</button>
          <span className="spacer" />
          <button className="btn sm" onClick={() => window.print()}>{tr("Print / PDF")}</button>
          <button className="btn sm" onClick={downloadWord} disabled={busy}>{busy ? tr("Creating…") : tr("Word (.docx)")}</button>
        </div>
        <p className="muted-sm">{tr("The report uses the event logo and promoter logos (Settings → Event logos), team logos and the venue map (Venue & training).")}</p>
      </section>

      <section className="card fr-doc">
        <header className="fr-cover">
          {model.eventLogo && <img className="fr-cover-logo" src={model.eventLogo} alt="" />}
          <h1>{model.title}</h1>
          <div className="fr-cover-name">{model.eventName}</div>
          {model.lines.filter(Boolean).map((l) => <div key={l} className="fr-cover-line">{l}</div>)}
          {model.promoters.length > 0 && <div className="fr-promoters">{model.promoters.map((p, i) => <img key={i} src={p} alt="" />)}</div>}
        </header>
        {model.sections.map((s) => (
          <div key={s.heading} className={`fr-section${s.newPage ? " fr-newpage" : ""}`}>
            <h2>{s.heading}</h2>
            {s.blocks.map((b, i) => <Block key={i} b={b} />)}
          </div>
        ))}
      </section>
    </>
  );
}

function Cell({ c }) {
  if (c && typeof c === "object") return <>{c.logo && <img className="fr-team-logo" src={c.logo} alt="" />}{c.text}</>;
  return c;
}
function Block({ b }) {
  if (b.type === "p") return <p className={b.small ? "fr-foot" : ""}>{b.text}</p>;
  if (b.type === "h3") return <h3>{b.text}</h3>;
  if (b.type === "kv") return (
    <table className="fr-table fr-kv">{b.title && <thead><tr><th colSpan={2} className="fr-kv-title">{b.title}</th></tr></thead>}<tbody>{b.rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
  );
  if (b.type === "table") return (
    <table className="fr-table fr-wide">
      <thead><tr>{b.head.map((h, i) => <th key={i} className={b.num?.includes(i) ? "fr-num" : ""}>{h}</th>)}</tr></thead>
      <tbody>
        {b.rows.map((r, ri) => <tr key={ri}>{r.map((c, i) => <td key={i} className={b.num?.includes(i) ? "fr-num" : ""}><Cell c={c} /></td>)}</tr>)}
        {b.total && <tr className="fr-total">{b.total.map((c, i) => <td key={i} className={b.num?.includes(i) ? "fr-num" : ""}><b>{c}</b></td>)}</tr>}
      </tbody>
    </table>
  );
  if (b.type === "ranks") return (
    <div className="fr-rank-grid">
      {b.items.map((it) => (
        <table key={it.title} className="fr-table fr-rank">
          <thead><tr><th colSpan={2}>{it.title}</th></tr></thead>
          <tbody>{it.rows.map((r) => <tr key={r.team}><td className="fr-num">{r.pos}</td><td><Cell c={{ text: r.team, logo: r.logo }} /></td></tr>)}</tbody>
        </table>
      ))}
    </div>
  );
  if (b.type === "image") return <img className="fr-map" src={b.src} alt="" />;
  return null;
}

/* ---------------- game reports by team ---------------- */
function TeamReports({ event, branding, games, reports, reload }) {
  const tr = useT();
  const teams = useMemo(() => {
    const m = new Map();
    for (const g of games) for (const t of [g.teamA?.name, g.teamB?.name]) {
      if (!t || isPlaceholder(t)) continue;
      const key = `${t}|${g.category || ""}`;
      if (!m.has(key)) m.set(key, { key, name: t, category: g.category || "" });
    }
    return [...m.values()].sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
  }, [games]);
  const [key, setKey] = useState("");
  const [onlyDone, setOnlyDone] = useState(true);
  const [busy, setBusy] = useState(false);
  const team = teams.find((t) => t.key === key) || teams[0];
  const repById = useMemo(() => Object.fromEntries((reports || []).map((r) => [r.id, r])), [reports]);
  const list = useMemo(() => !team ? [] : games
    .filter((g) => (g.category || "") === team.category && (g.teamA?.name === team.name || g.teamB?.name === team.name))
    .sort(byNr), [games, team]);
  const printable = list.filter((g) => repById[g.id] && (!onlyDone || repById[g.id].status === "submitted"));

  const download = async () => {
    setBusy(true);
    try {
      await reload();
      const drafts = printable.map((g) => {
        const r = repById[g.id];
        const susp = r.suspensions || {};
        const mark = (side) => ({
          ...r[side],
          players: (r[side]?.players || []).map((p) => ({ ...p, suspended: !!p.suspended || (susp[side] || []).includes(`${p.nr}|${p.name}|${p.first}`) })),
          staff: r[side]?.staff || [],
        });
        return {
          ...r,
          info: { ...(r.info || {}), nr: g.nr, date: g.date, time: g.time, court: g.court },
          teamA: mark("teamA"), teamB: mark("teamB"),
          timeouts: r.timeouts || { teamA: [], teamB: [] },
          ballChoice: r.ballChoice || { set1: "", set5: "" },
          referees: r.referees || {},
          signatures: { capA: false, capB: false, referee: false, clerk: false, ...(r.signatures || {}) },
          amendments: r.amendments || [],
          sets: r.sets || [],
        };
      });
      const blob = await pdf(<SumulasPDF drafts={drafts} event={event} branding={branding} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `${fileSafe(`Game-reports-${short(team.name)}-${team.category}`)}.pdf`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch (e) { alert(tr("Could not create the PDF: {e}", { e: String(e?.message || e) })); }
    setBusy(false);
  };

  if (!teams.length) return <div className="empty">{tr("No games with teams yet.")}</div>;
  return (
    <section className="card">
      <div className="plan-bar">
        <select className="ag-role" value={team?.key || ""} onChange={(e) => setKey(e.target.value)} aria-label={tr("Team")}>
          {teams.map((t) => <option key={t.key} value={t.key}>{short(t.name)}{t.category ? ` — ${t.category}` : ""}</option>)}
        </select>
        <label className="muted-sm"><input type="checkbox" checked={onlyDone} onChange={(e) => setOnlyDone(e.target.checked)} /> {tr("Submitted reports only")}</label>
        <button className="btn sm primary" onClick={download} disabled={busy || reports === null || !printable.length}>
          {busy ? tr("Creating PDF…") : printable.length === 1 ? tr("PDF — {n} game report", { n: 1 }) : tr("PDF — {n} game reports", { n: printable.length })}
        </button>
      </div>
      <p className="muted-sm">{tr("All game reports (súmulas) of the team in one PDF, one page per game, in game order — to print or send.")}</p>
      <table className="ref-grid plan-table">
        <thead><tr><th>#</th><th>{tr("Date")}</th><th>{tr("Time")}</th><th>{tr("Court")}</th><th>{tr("Round")}</th><th>{tr("Match")}</th><th>{tr("Report")}</th></tr></thead>
        <tbody>
          {list.map((g) => {
            const r = repById[g.id];
            const st = !r ? "not opened" : r.status === "submitted" ? "submitted" : r.amending ? "being amended" : "not submitted";
            return (
              <tr key={g.id} className={printable.includes(g) ? "" : "fr-skip"}>
                <td>#{g.nr}</td><td>{g.date}</td><td>{g.time}</td><td>{g.court}</td><td>{g.round}</td>
                <td>{flagFor(g.teamA?.name)} {short(g.teamA?.name)} <span className="muted-sm">v</span> {flagFor(g.teamB?.name)} {short(g.teamB?.name)}</td>
                <td>{reports === null ? "…" : tr(st)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </section>
  );
}

/* ---------------- broadcast links of a day ---------------- */
// Every game's broadcast scoreboard link for one day (or the whole event),
// to print / save as PDF or paste into a spreadsheet instead of copying them one by one.
function BroadcastList({ eventId, event, games }) {
  const tr = useT();
  const [lang] = useLang();
  const loc = localeOf(lang);
  const rows = useMemo(() => games
    .map((g) => ({ g, start: scheduledStart(g.date, g.time) }))
    .sort((a, b) => (a.start?.getTime() ?? Infinity) - (b.start?.getTime() ?? Infinity) || String(a.g.court).localeCompare(String(b.g.court), undefined, { numeric: true }) || byNr(a.g, b.g))
    .map(({ g, start }) => ({
      id: g.id, start, nr: g.nr ?? "", time: g.time || "", court: g.court ?? "",
      day: start ? `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}` : String(g.date || ""),
      category: tCategory(lang, g.category || ""), round: g.round || "",
      match: `${short(g.teamA?.name ?? g.teamA)} ${tr("vs")} ${short(g.teamB?.name ?? g.teamB)}`,
      url: overlayUrl(eventId, { game: g.id }),
    })), [games, eventId, lang, tr]);
  const days = [...new Set(rows.map((r) => r.day))];
  const [day, setDay] = useState("");
  const pick = day && days.includes(day) ? day : days[0] || "all";
  const list = pick === "all" ? rows : rows.filter((r) => r.day === pick);
  const dayName = (key) => {
    const r = rows.find((x) => x.day === key);
    return r?.start ? r.start.toLocaleDateString(loc, { weekday: "long", day: "2-digit", month: "2-digit", year: "numeric" }) : key || "—";
  };
  const head = [tr("Day"), tr("Time"), tr("Court"), tr("Game"), tr("Category"), tr("Match"), tr("Broadcast link")];
  const cells = (r) => [dayName(r.day), r.time, r.court, r.nr, r.category, r.match, r.url];
  const copyAll = async () => {
    const tsv = [head, ...list.map(cells)].map((l) => l.map((c) => String(c ?? "").replace(/\s+/g, " ")).join("\t")).join("\n");
    try { await navigator.clipboard.writeText(tsv); alert(tr("{n} links copied — paste them into Excel or Google Sheets.", { n: list.length })); }
    catch (_) { window.prompt(tr("Copy the link:"), tsv); }
  };
  const csv = () => {
    const q = (c) => `"${String(c ?? "").replace(/"/g, '""')}"`;
    const blob = new Blob(["\ufeff" + [head, ...list.map(cells)].map((l) => l.map(q).join(";")).join("\r\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `${fileSafe(`Broadcast-links-${event?.name || "event"}-${pick}`)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  };
  return (
    <>
      <section className="card no-print">
        <div className="fr-actions" style={{ flexWrap: "wrap", gap: 8 }}>
          <label>{tr("Day")}{" "}
            <select className="lang-pick" value={pick} onChange={(e) => setDay(e.target.value)}>
              {days.map((d) => <option key={d} value={d}>{dayName(d)}</option>)}
              <option value="all">{tr("Whole event")}</option>
            </select>
          </label>
          <span className="spacer" />
          <button className="btn sm" onClick={() => window.print()} disabled={!list.length}>{tr("Print / PDF")}</button>
          <button className="btn sm" onClick={copyAll} disabled={!list.length}>{tr("Copy for Excel")}</button>
          <button className="btn sm" onClick={csv} disabled={!list.length}>{tr("Download CSV")}</button>
        </div>
        <p className="muted-sm">{tr("Each link shows the live scoreboard of that game (OBS/vMix browser source) — the same link as “📺 Broadcast link” in the game report.")}</p>
      </section>
      <section className="card fr-doc">
        <h2>{tr("Broadcast links")} — {event?.name || ""}</h2>
        <p className="muted-sm">{pick === "all" ? tr("Whole event") : dayName(pick)} · {tr("{n} games", { n: list.length })}</p>
        {!list.length ? <p className="muted-sm">{tr("No games yet.")}</p> : (
          <table className="fr-table bl-table">
            <thead><tr>{(pick === "all" ? head : head.slice(1)).map((h) => <th key={h}>{h}</th>)}</tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.id}>
                  {pick === "all" && <td>{dayName(r.day)}</td>}
                  <td>{r.time}</td><td>{r.court}</td><td>{r.nr}</td><td>{r.category}</td><td>{r.match}</td>
                  <td className="bl-url"><a href={r.url} target="_blank" rel="noreferrer">{r.url}</a></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/* ---------------- MDP of the event ---------------- */
// How the points of the event were decided (scouted games only), per category and team.
function MdpSummary({ event, mdpGames }) {
  const tr = useT();
  const [lang] = useLang();
  const blocks = mdpBlocks(mdpGames, { tr, C: (c) => tCategory(lang, c), T: (t) => short(t), loc: localeOf(lang) });
  return (
    <>
      <section className="card no-print">
        <div className="fr-actions"><span className="muted-sm">{tr("Scouted in each game via “📊 MDP”. The same tables are in the event final report.")}</span><span className="spacer" />
          <button className="btn sm" onClick={() => window.print()} disabled={!blocks}>{tr("Print / PDF")}</button></div>
      </section>
      <section className="card fr-doc">
        <h2>{tr("Map Definition Point (MDP)")} — {event?.name || ""}</h2>
        {blocks ? blocks.map((b, i) => <Block key={i} b={b} />) : <p className="muted-sm">{tr("No points scouted yet.")}</p>}
      </section>
    </>
  );
}
