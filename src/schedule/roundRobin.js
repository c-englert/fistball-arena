// Round-robin fixture generation (circle method).
// Returns ordered rounds; each round is a list of [teamA, teamB] pairings that
// can be played simultaneously (no team appears twice in a round). Deterministic:
// the same input order always yields the same schedule (safe to re-generate).

const BYE = Symbol("bye");

export function singleRoundRobin(teams) {
  const t = teams.slice();
  if (t.length < 2) return [];
  if (t.length % 2 === 1) t.push(BYE); // odd → one team rests each round
  const n = t.length;
  const rounds = [];
  for (let r = 0; r < n - 1; r++) {
    const pairings = [];
    for (let i = 0; i < n / 2; i++) {
      const home = t[i];
      const away = t[n - 1 - i];
      if (home !== BYE && away !== BYE) {
        // alternate home/away by round parity for side fairness
        pairings.push(r % 2 === 0 ? [home, away] : [away, home]);
      }
    }
    rounds.push(pairings);
    // rotate: keep t[0] fixed, rotate the rest right by one
    t.splice(1, 0, t.pop());
  }
  return rounds;
}

export function doubleRoundRobin(teams) {
  const first = singleRoundRobin(teams);
  const second = first.map((round) => round.map(([a, b]) => [b, a]));
  return first.concat(second);
}

export function roundRobin(teams, double) {
  return double ? doubleRoundRobin(teams) : singleRoundRobin(teams);
}
