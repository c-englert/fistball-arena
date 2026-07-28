// Automatic slot allocation.
// Assigns each fixture a (date, time, court) over a grid of days × slots × courts.
// Hard constraint: no real team plays two matches in the same time slot.
// Soft constraint: avoid a team playing in back-to-back consecutive slots (rest).
// Group stage is placed before knockout; knockout respects dependency order.
// Nothing is dropped silently — unplaceable fixtures and shortfalls are returned
// as warnings.

const KO_RANK = { qf: 0, sf: 1, bronze: 2, final: 3 };

function isPlaceholder(name) {
  return /\d/.test(name) || /(winner|loser)/i.test(name);
}
function realTeamKeys(f) {
  const keys = [];
  for (const name of [f.teamA, f.teamB]) {
    if (!isPlaceholder(name)) keys.push(`${f.category}|${name}`);
  }
  return keys;
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}
function toHHMM(mins) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// Order fixtures: group stage interleaved by round index (round 1 of every group
// first, then round 2 …) so each team's games spread out in time; then knockout
// by stage rank and index.
function orderFixtures(fixtures) {
  const group = fixtures.filter((f) => f.phase === "group");
  const ko = fixtures.filter((f) => f.phase === "ko");
  group.sort((a, b) => (a.groupRoundIndex - b.groupRoundIndex) || (a.seq - b.seq));
  ko.sort((a, b) => (KO_RANK[a.koStage] - KO_RANK[b.koStage]) ||
    String(a.category).localeCompare(b.category) || (a.koIndex - b.koIndex));
  return [...group, ...ko];
}

export function allocate(fixtures, slotConfig) {
  const { courts, days, startTime, slotMinutes, slotsPerDay } = slotConfig;
  const warnings = [];
  const start = toMinutes(startTime);

  // Enumerate cells in chronological, then court order.
  const cells = [];
  for (let d = 0; d < days.length; d++) {
    for (let s = 0; s < slotsPerDay; s++) {
      for (let c = 0; c < courts.length; c++) {
        cells.push({ d, s, c, global: d * slotsPerDay + s });
      }
    }
  }

  const capacity = days.length * slotsPerDay * courts.length;
  if (fixtures.length > capacity) {
    const extraCells = fixtures.length - capacity;
    const extraSlots = Math.ceil(extraCells / courts.length);
    warnings.push(`Not enough room: ${fixtures.length} matches for ${capacity} court-slots. Add ${extraSlots} more time slot(s) or another court.`);
  }

  const cellUsed = new Set();               // "global|court"
  const busy = new Map();                    // global -> Set(teamKey)
  const played = new Map();                  // teamKey -> Set(global)
  const placedAt = new Map();                // fixture.id -> global
  const placed = [];
  const unplaced = [];
  let lastGroupGlobal = -1;
  let restViolations = 0;

  const busyAt = (g) => busy.get(g) || busy.set(g, new Set()).get(g);
  const playedOf = (k) => played.get(k) || played.set(k, new Set()).get(k);

  function findCell(keys, floor, requireRest) {
    for (const cell of cells) {
      if (cell.global < floor) continue;
      const ck = `${cell.global}|${cell.c}`;
      if (cellUsed.has(ck)) continue;
      const slotTeams = busy.get(cell.global);
      let ok = true;
      for (const k of keys) {
        if (slotTeams && slotTeams.has(k)) { ok = false; break; }       // hard
        if (requireRest) {
          const ps = played.get(k);
          if (ps && (ps.has(cell.global - 1) || ps.has(cell.global + 1))) { ok = false; break; }
        }
      }
      if (ok) return cell;
    }
    return null;
  }

  for (const f of orderFixtures(fixtures)) {
    const keys = realTeamKeys(f);
    let floor = 0;
    for (const dep of f.deps || []) {
      if (placedAt.has(dep)) floor = Math.max(floor, placedAt.get(dep) + 1);
    }
    if (f.phase === "ko") floor = Math.max(floor, lastGroupGlobal + 1);

    let cell = findCell(keys, floor, true);
    if (!cell) { cell = findCell(keys, floor, false); if (cell) restViolations++; }
    if (!cell) { unplaced.push(f); continue; }

    const ck = `${cell.global}|${cell.c}`;
    cellUsed.add(ck);
    for (const k of keys) { busyAt(cell.global).add(k); playedOf(k).add(cell.global); }
    placedAt.set(f.id, cell.global);
    if (f.phase === "group") lastGroupGlobal = Math.max(lastGroupGlobal, cell.global);

    placed.push({
      fixture: f,
      date: days[cell.d],
      time: toHHMM(start + cell.s * slotMinutes),
      court: String(courts[cell.c]),
      global: cell.global,
      courtIndex: cell.c,
    });
  }

  if (restViolations > 0) {
    warnings.push(`${restViolations} match(es) had to be scheduled back-to-back for a team. Add slots or a court for more rest.`);
  }
  if (unplaced.length > 0) {
    warnings.push(`${unplaced.length} match(es) could not be placed under the constraints. Add slots or a court.`);
  }

  // Chronological, then court order.
  placed.sort((a, b) => (a.global - b.global) || (a.courtIndex - b.courtIndex));
  return { placed, unplaced, warnings };
}
