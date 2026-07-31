// Orchestrates the schedule generator: round-robin group fixtures + knockout
// bracket → automatic slot allocation → Firestore game docs.

import { roundRobin } from "./roundRobin.js";
import { buildBracket } from "./bracket.js";
import { allocate } from "./scheduler.js";
import { team } from "../seed.js";

// config:
// {
//   categories: [{ name, bestOf, double, qualifiersPerGroup, knockout,
//                  groups: [{ label, teams: [name, ...] }] }],
//   slots: { courts: [], days: [], startTime, slotMinutes, slotsPerDay },
//   startNr,
// }
export function generateSchedule(config) {
  const warnings = [];
  const fixtures = [];
  let seq = 0;

  for (const cat of config.categories || []) {
    const catKey = cat.name.replace(/\s+/g, "_");
    const groups = (cat.groups || []).filter((g) => (g.teams || []).length >= 2);
    if (!groups.length) {
      warnings.push(`${cat.name}: no group has 2+ teams — skipped.`);
      continue;
    }

    // Group stage (round-robin per group), interleaved later by round index.
    for (const g of groups) {
      const rounds = roundRobin(g.teams, !!cat.double);
      rounds.forEach((round, ri) => {
        round.forEach(([a, b], i) => {
          fixtures.push({
            id: `${catKey}:grp:${g.label}:${ri}:${i}`,
            category: cat.name, bestOf: cat.bestOf, group: g.label,
            round: "Qualification round", phase: "group",
            groupRoundIndex: ri, seq: seq++,
            teamA: a, teamB: b, deps: [],
          });
        });
      });
    }

    // Knockout bracket (placeholder teams). Namespace ids + deps per category.
    const { fixtures: ko, warnings: kw } = buildBracket(groups, cat.qualifiersPerGroup || 2, {
      category: cat.name, bestOf: cat.bestOf, knockout: !!cat.knockout,
    });
    warnings.push(...kw);
    for (const f of ko) {
      fixtures.push({
        ...f,
        id: `${catKey}:${f.id}`,
        deps: (f.deps || []).map((d) => `${catKey}:${d}`),
        seq: seq++,
      });
    }
  }

  if (!fixtures.length) return { games: [], warnings, unplaced: [], fixtureCount: 0 };

  const { placed, unplaced, warnings: aw } = allocate(fixtures, config.slots);
  warnings.push(...aw);

  let nr = Number(config.startNr) || 1;
  const games = placed.map((p) => ({
    nr: nr++,
    date: p.date,
    time: p.time,
    court: p.court,
    bestOf: p.fixture.bestOf,
    round: p.fixture.round,
    category: p.fixture.category,
    group: p.fixture.group || "",
    teamA: team(p.fixture.teamA),
    teamB: team(p.fixture.teamB),
  }));

  return { games, warnings, unplaced, fixtureCount: fixtures.length };
}
