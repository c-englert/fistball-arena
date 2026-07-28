import {
  collection, doc, getDoc, getDocs, setDoc, onSnapshot, runTransaction,
  serverTimestamp, updateDoc, deleteField,
} from "firebase/firestore";
import { db } from "./firebase.js";
import { SEED_MATCHES } from "./seed.js";

/* ----------------- identity (temporary, pre-Google login) ----------------- */
// Real Google auth + allow-list + roles arrive with the tournament's Firebase
// config. For now the "user" is a name + a device id + a dev admin flag.
export function getMe() {
  let me = null;
  try { me = JSON.parse(localStorage.getItem("fb_me") || "null"); } catch (_) {}
  return me;
}
export function setMe(name, admin) {
  const uid = getMe()?.uid || "u_" + Math.random().toString(36).slice(2, 10);
  const me = { uid, name: name.trim(), admin: !!admin };
  localStorage.setItem("fb_me", JSON.stringify(me));
  return me;
}

/* ----------------- games (seeded from the schedule) ----------------- */
export async function ensureGames() {
  const snap = await getDocs(collection(db, "games"));
  if (!snap.empty) return;
  await Promise.all(
    SEED_MATCHES.map((m) =>
      setDoc(doc(db, "games", m.id), {
        nr: m.nr, date: m.date, time: m.time, court: m.court,
        bestOf: m.bestOf, round: m.round, category: m.category,
        teamA: m.teamA, teamB: m.teamB,
      })
    )
  );
}

export function subscribeGames(cb) {
  return onSnapshot(collection(db, "games"), (snap) =>
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
  );
}

// Live status/lock of every report (for the list badges).
export function subscribeReports(cb) {
  return onSnapshot(collection(db, "reports"), (snap) => {
    const map = {};
    snap.forEach((d) => {
      const r = d.data();
      map[d.id] = { status: r.status || "not_started", lockedBy: r.lockedBy || null };
    });
    cb(map);
  });
}

/* ----------------- one report (súmula) ----------------- */
function cloneTeam(t) {
  return {
    name: t.name,
    players: (t.players || []).map((p) => ({
      nr: p.nr, name: p.name, first: p.first, captain: !!p.captain, onCourt: true,
      cards: { y: false, yr: false, r: false },
    })),
    staff: (t.staff || []).map((s) => ({
      role: s.role, name: s.name, first: s.first, cards: { y: false, yr: false, r: false },
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
  const ref = doc(db, "reports", gameId);
  const snap = await getDoc(ref);
  if (snap.exists()) return;
  const gsnap = await getDoc(doc(db, "games", gameId));
  if (!gsnap.exists()) return;
  await setDoc(ref, blankReport({ id: gameId, ...gsnap.data() }));
}

export function subscribeReport(gameId, cb) {
  return onSnapshot(doc(db, "reports", gameId), (d) => cb(d.exists() ? d.data() : null));
}

/* ----------------- locking ----------------- */
// Acquire the lock for the current user. Returns { ok:true } or { ok:false, lockedBy }.
export async function acquireLock(gameId, me) {
  const ref = doc(db, "reports", gameId);
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
  const ref = doc(db, "reports", gameId);
  const snap = await getDoc(ref);
  if (snap.data()?.lockedBy?.uid === me.uid) {
    await updateDoc(ref, { lockedAt: serverTimestamp() });
  }
}

// Release the lock (only if I hold it).
export async function releaseLock(gameId, me) {
  const ref = doc(db, "reports", gameId);
  const snap = await getDoc(ref);
  const data = snap.data();
  if (!data) return;
  if (data.lockedBy?.uid === me.uid && data.status !== "submitted") {
    await updateDoc(ref, { lockedBy: null, status: data.hasData ? "draft" : "not_started" });
  }
}

// Admin force-unlock (any holder).
export async function adminUnlock(gameId) {
  await updateDoc(doc(db, "reports", gameId), { lockedBy: null });
}

/* ----------------- saving ----------------- */
export async function saveReport(gameId, me, patch) {
  await updateDoc(doc(db, "reports", gameId), {
    ...patch,
    status: "in_progress",
    hasData: true,
    updatedBy: { uid: me.uid, name: me.name },
    updatedAt: serverTimestamp(),
  });
}

export async function submitReport(gameId, me) {
  await updateDoc(doc(db, "reports", gameId), {
    status: "submitted",
    lockedBy: null,
    submittedBy: { uid: me.uid, name: me.name },
    submittedAt: serverTimestamp(),
  });
}
