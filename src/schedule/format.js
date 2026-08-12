// Championship format templates keyed by team count. Each category plays a
// SINGLE round-robin group (Qualification Round); the knockout is seeded by the
// final group ranking (1st, 2nd, …). Best of 3 sets throughout.
//
// Each knockout slot also carries a structured source (src) so results can
// auto-advance teams into later phases:
//   { type:"seed",   rank:N }        -> the Nth-ranked team of the QR group
//   { type:"winner", dep:"ko:sf1" }  -> winner of another fixture (local id)
//   { type:"loser",  dep:"ko:sf1" }  -> loser of another fixture
//
// buildFormat(teams, { category, bestOf }) -> { fixtures, warnings } | null

import { roundRobin } from "./roundRobin.js";

const ORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
export const seed = (n) => ORD[n] || `${n}th`;

const S = (n) => ({ label: seed(n), src: { type: "seed", rank: n } });
const W = (ref, label) => ({ label: label || `Winner ${ref.toUpperCase()}`, src: { type: "winner", dep: `ko:${ref}` } });
const L = (ref, label) => ({ label: label || `Loser ${ref.toUpperCase()}`, src: { type: "loser", dep: `ko:${ref}` } });

const KO = {
  3: () => [
    { id: "final", stage: "final", idx: 0, round: "Gold medal match", a: S(1), b: S(2) },
  ],
  5: () => [
    { id: "pi",  stage: "qf", idx: 0, round: "Play-off",  a: S(4), b: S(5) },
    { id: "sf1", stage: "sf", idx: 0, round: "Semifinal", a: S(1), b: W("pi", "Winner 4th-5th"), deps: ["pi"] },
    { id: "sf2", stage: "sf", idx: 1, round: "Semifinal", a: S(2), b: S(3) },
    { id: "final", stage: "final", idx: 0, round: "Gold medal match", a: W("sf1"), b: W("sf2"), deps: ["sf1", "sf2"] },
    { id: "p35a", stage: "bronze", idx: 0, round: "Placement 3-5", a: L("sf1"), b: L("sf2"), deps: ["sf1", "sf2"] },
    { id: "p35b", stage: "bronze", idx: 1, round: "Placement 3-5", a: L("sf1"), b: L("pi", "Loser 4th-5th"), deps: ["sf1", "pi"] },
    { id: "p35c", stage: "bronze", idx: 2, round: "Placement 3-5", a: L("sf2"), b: L("pi", "Loser 4th-5th"), deps: ["sf2", "pi"] },
  ],
  8: () => [
    { id: "qf1", stage: "qf", idx: 0, round: "Quarterfinal", a: S(3), b: S(6) },
    { id: "qf2", stage: "qf", idx: 1, round: "Quarterfinal", a: S(4), b: S(5) },
    { id: "p7",  stage: "qf", idx: 2, round: "Placement 7-8", a: S(7), b: S(8) },
    { id: "sf1", stage: "sf", idx: 0, round: "Semifinal", a: S(1), b: W("qf2"), deps: ["qf2"] },
    { id: "sf2", stage: "sf", idx: 1, round: "Semifinal", a: S(2), b: W("qf1"), deps: ["qf1"] },
    { id: "final",  stage: "final",  idx: 0, round: "Gold medal match",   a: W("sf1"), b: W("sf2"), deps: ["sf1", "sf2"] },
    { id: "bronze", stage: "bronze", idx: 0, round: "Bronze medal match", a: L("sf1"), b: L("sf2"), deps: ["sf1", "sf2"] },
  ],
};

export function hasFormat(teamCount) { return !!KO[teamCount]; }

// Human-readable summary of the preset for a team count (for the Format editor).
export function describeFormat(teamCount) {
  if (!KO[teamCount]) return null;
  const qrGames = (teamCount * (teamCount - 1)) / 2;
  const ko = KO[teamCount]();
  const rounds = [];
  for (const m of ko) {
    let r = rounds.find((x) => x.round === m.round);
    if (!r) { r = { round: m.round, matches: [] }; rounds.push(r); }
    r.matches.push(`${m.a.label} × ${m.b.label}`);
  }
  return { teamCount, qrGames, rounds, total: qrGames + ko.length };
}

// buildFormat: QR (single group round-robin) + seeded knockout, as fixtures.
export function buildFormat(teams, { category, bestOf = 3 } = {}) {
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

  for (const m of KO[n]()) {
    fixtures.push({
      id: `ko:${m.id}`, category, bestOf,
      round: m.round, phase: "ko", koStage: m.stage, koIndex: m.idx, seq: seq++,
      teamA: m.a.label, teamB: m.b.label, srcA: m.a.src, srcB: m.b.src,
      deps: (m.deps || []).map((d) => `ko:${d}`),
    });
  }

  return { fixtures, warnings: [] };
}
