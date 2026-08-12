// Championship format templates keyed by team count. Each category plays a
// SINGLE round-robin group (Qualification Round); the knockout is seeded by the
// final group ranking (1st, 2nd, …). Placeholder names ("1st", "Winner SF1")
// resolve as results come in. Best of 3 sets throughout, per the championship.
//
// buildFormat(teams, { category, bestOf }) -> { fixtures, warnings } | null
// Returns null when there is no template for that team count (caller falls back).

const ORD = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th", "10th", "11th", "12th"];
export const seed = (n) => ORD[n] || `${n}th`;

// All round-robin pairings over a list (single group, everyone vs everyone).
function roundRobin(items) {
  const pairs = [];
  for (let i = 0; i < items.length; i++)
    for (let j = i + 1; j < items.length; j++) pairs.push([items[i], items[j]]);
  return pairs;
}

// Knockout templates: match descriptors with seed/label refs and deps (by id).
// a/b are placeholder labels; deps list the match ids they depend on.
const KO = {
  3: () => [
    { id: "final", round: "Gold medal match", a: seed(1), b: seed(2) },
  ],
  5: () => [
    { id: "pi",  round: "Play-off",         a: seed(4), b: seed(5) },
    { id: "sf1", round: "Semifinal",        a: seed(1), b: "Winner 4th-5th", deps: ["pi"] },
    { id: "sf2", round: "Semifinal",        a: seed(2), b: seed(3) },
    { id: "final", round: "Gold medal match", a: "Winner SF1", b: "Winner SF2", deps: ["sf1", "sf2"] },
    // P3 triangular: losers of SF1, SF2 and the play-off (5th).
    { id: "p35a", round: "Placement 3-5", a: "Loser SF1", b: "Loser SF2",    deps: ["sf1", "sf2"] },
    { id: "p35b", round: "Placement 3-5", a: "Loser SF1", b: "Loser 4th-5th", deps: ["sf1", "pi"] },
    { id: "p35c", round: "Placement 3-5", a: "Loser SF2", b: "Loser 4th-5th", deps: ["sf2", "pi"] },
  ],
  8: () => [
    { id: "qf1", round: "Quarterfinal", a: seed(3), b: seed(6) },
    { id: "qf2", round: "Quarterfinal", a: seed(4), b: seed(5) },
    { id: "p7",  round: "Placement 7-8", a: seed(7), b: seed(8) },
    { id: "sf1", round: "Semifinal",    a: seed(1), b: "Winner QF2", deps: ["qf2"] },
    { id: "sf2", round: "Semifinal",    a: seed(2), b: "Winner QF1", deps: ["qf1"] },
    { id: "final",  round: "Gold medal match",   a: "Winner SF1", b: "Winner SF2", deps: ["sf1", "sf2"] },
    { id: "bronze", round: "Bronze medal match", a: "Loser SF1",  b: "Loser SF2",  deps: ["sf1", "sf2"] },
  ],
};

export function hasFormat(teamCount) { return !!KO[teamCount]; }

// Human-readable summary of the preset for a team count (for the Format editor).
export function describeFormat(teamCount) {
  if (!KO[teamCount]) return null;
  const qrGames = (teamCount * (teamCount - 1)) / 2;
  const ko = KO[teamCount]();
  // group knockout matches by round, preserving order
  const rounds = [];
  for (const m of ko) {
    let r = rounds.find((x) => x.round === m.round);
    if (!r) { r = { round: m.round, matches: [] }; rounds.push(r); }
    r.matches.push(`${m.a} × ${m.b}`);
  }
  return { teamCount, qrGames, rounds, total: qrGames + ko.length };
}

export function buildFormat(teams, { category, bestOf = 3 } = {}) {
  const real = (teams || []).filter(Boolean);
  const n = real.length;
  if (!KO[n]) return null;

  const fixtures = [];
  let seq = 0;

  // Qualification Round: single group, full round-robin.
  roundRobin(real).forEach(([a, b], i) => {
    fixtures.push({
      id: `qr:${i}`, category, bestOf, group: "", round: "Qualification Round",
      phase: "group", groupRoundIndex: 0, seq: seq++, teamA: a, teamB: b, deps: [],
    });
  });

  // Knockout / placement, seeded by the QR ranking.
  for (const m of KO[n]()) {
    fixtures.push({
      id: `ko:${m.id}`, category, bestOf,
      round: m.round, phase: "ko", koStage: m.id, koIndex: 0, seq: seq++,
      teamA: m.a, teamB: m.b, deps: (m.deps || []).map((d) => `ko:${d}`),
    });
  }

  return { fixtures, warnings: [] };
}
