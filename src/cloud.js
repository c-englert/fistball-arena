import {
  collection, collectionGroup, doc, getDoc, getDocs, setDoc, onSnapshot,
  runTransaction, serverTimestamp, updateDoc, writeBatch, deleteDoc, query, where,
} from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { db, auth, googleProvider } from "./firebase.js";

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
    status: "active",
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
        bestOf: g.bestOf, round: g.round, category: g.category,
        teamA: g.teamA, teamB: g.teamB,
      });
      // Public results row so the spectator Live sees the whole fixture upfront.
      batch.set(edoc("results", id), {
        nr: g.nr, date: g.date, time: g.time, court: g.court,
        round: g.round, category: g.category, bestOf: g.bestOf,
        teamA: g.teamA.name, teamB: g.teamB.name,
        setsA: 0, setsB: 0, pointsA: 0, pointsB: 0, sets: [], status: "Not Started",
        updatedAt: serverTimestamp(),
      });
    });
    await batch.commit();
  }
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
async function getRoster(teamName) {
  if (!teamName) return null;
  const s = await getDoc(edoc("rosters", teamName));
  return s.exists() ? s.data() : null;
}
export async function fetchTeamRosters(names) {
  const out = {};
  for (const name of [...new Set(names)]) {
    const r = await getRoster(name);
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
    info: { nr: game.nr, date: game.date, time: game.time, court: game.court, bestOf: game.bestOf, round: game.round, category: game.category },
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

export async function ensureReport(gameId) {
  const ref = edoc("reports", gameId);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const gsnap = await getDoc(edoc("games", gameId));
  if (!gsnap.exists()) return;
  const game = { id: gameId, ...gsnap.data() };
  for (const side of ["teamA", "teamB"]) {
    const r = await getRoster(game[side]?.name);
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
    const r = await getRoster(name);
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
}

/* ----------------- publish to Fistball Live ----------------- */
function deriveResult(rep) {
  const sets = [];
  let setsA = 0, setsB = 0, pointsA = 0, pointsB = 0;
  for (const s of rep.sets || []) {
    const r = s.rallies || [];
    if (!r.length) continue;
    const a = r.filter((x) => x === "A").length;
    const b = r.filter((x) => x === "B").length;
    sets.push([a, b]);
    pointsA += a; pointsB += b;
    if (a > b) setsA++; else if (b > a) setsB++;
  }
  let status = "Not Started";
  if (rep.status === "submitted") status = "Finished";
  else if (sets.length) status = "In progress";
  const i = rep.info || {};
  return {
    nr: i.nr, date: i.date, time: i.time, court: i.court,
    round: i.round, category: i.category, bestOf: i.bestOf,
    teamA: rep.teamA?.name || "", teamB: rep.teamB?.name || "",
    setsA, setsB, pointsA, pointsB, sets, status,
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
