// Championship format templates keyed by team count. Each category plays a
// SINGLE round-robin group (Qualification Round); the knockout is seeded by the
// final group ranking (1st, 2nd, …). Placeholder names ("1st", "Winner SF1")
// resolve as results come in. Best of 3 sets throughout, per the championship.
//
// buildFormat(teams, { category, bestOf }) -> { fixtures, warnings } | null
// Returns null when there is no template for that team count (caller falls back).

import { roundRobin } from "./roundRobin.js";

const ORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
export const seed = (n) => ORD[n] || `${n}th`;

// Knockout templates: each match has a bucket `stage` (qf<sf<bronze<final, used
// to order/space the KO) plus `idx`, the display `round`, the two placeholder
// refs and the match ids it depends on.
const KO = {
  3: () => [
    { id: "final", stage: "final", idx: 0, round: "Gold medal match", a: seed(1), b: seed(2) },
  ],
  5: () => [
    { id: "pi",  stage: "qf", idx: 0, round: "Play-off",  a: seed(4), b: seed(5) },
    { id: "sf1", stage: "sf", idx: 0, round: "Semifinal", a: seed(1), b: "Winner 4th-5th", deps: ["pi"] },
    { id: "sf2", stage: "sf", idx: 1, round: "Semifinal", a: seed(2), b: seed(3) },
    { id: "final", stage: "final", idx: 0, round: "Gold medal match", a: "Winner SF1", b: "Winner SF2", deps: ["sf1", "sf2"] },
    // P3 triangular: losers of SF1, SF2 and the play-off (5th).
    { id: "p35a", stage: "bronze", idx: 0, round: "Placement 3-5", a: "Loser SF1", b: "Loser SF2",     deps: ["sf1", "sf2"] },
    { id: "p35b", stage: "bronze", idx: 1, round: "Placement 3-5", a: "Loser SF1", b: "Loser 4th-5th", deps: ["sf1", "pi"] },
    { id: "p35c", stage: "bronze", idx: 2, round: "Placement 3-5", a: "Loser SF2", b: "Loser 4th-5th", deps: ["sf2", "pi"] },
  ],
  8: () => [
    { id: "qf1", stage: "qf", idx: 0, round: "Quarterfinal", a: seed(3), b: seed(6) },
    { id: "qf2", stage: "qf", idx: 1, round: "Quarterfinal", a: seed(4), b: seed(5) },
    { id: "p7",  stage: "qf", idx: 2, round: "Placement 7-8", a: seed(7), b: seed(8) },
    { id: "sf1", stage: "sf", idx: 0, round: "Semifinal", a: seed(1), b: "Winner QF2", deps: ["qf2"] },
    { id: "sf2", stage: "sf", idx: 1, round: "Semifinal", a: seed(2), b: "Winner QF1", deps: ["qf1"] },
    { id: "final",  stage: "final",  idx: 0, round: "Gold medal match",   a: "Winner SF1", b: "Winner SF2", deps: ["sf1", "sf2"] },
    { id: "bronze", stage: "bronze", idx: 0, round: "Bronze medal match", a: "Loser SF1",  b: "Loser SF2",  deps: ["sf1", "sf2"] },
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
    r.matches.push(`${m.a} × ${m.b}`);
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
      teamA: m.a, teamB: m.b, deps: (m.deps || []).map((d) => `ko:${d}`),
    });
  }

  return { fixtures, warnings: [] };
}
