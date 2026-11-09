import { useEffect, useMemo, useState } from "react";
import {
  subscribeVenueMap, setVenueMap, subscribeTraining, addTrainingSlots, updateTrainingSlot, deleteTrainingSlots,
} from "../cloud.js";
import { useEvent } from "../eventContext.js";
import { useT, tNow, currentLang, localeOf } from "../i18n.js";

const LIVE_URL = "https://c-englert.github.io/fistball-live/";
// A Firestore doc holds at most 1 MiB — the map is stored inline as a data URL.
const MAX_DATA_URL = 950_000;

const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + (m || 0); };
const toHHMM = (n) => `${String(Math.floor(n / 60)).padStart(2, "0")}:${String(n % 60).padStart(2, "0")}`;
const dayLabel = (iso) => {
  const d = new Date(iso + "T12:00:00");
  return isNaN(d) ? iso : d.toLocaleDateString(localeOf(currentLang()), { weekday: "long", day: "numeric", month: "long" });
};

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(new Error(tNow("Could not read the file.")));
  r.readAsDataURL(file);
});

// Images become a JPEG shrunk until it fits the doc; PDFs are kept as they
// are when small enough.
async function mapFromFile(file) {
  if (file.type === "application/pdf") {
    const data = await readAsDataUrl(file);
    if (data.length > MAX_DATA_URL) throw new Error(tNow("This PDF is too big (max ≈ 700 KB). Export the map as a JPG/PNG image and upload that instead."));
    return { kind: "pdf", data, name: file.name };
  }
  if (!file.type.startsWith("image/")) throw new Error(tNow("Use an image (JPG, PNG) or a PDF."));
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error(tNow("Could not read this image."))); i.src = url; });
    const iw = img.naturalWidth || 1600, ih = img.naturalHeight || 1200;
    for (const [size, q] of [[2400, 0.85], [2000, 0.8], [1600, 0.75], [1280, 0.7], [1000, 0.65]]) {
      const scale = Math.min(1, size / Math.max(iw, ih));
      const c = document.createElement("canvas");
      c.width = Math.round(iw * scale); c.height = Math.round(ih * scale);
      const ctx = c.getContext("2d");
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, c.width, c.height);
      ctx.drawImage(img, 0, 0, c.width, c.height);
      const data = c.toDataURL("image/jpeg", q);
      if (data.length <= MAX_DATA_URL) return { kind: "image", data, name: file.name };
    }
    throw new Error(tNow("This image is too big even when shrunk."));
  } finally { URL.revokeObjectURL(url); }
}

function VenueMapCard({ archived }) {
  const tr = useT();
  const [map, setMap] = useState(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => subscribeVenueMap(setMap), []);
  const upload = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setBusy(true);
    try { await setVenueMap(await mapFromFile(file)); }
    catch (err) { alert(err?.message || String(err)); }
    finally { setBusy(false); }
  };
  const remove = async () => {
    if (!window.confirm(tr("Remove the venue map from Fistball Live?"))) return;
    try { await setVenueMap(null); } catch (err) { alert(err?.message || String(err)); }
  };
  const openPdf = () => {
    const w = window.open();
    if (w) w.document.write(`<iframe src="${map.data}" style="border:0;position:fixed;inset:0;width:100%;height:100%"></iframe>`);
  };
  const mapHint = tr("Image (JPG/PNG) or PDF. Shown in the {b} tab of Fistball Live.").split("{b}");
  return (
    <div className="card">
      <div className="row-between">
        <h2 style={{ margin: 0 }}>{tr("Venue map")}</h2>
        {map && !archived && <button className="btn sm danger" onClick={remove}>{tr("Remove")}</button>}
      </div>
      <p className="muted-sm">{mapHint[0]}<b>{tr("Venue map")}</b>{mapHint[1]}</p>
      {map === undefined ? <p className="muted-sm">{tr("Loading…")}</p>
        : map ? (map.kind === "image"
          ? <img src={map.data} alt={tr("Venue map")} className="venue-map-img" />
          : <p>📄 {map.name || "Venue map.pdf"} <button className="btn sm" onClick={openPdf}>{tr("Open")}</button></p>)
        : <p className="muted-sm">{tr("No map yet.")}</p>}
      {!archived && (
        <label className="btn primary" style={{ marginTop: 10, display: "inline-block" }}>
          {busy ? tr("Uploading…") : map ? tr("Replace map…") : tr("Upload map…")}
          <input type="file" accept="image/*,application/pdf" hidden disabled={busy} onChange={upload} />
        </label>
      )}
    </div>
  );
}

function TrainingCard({ event, archived }) {
  const tr = useT();
  const [slots, setSlots] = useState(null);
  useEffect(() => subscribeTraining(setSlots), []);
  const [f, setF] = useState(() => ({ date: event?.startDate || "", from: "08:00", to: "12:00", len: 60, places: "Court 1" }));
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const preview = useMemo(() => {
    const a = toMin(f.from), b = toMin(f.to), len = Number(f.len);
    const places = f.places.split(",").map((s) => s.trim()).filter(Boolean);
    if (!f.date || !(len > 0) || !(b > a) || !places.length) return [];
    const out = [];
    for (let t = a; t + len <= b; t += len) for (const place of places) out.push({ date: f.date, start: toHHMM(t), end: toHHMM(t + len), place });
    return out;
  }, [f]);

  const add = async () => {
    const existing = new Set((slots || []).map((s) => `${s.date}|${s.start}|${s.place}`));
    const fresh = preview.filter((s) => !existing.has(`${s.date}|${s.start}|${s.place}`));
    if (!fresh.length) { alert(tr("These slots already exist.")); return; }
    try { await addTrainingSlots(fresh); } catch (err) { alert(tr("Couldn't add the slots: {e}", { e: String(err?.message || err) })); }
  };
  const clearBooking = async (s) => {
    if (!window.confirm(tr("Free this slot (booked by {team})?", { team: s.team }))) return;
    try { await updateTrainingSlot(s.id, { team: "", bookedAt: null }); } catch (err) { alert(err?.message || String(err)); }
  };
  const bookFor = async (s) => {
    const team = window.prompt(tr("Team for {start}–{end} · {place}:", { start: s.start, end: s.end, place: s.place }), "");
    if (!team || !team.trim()) return;
    try { await updateTrainingSlot(s.id, { team: team.trim().slice(0, 60), bookedAt: Date.now() }); } catch (err) { alert(err?.message || String(err)); }
  };
  const remove = async (ids, what) => {
    if (!window.confirm(tr("Delete {what}?", { what }))) return;
    try { await deleteTrainingSlots(ids); } catch (err) { alert(err?.message || String(err)); }
  };

  const days = useMemo(() => {
    const m = new Map();
    for (const s of [...(slots || [])].sort((x, y) => `${x.date} ${x.start} ${x.place}`.localeCompare(`${y.date} ${y.start} ${y.place}`, undefined, { numeric: true }))) {
      if (!m.has(s.date)) m.set(s.date, []);
      m.get(s.date).push(s);
    }
    return [...m.entries()];
  }, [slots]);
  const trainHint = tr("Add the times when the courts are free for training. On Fistball Live (tab {b}) anyone with the link books a free slot by typing the team name. A booked slot can only be freed here.").split("{b}");

  return (
    <div className="card">
      <div className="row-between">
        <h2 style={{ margin: 0 }}>{tr("Training schedule")}</h2>
        <a className="btn sm" href={LIVE_URL} target="_blank" rel="noreferrer">Fistball Live ↗</a>
      </div>
      <p className="muted-sm">{trainHint[0]}<b>{tr("Training")}</b>{trainHint[1]}</p>
      {!archived && (
        <div className="training-gen">
          <div className="grid2">
            <div className="field"><span>{tr("Day")}</span><input type="date" value={f.date} min={event?.startDate || undefined} onChange={set("date")} /></div>
            <div className="field"><span>{tr("Courts / places")} <span className="muted-sm">{tr("(comma-separated)")}</span></span><input value={f.places} onChange={set("places")} placeholder={tr("Court 1, Court 2")} /></div>
          </div>
          <div className="grid3">
            <div className="field"><span>{tr("From")}</span><input type="time" value={f.from} onChange={set("from")} /></div>
            <div className="field"><span>{tr("To")}</span><input type="time" value={f.to} onChange={set("to")} /></div>
            <div className="field"><span>{tr("Slot (min)")}</span><input type="number" min="15" step="15" value={f.len} onChange={set("len")} /></div>
          </div>
          <button className="btn primary" disabled={!preview.length} onClick={add}>{preview.length === 1 ? tr("Add {n} slot", { n: 1 }) : tr("Add {n} slots", { n: preview.length || "" })}</button>
        </div>
      )}
      {slots === null ? <p className="muted-sm">{tr("Loading…")}</p> : !days.length ? <p className="muted-sm">{tr("No training slots yet.")}</p> : days.map(([date, list]) => (
        <div key={date} className="training-day">
          <div className="row-between">
            <div className="subhead" style={{ margin: 0 }}>{dayLabel(date)} <span className="muted-sm">· {tr("{a}/{b} booked", { a: list.filter((s) => s.team).length, b: list.length })}</span></div>
            {!archived && <button className="btn sm ghost" onClick={() => remove(list.map((s) => s.id), tr("all {n} slots of {day}", { n: list.length, day: dayLabel(date) }))}>{tr("Delete day")}</button>}
          </div>
          {list.map((s) => (
            <div key={s.id} className={`training-slot ${s.team ? "booked" : ""}`}>
              <span className="ts-time">{s.start}–{s.end}</span>
              <span className="ts-place">{s.place}</span>
              <span className="ts-team">{s.team || <span className="muted-sm">{tr("free")}</span>}</span>
              {!archived && (
                <span className="ts-actions">
                  {s.team
                    ? <button className="btn sm" onClick={() => clearBooking(s)}>{tr("Free")}</button>
                    : <button className="btn sm" onClick={() => bookFor(s)}>{tr("Book")}</button>}
                  <button className="btn sm ghost" title={tr("Delete slot")} onClick={() => remove([s.id], tr("the slot {start}–{end} · {place}", { start: s.start, end: s.end, place: s.place }))}>✕</button>
                </span>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export default function Venue() {
  const { event, archived } = useEvent();
  const tr = useT();
  return (
    <>
      <h2 className="page-h">{tr("Venue & training")}</h2>
      <VenueMapCard archived={archived} />
      <TrainingCard event={event} archived={archived} />
    </>
  );
}
