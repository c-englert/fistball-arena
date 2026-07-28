// Knockout bracket templating from group qualifiers.
// Produces fixtures with placeholder team names (real teams unknown at
// generation time) whose round strings and labels match what the Fistball Live
// viewer expects:
//   round strings contain "Quarterfinal" / "Semifinal" / "Bronze medal" / "Gold medal"
//   placeholder names contain a digit or "Winner"/"Loser" (excluded from standings)

const ORD = ["0th", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th"];
const ordinal = (n) => ORD[n] || `${n}th`;
const seedLabel = (groupLabel, pos) => `${ordinal(pos)} Group ${groupLabel}`;

const ROUND = {
  qf: "Quarterfinal",
  sf: "Semifinal",
  bronze: "Bronze medal match",
  final: "Gold medal match",
};

// First-round pairings (seed labels) from N groups × Q qualifiers.
// Q=2 pairs adjacent groups so same-group teams can only meet in the final.
// Q=1 seeds group winners with standard high-vs-low bracket pairing.
function firstRoundPairings(groups, Q) {
  const G = groups.length;
  if (Q === 1) {
    const W = groups.map((g) => seedLabel(g.label, 1));
    const pairs = [];
    for (let i = 0; i < Math.floor(G / 2); i++) pairs.push([W[i], W[G - 1 - i]]);
    return pairs;
  }
  if (Q === 2) {
    const pairs = [];
    for (let i = 0; i + 1 < G; i += 2) {
      const a = groups[i], b = groups[i + 1];
      pairs.push([seedLabel(a.label, 1), seedLabel(b.label, 2)]);
      pairs.push([seedLabel(b.label, 1), seedLabel(a.label, 2)]);
    }
    return pairs;
  }
  return null;
}

// buildBracket(groups, Q, opts) -> { fixtures, warnings }
// opts: { category, bestOf, knockout }
export function buildBracket(groups, Q, opts) {
  const { category, bestOf, knockout } = opts;
  const warnings = [];
  if (!knockout) return { fixtures: [], warnings };

  const mk = (id, koStage, koIndex, teamA, teamB, deps = []) => ({
    id, category, bestOf, round: ROUND[koStage],
    phase: "ko", koStage, koIndex, teamA, teamB, deps,
  });

  // Single group → placement final (1st vs 2nd) + optional bronze (3rd vs 4th).
  if (groups.length === 1) {
    const g = groups[0];
    const fx = [mk("final", "final", 1, seedLabel(g.label, 1), seedLabel(g.label, 2))];
    if ((g.teams || []).length >= 4) {
      fx.unshift(mk("bronze", "bronze", 1, seedLabel(g.label, 3), seedLabel(g.label, 4)));
    }
    return { fixtures: fx, warnings };
  }

  const pairs = firstRoundPairings(groups, Q);
  if (!pairs) {
    warnings.push(`${category}: knockout auto-bracket supports 1 or 2 qualifiers per group only.`);
    return { fixtures: [], warnings };
  }
  if (groups.length % 2 === 1 && Q === 2) {
    warnings.push(`${category}: ${groups.length} groups with 2 qualifiers doesn't pair evenly — bracket omits the unpaired group. Use an even number of groups or 1 qualifier.`);
  }

  const n = pairs.length; // first-round matches
  const fixtures = [];

  if (n === 1) {
    // e.g. 2 groups × 1 → straight final
    fixtures.push(mk("final", "final", 1, pairs[0][0], pairs[0][1]));
  } else if (n === 2) {
    // SF + Final + Bronze
    fixtures.push(mk("sf1", "sf", 1, pairs[0][0], pairs[0][1]));
    fixtures.push(mk("sf2", "sf", 2, pairs[1][0], pairs[1][1]));
    fixtures.push(mk("bronze", "bronze", 1, "Loser SF1", "Loser SF2", ["sf1", "sf2"]));
    fixtures.push(mk("final", "final", 1, "Winner SF1", "Winner SF2", ["sf1", "sf2"]));
  } else if (n === 4) {
    // QF + SF + Final + Bronze
    for (let i = 0; i < 4; i++) fixtures.push(mk(`qf${i + 1}`, "qf", i + 1, pairs[i][0], pairs[i][1]));
    fixtures.push(mk("sf1", "sf", 1, "Winner QF1", "Winner QF2", ["qf1", "qf2"]));
    fixtures.push(mk("sf2", "sf", 2, "Winner QF3", "Winner QF4", ["qf3", "qf4"]));
    fixtures.push(mk("bronze", "bronze", 1, "Loser SF1", "Loser SF2", ["sf1", "sf2"]));
    fixtures.push(mk("final", "final", 1, "Winner SF1", "Winner SF2", ["sf1", "sf2"]));
  } else {
    warnings.push(`${category}: ${n * Q > 8 ? "more than 8 qualifiers" : "this group/qualifier count"} isn't supported by the auto-bracket (max quarterfinals). Group stage still generated.`);
  }

  return { fixtures, warnings };
}
