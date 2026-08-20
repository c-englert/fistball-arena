import {
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, onSnapshot,
  runTransaction, serverTimestamp, updateDoc, writeBatch, deleteDoc, query, where,
} from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { db, auth, googleProvider } from "./firebase.js";
import { team } from "./seed.js";
import { resolveAdvancement } from "./schedule/advance.js";

/* ----------------- identity (Google login) ----------------- */
// Org-admins can create events and manage members of any event. Kept in sync
// with the same list in firestore.rules.
const ORG_ADMINS = [
  "claudio.englert@gmail.com",
  "claudio@qualitin.com",
  "gastaoenglert@gmail.com",
];
export function isOrgAdmin(email) {
  return ORG_ADMINS.includes((email || "").toLowerCase());
}

// Map a Firebase auth user to our app "me" shape (null when signed out).
function toMe(user) {
  if (!user) return null;
  const email = (user.email || "").toLowerCase();
  return { uid: user.uid, name: user.displayName || email || "User", email, photo: user.photoURL || "", admin: isOrgAdmin(email) };
}

export function onMe(cb) {
  return onAuthStateChanged(auth, (user) => cb(toMe(user)));
}
export async function signInWithGoogle() {
  const cred = await signInWithPopup(auth, googleProvider);
  return toMe(cred.user);
}
export async function signOutMe() {
  await signOut(auth);
}

/* ----------------- event scoping ----------------- */
// All game data lives under events/{eid}/…. setEvent() picks the current event;
// the path helpers below build the nested paths so function bodies stay simple.
let _eid = null;
export function setEvent(eid) { _eid = eid; }
export function currentEventId() { return _eid; }
function reqEid() {
  if (!_eid) throw new Error("cloud: no event selected (call setEvent first)");
  return _eid;
}
function ecol(name) { return collection(db, "events", reqEid(), name); }
function edoc(name, id) { return doc(db, "events", reqEid(), name, id); }

/* ----------------- events & membership ----------------- */
// Events the signed-in user can access. Org-admins see all events; others see
// only events where they hold a membership (matched by email).
export function listMyEvents(me, cb) {
  if (me.admin) {
    return onSnapshot(collection(db, "events"),
      (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data(), myRole: "admin" }))),
      (err) => { console.warn("events unavailable:", err?.code || err); cb([]); });
  }
  return onSnapshot(
    query(collectionGroup(db, "members"), where("email", "==", me.email)),
    async (snap) => {
      const rows = await Promise.all(snap.docs.map(async (m) => {
        const evRef = m.ref.parent.parent;
        try {
          const ev = await getDoc(evRef);
          return ev.exists() ? { id: ev.id, ...ev.data(), myRole: m.data().role } : null;
        } catch (_) { return null; }
      }));
      cb(rows.filter(Boolean));
    },
    (err) => { console.warn("my events unavailable:", err?.code || err); cb([]); }
  );
}

// Public per-event info doc (read by the anonymous Live for header + countdown).
// Merged so branding (logos) and details (name/place/dates) coexist.
function writeEventPublic(eid, patch) {
  return setDoc(doc(db, "public", `event_${eid}`), { eventId: eid, ...patch }, { merge: true });
}

export async function createEvent(descriptor, me) {
  const ref = doc(collection(db, "events"));
  await setDoc(ref, {
    name: descriptor.name || "New event",
    place: descriptor.place || "",
    dates: descriptor.dates || "",
    startDate: descriptor.startDate || "",
    endDate: descriptor.endDate || "",
    status: descriptor.status === "archived" ? "archived" : "active",
    createdBy: me.uid,
    createdAt: serverTimestamp(),
  });
  await writeEventPublic(ref.id, {
    name: descriptor.name || "", place: descriptor.place || "", dates: descriptor.dates || "",
    startsAt: descriptor.startDate || "", endsAt: descriptor.endDate || "",
  });
  // Add the creator as an admin member so they always appear in their list.
  await setDoc(doc(db, "events", ref.id, "members", me.email), {
    email: me.email, name: me.name, role: "admin", addedBy: me.email, addedAt: serverTimestamp(),
  });
  return ref.id;
}

export function subscribeEvent(cb) {
  return onSnapshot(doc(db, "events", reqEid()),
    (d) => cb(d.exists() ? { id: d.id, ...d.data() } : null),
    (err) => { console.warn("event unavailable:", err?.code || err); cb(null); });
}
export async function setEventStatus(status) {
  await updateDoc(doc(db, "events", reqEid()), { status });
}
// Write specific fields to the event doc without touching the public projection
// (used for collaborative fields like categoryBuilder / entries).
export async function updateEventFields(patch, eventId) {
  await updateDoc(doc(db, "events", eventId || reqEid()), patch);
}

// Non-game schedule entries (ceremonies, breaks). Stored on the event doc AND
// mirrored to the public doc so Fistball Live can show them without login.
export async function saveScheduleBlocks(blocks) {
  const eid = reqEid();
  await updateDoc(doc(db, "events", eid), { scheduleBlocks: blocks });
  await writeEventPublic(eid, { scheduleBlocks: blocks });
}

export async function updateEventDetails(patch, eventId) {
  const eid = eventId || reqEid();
  await updateDoc(doc(db, "events", eid), patch);
  await writeEventPublic(eid, {
    name: patch.name || "", place: patch.place || "", dates: patch.dates || "",
    startsAt: patch.startDate || "", endsAt: patch.endDate || "",
  });
}

export function subscribeMembers(cb) {
  return onSnapshot(ecol("members"),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.warn("members unavailable:", err?.code || err); cb([]); });
}
export async function addMember({ email, name, role }, me) {
  const e = (email || "").toLowerCase().trim();
  if (!e) return;
  await setDoc(edoc("members", e), {
    email: e, name: name || "", role: role || "viewer",
    addedBy: me.email, addedAt: serverTimestamp(),
  });
  await upsertPerson(e, name); // remember for reuse across events
}

/* ----------------- global people directory (reuse across events) ----------------- */
export function subscribePeople(cb) {
  return onSnapshot(collection(db, "people"),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.warn("people unavailable:", err?.code || err); cb([]); });
}
async function upsertPerson(email, name) {
  const e = (email || "").toLowerCase().trim();
  if (!e) return;
  const patch = { email: e };
  if (name && name.trim()) patch.name = name.trim();
  await setDoc(doc(db, "people", e), patch, { merge: true });
}
export async function removeMember(email) {
  await deleteDoc(edoc("members", (email || "").toLowerCase().trim()));
}

// My role for the current event ('admin' | 'official' | 'viewer' | null).
// Org-admins are admin everywhere.
export function subscribeMyRole(me, cb) {
  if (me.admin) { cb("admin"); return () => {}; }
  return onSnapshot(edoc("members", me.email),
    (d) => cb(d.exists() ? d.data().role : null),
    () => cb(null));
}

/* ----------------- logo library + event branding ----------------- */
// Reusable logo library (global). Each logo is { name, dataUrl } (small PNG).
export function subscribeLogos(cb) {
  return onSnapshot(collection(db, "logos"),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.warn("logos unavailable:", err?.code || err); cb([]); });
}
export async function addLogo({ name, dataUrl }, me) {
  const ref = doc(collection(db, "logos"));
  await setDoc(ref, { name: name || "Logo", dataUrl, addedBy: me.email, addedAt: serverTimestamp() });
  return ref.id;
}
export async function deleteLogo(id) { await deleteDoc(doc(db, "logos", id)); }

// Per-event branding lives in a PUBLIC doc so the anonymous Live can read it too.
// { eventId, name, eventLogo: {name,dataUrl}|null, promoters: [{name,dataUrl}] }
export function subscribeBranding(cb) {
  const eid = reqEid();
  return onSnapshot(doc(db, "public", `event_${eid}`),
    (d) => cb(d.exists() ? d.data() : null),
    () => cb(null));
}
export async function saveBranding({ name, eventLogo, promoters }) {
  await writeEventPublic(reqEid(), { name: name || "", eventLogo: eventLogo || null, promoters: promoters || [] });
}

// Branding for ALL events (public), keyed by eventId — for logos on event cards.
export function subscribeAllBranding(cb) {
  return onSnapshot(collection(db, "public"), (snap) => {
    const m = {};
    snap.forEach((d) => { if (d.id.startsWith("event_")) { const v = d.data(); if (v.eventId) m[v.eventId] = v; } });
    cb(m);
  }, (err) => { console.warn("branding list unavailable:", err?.code || err); cb({}); });
}

/* ----------------- Fistball Live pointer -----------------
 * A single PUBLIC doc telling the spectator app which event to show. Read
 * anonymously by Fistball Live; written by an admin of that event (or org-admin). */
export function subscribeLivePointer(cb) {
  return onSnapshot(doc(db, "public", "live"),
    (d) => cb(d.exists() ? d.data() : null),
    (err) => { console.warn("live pointer unavailable:", err?.code || err); cb(null); });
}
export async function setLiveEvent(event) {
  const eid = event?.id || reqEid();
  await setDoc(doc(db, "public", "live"), {
    eventId: eid, name: event?.name || "",
    startsAt: event?.startDate || "", endsAt: event?.endDate || "",
    updatedAt: serverTimestamp(),
  });
  // Ensure the public info doc exists so the Live has place/dates/countdown.
  await writeEventPublic(eid, {
    name: event?.name || "", place: event?.place || "", dates: event?.dates || "",
    startsAt: event?.startDate || "", endsAt: event?.endDate || "",
  });
}
export async function clearLiveEvent() {
  await deleteDoc(doc(db, "public", "live"));
}

/* ----------------- schedule generator config ----------------- */
export function subscribeScheduleConfig(cb) {
  return onSnapshot(edoc("meta", "schedule"),
    (d) => cb(d.exists() ? d.data().config : null),
    (err) => console.warn("schedule config unavailable:", err?.code || err));
}
export async function saveScheduleConfig(config) {
  await setDoc(edoc("meta", "schedule"), { config, updatedAt: serverTimestamp() });
}

/* ----------------- Excel import history ----------------- */
// A rolling log of roster imports, kept in one event-scoped meta doc.
// `at` is a client ISO string (serverTimestamp can't live inside an array).
export function subscribeImportLog(cb) {
  return onSnapshot(edoc("meta", "importLog"),
    (d) => cb(d.exists() ? (d.data().entries || []) : []),
    (err) => { console.warn("import log unavailable:", err?.code || err); cb([]); });
}
export async function appendImportLog(entry) {
  const ref = edoc("meta", "importLog");
  const snap = await getDoc(ref);
  const prev = snap.exists() ? (snap.data().entries || []) : [];
  const entries = [{ at: new Date().toISOString(), ...entry }, ...prev].slice(0, 20);
  await setDoc(ref, { entries, updatedAt: serverTimestamp() });
}

// Delete every doc in an event subcollection, chunked under the batch limit.
async function clearCollection(name) {
  const snap = await getDocs(ecol(name));
  const docs = snap.docs;
  for (let i = 0; i < docs.length; i += 400) {
    const batch = writeBatch(db);
    docs.slice(i, i + 400).forEach((d) => batch.delete(d.ref));
    await batch.commit();
  }
}

// Write generated games. replaceAll wipes existing games + reports + results first.
export async function publishGames(games, { replaceAll } = {}) {
  if (replaceAll) {
    await clearCollection("reports");
    await clearCollection("results");
    await clearCollection("games");
  }
  // 200 games max per batch (2 writes each: game + its "Not Started" result).
  for (let i = 0; i < games.length; i += 200) {
    const batch = writeBatch(db);
    games.slice(i, i + 200).forEach((g) => {
      const id = `g${g.nr}`;
      batch.set(edoc("games", id), {
        nr: g.nr, date: g.date, time: g.time, court: g.court,
        bestOf: g.bestOf, round: g.round, category: g.category, group: g.group || "",
        teamA: g.teamA, teamB: g.teamB, srcA: g.srcA || null, srcB: g.srcB || null,
      });
      // Public results row so the spectator Live sees the whole fixture upfront.
      batch.set(edoc("results", id), {
        nr: g.nr, date: g.date, time: g.time, court: g.court,
        round: g.round, category: g.category, group: g.group || "", bestOf: g.bestOf,
        teamA: g.teamA.name, teamB: g.teamB.name,
        setsA: 0, setsB: 0, pointsA: 0, pointsB: 0, sets: [], status: "Not Started",
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
}

// Reassign day/time/court for individual games (manual drag-drop scheduling).
// Updates BOTH the game doc and its public results row so Fistball Live follows.
export async function updateGameSlots(updates) {
  for (let i = 0; i < updates.length; i += 200) {
    const batch = writeBatch(db);
    updates.slice(i, i + 200).forEach((u) => {
      const id = `g${u.nr}`;
      const patch = { date: u.date || "", time: u.time || "", court: u.court || "" };
      batch.set(edoc("games", id), patch, { merge: true });
      batch.set(edoc("results", id), { ...patch, updatedAt: serverTimestamp() }, { merge: true });
    });
    await batch.commit();
  }
}

// Import a whole past event: games + real results (scores) + rosters.
export async function publishEventImport({ games, results, rosters, cautions }, { replaceAll } = {}) {
  if (replaceAll) {
    await clearCollection("reports");
    await clearCollection("results");
    await clearCollection("games");
    if (rosters && Object.keys(rosters).length) await clearCollection("rosters");
  }
  const g = games || [];
  for (let i = 0; i < g.length; i += 200) {
    const batch = writeBatch(db);
    g.slice(i, i + 200).forEach((x) => batch.set(edoc("games", `g${x.nr}`), {
      nr: x.nr, date: x.date, time: x.time, court: x.court, bestOf: x.bestOf, round: x.round, category: x.category, group: x.group || "", teamA: x.teamA, teamB: x.teamB,
    }));
    await batch.commit();
  }
  const rs = results || [];
  for (let i = 0; i < rs.length; i += 400) {
    const batch = writeBatch(db);
    rs.slice(i, i + 400).forEach((x) => batch.set(edoc("results", `g${x.nr}`), { ...x, updatedAt: serverTimestamp() }));
    await batch.commit();
  }
  const entries = Object.entries(rosters || {});
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db);
    entries.slice(i, i + 400).forEach(([k, v]) => batch.set(edoc("rosters", k), v));
    await batch.commit();
  }
  // Cards (from the sheet's Cautions DB) go on the public event doc so Fistball
  // Live can render the Cards tab for this imported event.
  await writeEventPublic(reqEid(), { cautions: cautions || [] });
}

/* ----------------- players & staff registry (rosters) ----------------- */
export function subscribeRosters(cb) {
  const eid = reqEid();
  return onSnapshot(ecol("rosters"), (snap) => {
    if (eid !== _eid) return;
    const m = {};
    snap.forEach((d) => (m[d.id] = d.data()));
    cb(m);
  }, (err) => { console.warn("rosters unavailable:", err?.code || err); cb({}); });
}
export async function publishRosters(rosters) {
  const entries = Object.entries(rosters);
  for (let i = 0; i < entries.length; i += 400) {
    const batch = writeBatch(db);
    entries.slice(i, i + 400).forEach(([key, v]) => batch.set(edoc("rosters", key), v));
    await batch.commit();
  }
}
// Wipe the whole players & staff registry for the current event.
export async function clearRosters() { await clearCollection("rosters"); }
/* ----------------- referees registry ----------------- */
export function subscribeReferees(cb) {
  return onSnapshot(ecol("referees"),
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))),
    (err) => { console.warn("referees unavailable:", err?.code || err); cb([]); });
}
export async function publishReferees(list, { replaceAll } = {}) {
  if (replaceAll) await clearCollection("referees");
  for (let i = 0; i < list.length; i += 400) {
    const batch = writeBatch(db);
    list.slice(i, i + 400).forEach((r, j) => {
      const id = (`${r.name}_${r.first}`).toLowerCase().replace(/[^a-z0-9]+/g, "_") || `ref_${i + j}`;
      batch.set(edoc("referees", id), { name: r.name, first: r.first, role: r.role || "Referee", photo: r.photo || "", birthday: r.birthday || "" });
    });
    await batch.commit();
  }
}

// Rosters are keyed by "<team> - <category>" (so the same club/country can field
// a squad in more than one category), with a plain "<team>" fallback for older
// imports and events whose team names already carry the category.
async function getRoster(teamName, category) {
  if (!teamName) return null;
  const keys = category ? [`${teamName} - ${category}`, teamName] : [teamName];
  for (const k of keys) {
    const s = await getDoc(edoc("rosters", k));
    if (s.exists()) return s.data();
  }
  return null;
}
export async function fetchTeamRosters(names, category) {
  const out = {};
  for (const name of [...new Set(names)]) {
    const r = await getRoster(name, category);
    if (r) out[name] = r;
  }
  return out;
}

/* ----------------- games ----------------- */
export function subscribeGames(cb) {
  const eid = reqEid();
  return onSnapshot(ecol("games"),
    (snap) => { if (eid === _eid) cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); },
    (err) => console.warn("games unavailable:", err?.code || err));
}

// Every published result (scores + cards) — used for standings embeds and the
// per-person match/card history on the Players & staff page.
export function subscribeResults(cb) {
  const eid = reqEid();
  return onSnapshot(ecol("results"),
    (snap) => { if (eid === _eid) cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }))); },
    (err) => { console.warn("results unavailable:", err?.code || err); cb([]); });
}

// Live status/lock of every report (for the list badges).
export function subscribeReports(cb) {
  const eid = reqEid();
  return onSnapshot(ecol("reports"), (snap) => {
    if (eid !== _eid) return;
    const map = {};
    snap.forEach((d) => {
      const r = d.data();
      map[d.id] = { status: r.status || "not_started", lockedBy: r.lockedBy || null };
    });
    cb(map);
  }, (err) => console.warn("reports unavailable:", err?.code || err));
}

/* ----------------- one report (súmula) ----------------- */
function cloneTeam(t) {
  return {
    name: t.name,
    players: (t.players || []).map((p) => ({
      nr: p.nr, name: p.name, first: p.first, photo: p.photo || "", captain: !!p.captain, onCourt: true,
      cards: { y: false, yr: false, r: false },
    })),
    staff: (t.staff || []).map((s) => ({
      role: s.role, name: s.name, first: s.first, photo: s.photo || "", cards: { y: false, yr: false, r: false },
    })),
  };
}
function blankReport(game) {
  return {
    matchId: game.id,
    info: { nr: game.nr, date: game.date, time: game.time, court: game.court, bestOf: game.bestOf, round: game.round, category: game.category, group: game.group || "" },
    teamA: cloneTeam(game.teamA),
    teamB: cloneTeam(game.teamB),
    sets: Array.from({ length: game.bestOf }, () => ({ rallies: [] })),
    ballChoice: { set1: "", set5: "" },
    referees: { r1: "", r2: "", clerk: "", a1: "", a2: "" },
    remarks: "", responsible: "",
    signatures: { capA: false, capB: false, referee: false },
    status: "not_started",
    lockedBy: null,
  };
}

// Build a report-shaped object WITHOUT writing it — used to render a read-only
// súmula when no report doc exists (archived/imported events) OR when the viewer
// lacks member read access. Prefers the members-only game doc, but falls back to
// the PUBLIC results doc so any signed-in user can at least open the game.
export async function buildReportSeed(gameId) {
  let game = null;
  try {
    const gsnap = await getDoc(edoc("games", gameId));
    if (gsnap.exists()) game = { id: gameId, ...gsnap.data() };
  } catch (_) { /* members-only read denied — fall back to public results */ }
  if (!game) {
    try {
      const rsnap = await getDoc(edoc("results", gameId)); // public read
      if (rsnap.exists()) {
        const r = rsnap.data();
        game = {
          id: gameId, nr: r.nr, date: r.date, time: r.time, court: r.court,
          bestOf: r.bestOf || 3, round: r.round, category: r.category, group: r.group || "",
          teamA: r.teamA, teamB: r.teamB,
        };
      }
    } catch (_) { /* even the public read failed */ }
  }
  if (!game) return null;
  // results stores team names as strings; normalise to the {name,players,staff} shape.
  for (const side of ["teamA", "teamB"]) {
    if (typeof game[side] === "string") game[side] = { name: game[side], players: [], staff: [] };
  }
  // Enrich with rosters when the viewer can read them (members only) — best effort.
  for (const side of ["teamA", "teamB"]) {
    try {
      const r = await getRoster(game[side]?.name, game.category);
      if (r) game[side] = { ...game[side], players: r.players, staff: r.staff };
    } catch (_) { /* rosters are members-only */ }
  }
  return blankReport(game);
}

export async function ensureReport(gameId) {
  const ref = edoc("reports", gameId);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const gsnap = await getDoc(edoc("games", gameId));
  if (!gsnap.exists()) return;
  const game = { id: gameId, ...gsnap.data() };
  for (const side of ["teamA", "teamB"]) {
    const r = await getRoster(game[side]?.name, game.category);
    if (r) game[side] = { ...game[side], players: r.players, staff: r.staff };
  }
  try { await setDoc(ref, blankReport(game)); }
  catch (e) { console.warn("ensureReport (read-only?):", e?.code || e); }
}

export function subscribeReport(gameId, cb) {
  const eid = reqEid();
  return onSnapshot(edoc("reports", gameId),
    (d) => { if (eid === _eid) cb(d.exists() ? d.data() : null); },
    (err) => console.warn("report unavailable:", err?.code || err));
}

// Re-pull both line-ups from the roster registry.
export async function reloadReportRoster(gameId) {
  const ref = edoc("reports", gameId);
  const snap = await getDoc(ref);
  const rep = snap.data();
  if (!rep) return { updated: [], missing: [] };
  const patch = {};
  const updated = [], missing = [];
  for (const side of ["teamA", "teamB"]) {
    const name = rep[side]?.name;
    const r = await getRoster(name, rep.info?.category);
    if (r) { patch[side] = cloneTeam({ name, players: r.players, staff: r.staff }); updated.push(name); }
    else if (name) missing.push(name);
  }
  if (Object.keys(patch).length) await updateDoc(ref, patch);
  return { updated, missing };
}

/* ----------------- locking ----------------- */
export async function acquireLock(gameId, me) {
  const ref = edoc("reports", gameId);
  return runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    const lock = data.lockedBy;
    if (lock && lock.uid !== me.uid) return { ok: false, lockedBy: lock };
    tx.update(ref, {
      lockedBy: { uid: me.uid, name: me.name },
      lockedAt: serverTimestamp(),
      status: data.status === "submitted" ? "submitted" : "in_progress",
    });
    return { ok: true };
  });
}
export async function heartbeat(gameId, me) {
  const ref = edoc("reports", gameId);
  const snap = await getDoc(ref);
  if (snap.data()?.lockedBy?.uid === me.uid) await updateDoc(ref, { lockedAt: serverTimestamp() });
}
export async function releaseLock(gameId, me) {
  const ref = edoc("reports", gameId);
  const snap = await getDoc(ref);
  const data = snap.data();
  if (!data) return;
  if (data.lockedBy?.uid === me.uid && data.status !== "submitted") {
    await updateDoc(ref, { lockedBy: null, status: data.hasData ? "draft" : "not_started" });
  }
}
export async function adminUnlock(gameId) {
  await updateDoc(edoc("reports", gameId), { lockedBy: null });
}

/* ----------------- saving ----------------- */
export async function saveReport(gameId, me, patch) {
  await updateDoc(edoc("reports", gameId), {
    ...patch,
    status: "in_progress",
    hasData: true,
    updatedBy: { uid: me.uid, name: me.name },
    updatedAt: serverTimestamp(),
  });
  await publishResult(gameId);
}
export async function submitReport(gameId, me) {
  await updateDoc(edoc("reports", gameId), {
    status: "submitted",
    lockedBy: null,
    submittedBy: { uid: me.uid, name: me.name },
    submittedAt: serverTimestamp(),
  });
  await publishResult(gameId);
  try { const g = await getDoc(edoc("games", gameId)); await runAdvancement(g.data()?.category); } catch (_) { /* best effort */ }
}

// Auto-advancement: after a result lands, fill the placeholder slots of later
// knockout games — seeds from the QR ranking, and winners/losers of finished
// games — updating the game, its public result and (if present) its report.
export async function runAdvancement(category) {
  if (!category) return;
  try {
    const gsnap = await getDocs(ecol("games"));
    const games = gsnap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((g) => g.category === category);
    if (!games.length) return;
    const rsnap = await getDocs(ecol("results"));
    const resultsById = {};
    rsnap.forEach((d) => { const r = d.data(); if (r.category === category) resultsById[d.id] = r; });

    const qrTeams = new Set();
    games.filter((g) => g.round === "Qualification round").forEach((g) => {
      if (g.teamA?.name) qrTeams.add(g.teamA.name);
      if (g.teamB?.name) qrTeams.add(g.teamB.name);
    });
    const shaped = games.map((g) => ({
      id: g.id, category: g.category, phase: g.round === "Qualification round" ? "group" : "ko",
      round: g.round, teamA: g.teamA?.name, teamB: g.teamB?.name, srcA: g.srcA, srcB: g.srcB,
    }));
    const patches = resolveAdvancement(shaped, resultsById, qrTeams.size);

    for (const [gid, patch] of Object.entries(patches)) {
      const gameUpd = {}, resUpd = {}, repUpd = {};
      for (const side of ["teamA", "teamB"]) {
        const name = patch[side];
        if (!name) continue;
        const roster = await getRoster(name, category);
        gameUpd[side] = team(name);
        resUpd[side] = name;
        repUpd[side] = cloneTeam({ name, players: roster?.players || [], staff: roster?.staff || [] });
      }
      if (Object.keys(gameUpd).length) await updateDoc(edoc("games", gid), gameUpd);
      if (Object.keys(resUpd).length) await setDoc(edoc("results", gid), resUpd, { merge: true });
      const rep = await getDoc(edoc("reports", gid));
      if (rep.exists()) await updateDoc(edoc("reports", gid), repUpd);
    }
  } catch (e) { console.warn("runAdvancement failed:", e?.code || e); }
}

/* ----------------- publish to Fistball Live ----------------- */
// Disciplinary cards logged on a report, flattened for the public results doc.
// Fistball Live aggregates these (across all games) into its Cards tab.
function deriveCards(rep) {
  const out = [];
  const i = rep.info || {};
  for (const side of ["teamA", "teamB"]) {
    const t = rep[side];
    if (!t) continue;
    const push = (list, isStaff) => (list || []).forEach((p) => {
      const c = p.cards || {};
      if (!c.y && !c.yr && !c.r) return;
      out.push({
        team: t.name || "", category: i.category || "",
        nr: isStaff ? "" : (p.nr || ""), name: p.name || "", first: p.first || "",
        role: isStaff ? (p.role || "Staff") : "",
        y: c.y ? 1 : 0, yr: c.yr ? 1 : 0, r: c.r ? 1 : 0,
      });
    });
    push(t.players, false);
    push(t.staff, true);
  }
  return out;
}
function deriveResult(rep) {
  const sets = [];
  let setsA = 0, setsB = 0, pointsA = 0, pointsB = 0;
  for (const s of rep.sets || []) {
    const r = s.rallies || [];
    if (!r.length) continue;
    const a = r.filter((x) => x === "A").length;
    const b = r.filter((x) => x === "B").length;
    sets.push({ a, b });   // objects, not [a,b] — Firestore rejects nested arrays
    pointsA += a; pointsB += b;
    if (a > b) setsA++; else if (b > a) setsB++;
  }
  let status = "Not Started";
  if (rep.status === "submitted") status = "Finished";
  else if (sets.length) status = "In progress";
  const i = rep.info || {};
  return {
    nr: i.nr, date: i.date, time: i.time, court: i.court,
    round: i.round, category: i.category, group: i.group || "", bestOf: i.bestOf,
    teamA: rep.teamA?.name || "", teamB: rep.teamB?.name || "",
    setsA, setsB, pointsA, pointsB, sets, status,
    cards: deriveCards(rep),
    updatedAt: serverTimestamp(),
  };
}
export async function publishResult(gameId) {
  try {
    const snap = await getDoc(edoc("reports", gameId));
    if (!snap.exists()) return;
    await setDoc(edoc("results", gameId), deriveResult(snap.data()));
  } catch (e) {
    console.warn("publishResult failed:", e);
  }
}
