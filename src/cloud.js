import {
  collection, doc, getDoc, getDocs, setDoc, onSnapshot, runTransaction,
  serverTimestamp, updateDoc, deleteField,
} from "firebase/firestore";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";
import { db, auth, googleProvider } from "./firebase.js";
import { SEED_MATCHES } from "./seed.js";

/* ----------------- identity (Google login) ----------------- */
// Organizers who can force-unlock reports. Per-event membership/roles come later;
// for now any signed-in Google user can score, and these emails are admins.
const ORG_ADMINS = ["claudio.englert@gmail.com"];

// Map a Firebase auth user to our app "me" shape (null when signed out).
function toMe(user) {
  if (!user) return null;
  const email = (user.email || "").toLowerCase();
  return {
    uid: user.uid,
    name: user.displayName || email || "User",
    email,
    admin: ORG_ADMINS.includes(email),
  };
}

// Subscribe to sign-in state. cb receives `me` (or null). Returns unsubscribe.
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
  await publishResult(gameId);
}

export async function submitReport(gameId, me) {
  await updateDoc(doc(db, "reports", gameId), {
    status: "submitted",
    lockedBy: null,
    submittedBy: { uid: me.uid, name: me.name },
    submittedAt: serverTimestamp(),
  });
  await publishResult(gameId);
}

/* ----------------- publish to Fistball Live -----------------
 * A public, minimal scoreboard projection of each report, written to the
 * `results` collection (public read). The Fistball Live spectator app reads
 * this directly, so the database — not the sheet — is the source of truth. */
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
    const snap = await getDoc(doc(db, "reports", gameId));
    if (!snap.exists()) return;
    await setDoc(doc(db, "results", gameId), deriveResult(snap.data()));
  } catch (e) {
    // Never let publishing break the save/submit; log for diagnostics.
    console.warn("publishResult failed:", e);
  }
}
