// Championship format templates keyed by team count. Each category plays a
// SINGLE round-robin group (Qualification Round); the knockout is seeded by the
// final group ranking. Every knockout slot carries a structured source (src):
//   { type:"seed",   rank:N }        -> the Nth-ranked team of the QR group
//   { type:"winner", dep:"ko:sf1" }  -> winner of another fixture
//   { type:"loser",  dep:"ko:sf1" }  -> loser of another fixture
//
// A per-category `override` (map of matchId -> { a?:src, b?:src }) lets an admin
// change which variable feeds a slot; presets are the default. buildFormat and
// describeFormat both honour the override.

import { roundRobin } from "./roundRobin.js";

const ORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
export const seed = (n) => ORD[n] || `${n}th`;

// Full, unambiguous names for each match id (used in slot labels so it's clear
// which semifinal/quarterfinal a winner/loser comes from).
const NAME = {
  pi: "Quarterfinal", qf1: "Quarterfinal 1", qf2: "Quarterfinal 2", p7: "Placement 7-8",
  sf1: "Semifinal 1", sf2: "Semifinal 2", final: "Final", bronze: "Bronze",
  p35a: "Placement 3-5", p35b: "Placement 3-5", p35c: "Placement 3-5",
};
const nameOf = (ref) => NAME[String(ref).replace("ko:", "")] || String(ref).replace("ko:", "").toUpperCase();

const S = (n) => ({ label: seed(n), src: { type: "seed", rank: n } });
const W = (ref, label) => ({ label: label || `Winner ${nameOf(ref)}`, src: { type: "winner", dep: `ko:${ref}` } });
const L = (ref, label) => ({ label: label || `Loser ${nameOf(ref)}`, src: { type: "loser", dep: `ko:${ref}` } });

const KO = {
  3: () => [
    { id: "final", stage: "final", idx: 0, round: "Gold medal match", a: S(1), b: S(2) },
  ],
  5: () => [
    { id: "pi",  stage: "qf", idx: 0, round: "Quarterfinal", a: S(4), b: S(5) },
    { id: "sf1", stage: "sf", idx: 0, round: "Semifinal 1", a: S(1), b: W("pi") },
    { id: "sf2", stage: "sf", idx: 1, round: "Semifinal 2", a: S(2), b: S(3) },
    { id: "final", stage: "final", idx: 0, round: "Gold medal match", a: W("sf1"), b: W("sf2") },
    { id: "p35a", stage: "bronze", idx: 0, round: "Placement 3-5", a: L("sf1"), b: L("sf2") },
    { id: "p35b", stage: "bronze", idx: 1, round: "Placement 3-5", a: L("sf1"), b: L("pi") },
    { id: "p35c", stage: "bronze", idx: 2, round: "Placement 3-5", a: L("sf2"), b: L("pi") },
  ],
  8: () => [
    { id: "qf1", stage: "qf", idx: 0, round: "Quarterfinal 1", a: S(3), b: S(6) },
    { id: "qf2", stage: "qf", idx: 1, round: "Quarterfinal 2", a: S(4), b: S(5) },
    { id: "p7",  stage: "qf", idx: 2, round: "Placement 7-8", a: S(7), b: S(8) },
    { id: "sf1", stage: "sf", idx: 0, round: "Semifinal 1", a: S(1), b: W("qf2") },
    { id: "sf2", stage: "sf", idx: 1, round: "Semifinal 2", a: S(2), b: W("qf1") },
    { id: "final",  stage: "final",  idx: 0, round: "Gold medal match",   a: W("sf1"), b: W("sf2") },
    { id: "bronze", stage: "bronze", idx: 0, round: "Bronze medal match", a: L("sf1"), b: L("sf2") },
  ],
};

export function hasFormat(teamCount) { return !!KO[teamCount]; }

function labelOf(src) {
  if (!src) return "?";
  if (src.type === "seed") return seed(src.rank);
  return `${src.type === "winner" ? "Winner" : "Loser"} ${nameOf(src.dep)}`;
}

// Rounds offered when adding a custom match.
export const ROUND_OPTIONS = ["Quarterfinal 1", "Quarterfinal 2", "Semifinal 1", "Semifinal 2", "Placement 5-6", "Placement 7-8", "Placement 3-5", "Bronze medal match", "Gold medal match"];
const STAGE_OF = (round) => /gold/i.test(round) ? "final" : /semi/i.test(round) ? "sf" : /quarter|play-off/i.test(round) ? "qf" : "bronze";

// Override may be a legacy flat map (matchId -> {a,b}) or the richer shape
// { edits:{matchId:{a,b}}, removed:[matchId], added:[{id,round,a,b}] }.
export function normalizeOverride(ov) {
  if (!ov) return { edits: {}, removed: [], added: [] };
  if (ov.edits || ov.removed || ov.added) return { edits: ov.edits || {}, removed: ov.removed || [], added: ov.added || [] };
  return { edits: ov, removed: [], added: [] };
}
function mk(id, stage, idx, round, a, b, added) {
  const deps = [a.src, b.src].filter((s) => s && s.type !== "seed").map((s) => s.dep);
  return { id, stage, idx, round, a, b, deps, added: !!added };
}

// Merge preset knockout with a per-category override (edits + removed + added).
export function koFor(teamCount, override) {
  const ov = normalizeOverride(override);
  const base = (KO[teamCount] ? KO[teamCount]() : [])
    .filter((m) => !ov.removed.includes(m.id))
    .map((m) => {
      const o = ov.edits[m.id] || {};
      const a = o.a ? { src: o.a, label: labelOf(o.a) } : { src: m.a.src, label: m.a.label };
      const b = o.b ? { src: o.b, label: labelOf(o.b) } : { src: m.b.src, label: m.b.label };
      return mk(m.id, m.stage, m.idx, m.round, a, b, false);
    });
  const added = (ov.added || []).map((m, i) =>
    mk(m.id, STAGE_OF(m.round || ""), 20 + i, m.round || "Placement", { src: m.a, label: labelOf(m.a) }, { src: m.b, label: labelOf(m.b) }, true));
  return [...base, ...added];
}

// Options for a slot: every seed, plus winner/loser of any preset match that
// comes earlier (added matches, which run last, may reference any preset match).
export function slotOptions(teamCount, matchId, override) {
  const base = KO[teamCount] ? KO[teamCount]() : [];
  const ov = normalizeOverride(override);
  const idx = base.findIndex((m) => m.id === matchId); // -1 for an added match
  const opts = [];
  for (let r = 1; r <= teamCount; r++) opts.push({ value: `seed:${r}`, label: `${seed(r)} place` });
  base.forEach((m, i) => {
    if (ov.removed.includes(m.id)) return;
    if (idx === -1 || i < idx) {
      opts.push({ value: `winner:ko:${m.id}`, label: `Winner · ${m.round}` });
      opts.push({ value: `loser:ko:${m.id}`, label: `Loser · ${m.round}` });
    }
  });
  return opts;
}
export function parseSlot(value) {
  if (value.startsWith("seed:")) return { type: "seed", rank: Number(value.slice(5)) };
  if (value.startsWith("winner:")) return { type: "winner", dep: value.slice(7) };
  if (value.startsWith("loser:")) return { type: "loser", dep: value.slice(6) };
  return null;
}
export function slotValue(src) {
  if (!src) return "";
  if (src.type === "seed") return `seed:${src.rank}`;
  return `${src.type}:${src.dep}`;
}

// Human-readable summary of the format for a team count (respecting override).
export function describeFormat(teamCount, override) {
  if (!KO[teamCount]) return null;
  const qrGames = (teamCount * (teamCount - 1)) / 2;
  const ko = koFor(teamCount, override);
  const rounds = [];
  for (const m of ko) {
    let r = rounds.find((x) => x.round === m.round);
    if (!r) { r = { round: m.round, matches: [] }; rounds.push(r); }
    r.matches.push(`${m.a.label} × ${m.b.label}`);
  }
  return { teamCount, qrGames, rounds, total: qrGames + ko.length };
}

// The editable knockout matches (id/round + current a/b) for the modal editor.
export function formatMatches(teamCount, override) { return koFor(teamCount, override); }

// Warn when a slot references a match that no longer exists (removed), so its
// placeholder would never resolve.
export function formatWarnings(teamCount, override) {
  const ko = koFor(teamCount, override);
  const ids = new Set(ko.map((m) => `ko:${m.id}`));
  const out = [];
  for (const m of ko) {
    for (const s of [m.a.src, m.b.src]) {
      if (s && s.type !== "seed" && !ids.has(s.dep)) out.push(`${m.round}: “${labelOf(s)}” — that match was removed.`);
    }
  }
  return out;
}

// buildFormat: QR (single group round-robin) + seeded knockout, as fixtures.
export function buildFormat(teams, { category, bestOf = 3, override } = {}) {
  const real = (teams || []).filter(Boolean);
  const n = real.length;
  if (!KO[n]) return null;

  const fixtures = [];
  let seq = 0;

  roundRobin(real, false).forEach((round, ri) => {
    round.forEach(([a, b], i) => {
      fixtures.push({
        id: `qr:${ri}:${i}`, category, bestOf, group: "", round: "Qualification round",
        phase: "group", groupRoundIndex: ri, seq: seq++, teamA: a, teamB: b, deps: [],
      });
    });
  });

  for (const m of koFor(n, override)) {
    fixtures.push({
      id: `ko:${m.id}`, category, bestOf,
      round: m.round, phase: "ko", koStage: m.stage, koIndex: m.idx, seq: seq++,
      teamA: m.a.label, teamB: m.b.label, srcA: m.a.src, srcB: m.b.src, deps: m.deps,
    });
  }

  return { fixtures, warnings: [] };
}
