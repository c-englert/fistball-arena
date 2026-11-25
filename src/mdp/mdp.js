// MDP — Map Definition Point: how each point of a game was decided.
// Pure logic shared by the scout screen, the statistics and the reports.
//
// A game's scouting: { log: [{ w: "A"|"B", a: actionKey } | { next: true }], serve: { [setIdx]: "A"|"B" } }
//   w = team that WON the point, a = the action that defined it.
//   { next: true } closes the current set by hand (normally a set closes by itself).
// Who is responsible for the action: the winner for winners (ace, attack winner),
// the other team for errors — so an error counts against the team that made it.

export const ACTIONS = [
  { key: "ace", label: "Service winner", by: "winner" },
  { key: "attack", label: "Attack winner", by: "winner" },
  { key: "serviceError", label: "Service error", by: "loser" },
  { key: "attackError", label: "Unforced attack error", by: "loser" },
  { key: "defenseError", label: "Defense unforced error", by: "loser" },
  { key: "setterError", label: "Setter unforced error", by: "loser" },
];
export const ACTION = Object.fromEntries(ACTIONS.map((a) => [a.key, a]));
export const other = (t) => (t === "A" ? "B" : "A");
export const responsible = (p) => (ACTION[p.a]?.by === "loser" ? other(p.w) : p.w);

// A fistball set ends at 11 with a 2-point lead, or at 15.
export const setDone = (a, b) => (Math.max(a, b) >= 11 && Math.abs(a - b) >= 2) || Math.max(a, b) >= 15;

// The log as sets of points, each point with its set, number and serving team.
// The team that lost a point serves the next one; the first service of a set is
// serve[set] (default: set 1 team A, then alternating).
export function replay(mdp) {
  const log = mdp?.log || [], serve = mdp?.serve || {};
  const firstServe = (s) => serve[s] || (s % 2 ? "B" : "A");
  const sets = [{ points: [], a: 0, b: 0 }];
  for (const e of log) {
    let cur = sets[sets.length - 1];
    if (e.next) { if (cur.points.length) sets.push({ points: [], a: 0, b: 0 }); continue; }
    if (!e.w || !ACTION[e.a]) continue;
    if (cur.points.length && setDone(cur.a, cur.b)) { cur = { points: [], a: 0, b: 0 }; sets.push(cur); }
    const s = sets.length - 1;
    const prev = cur.points[cur.points.length - 1];
    const server = prev ? other(prev.w) : firstServe(s);
    cur.points.push({ set: s, n: cur.points.length + 1, w: e.w, a: e.a, server });
    if (e.w === "A") cur.a++; else cur.b++;
  }
  const last = sets[sets.length - 1];
  // The set being scouted now (a finished set moves on to the next).
  const current = last.points.length && setDone(last.a, last.b) ? sets.length : sets.length - 1;
  const lastPoint = last.points[last.points.length - 1];
  const nextServer = current === sets.length ? firstServe(current) : lastPoint ? other(lastPoint.w) : firstServe(current);
  return { sets: sets.filter((x) => x.points.length), current, nextServer, firstServe };
}

const pct = (x, n) => (n ? (x / n) * 100 : null);

// Head-to-head statistics (the rows of the MDP sheet) for the given points.
export function teamStats(points) {
  const side = (T) => {
    const O = other(T);
    const by = (k, team) => points.filter((p) => p.a === k && responsible(p) === team).length;
    const served = points.filter((p) => p.server === T);
    const servedWon = served.filter((p) => p.w === T).length;
    return {
      played: points.length,
      won: points.filter((p) => p.w === T).length,
      lost: points.filter((p) => p.w === O).length,
      services: served.length,
      servicesWonPct: pct(servedWon, served.length),
      servicesLostPct: pct(served.length - servedWon, served.length),
      aces: by("ace", T),
      serviceErrors: by("serviceError", T),
      attackWon: by("attack", T),
      attackLost: by("attack", O),
      attackErrors: by("attackError", T),
      defenseErrors: by("defenseError", T),
      setterErrors: by("setterError", T),
    };
  };
  return { A: side("A"), B: side("B") };
}

// The rows shown head to head, in the order of the MDP sheet.
export const STAT_ROWS = [
  { group: "General play", rows: [["played", "Points played"], ["won", "Points won"], ["lost", "Points lost"]] },
  { group: "Service play", rows: [["services", "Number of services"], ["servicesWonPct", "% of services won", "%"], ["servicesLostPct", "% of services lost", "%"], ["aces", "Service winners won"], ["serviceErrors", "Service errors"]] },
  { group: "Strikes play", rows: [["attackWon", "Attack winners won"], ["attackLost", "Attack winners lost"], ["attackErrors", "Unforced attack errors"]] },
  { group: "Defense and setter play", rows: [["defenseErrors", "Defense unforced errors"], ["setterErrors", "Setter unforced errors"]] },
];

// How the points were decided over many games (event / category / team):
// share of every action, and per team how it won its points and which errors it made.
// games: [{ teamA, teamB, category, mdp }]
export function stratify(games) {
  const total = Object.fromEntries(ACTIONS.map((a) => [a.key, 0]));
  const teams = new Map();
  const team = (name, category) => {
    const k = `${name}\u0000${category || ""}`;
    if (!teams.has(k)) teams.set(k, { team: name, category: category || "", games: 0, won: 0, lost: 0,
      wonBy: Object.fromEntries(ACTIONS.map((a) => [a.key, 0])), errors: Object.fromEntries(ACTIONS.filter((a) => a.by === "loser").map((a) => [a.key, 0])) });
    return teams.get(k);
  };
  let points = 0, games_ = 0;
  for (const g of games) {
    const pts = replay(g.mdp).sets.flatMap((s) => s.points);
    if (!pts.length) continue;
    games_++;
    const T = { A: team(g.teamA, g.category), B: team(g.teamB, g.category) };
    T.A.games++; T.B.games++;
    for (const p of pts) {
      points++;
      total[p.a]++;
      T[p.w].won++; T[other(p.w)].lost++;
      T[p.w].wonBy[p.a]++;
      if (ACTION[p.a].by === "loser") T[other(p.w)].errors[p.a]++;
    }
  }
  return {
    games: games_, points,
    actions: ACTIONS.map((a) => ({ key: a.key, label: a.label, count: total[a.key], pct: pct(total[a.key], points) })),
    teams: [...teams.values()].sort((a, b) => a.category.localeCompare(b.category) || b.won - a.won || a.team.localeCompare(b.team)),
  };
}
