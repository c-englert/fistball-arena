// Event final report (pure): final classification per category, participation,
// cards and game lengths — computed from the public results, the rosters and
// the reports (súmulas).

import { rankGroup, compareRecords } from "../schedule/standings.js";
import { isPlaceholder } from "../schedule/advance.js";

const num = (x) => (Number.isFinite(+x) ? +x : 0);
const finished = (r) => r && r.status === "Finished";
export const isGroupRound = (round) => /qualification|vorrunde|preliminary|group stage|round robin/i.test(String(round || ""));

export function genderOf(category) {
  const c = String(category || "");
  if (/women|female|ladies|damen|frauen|\bw\b|\bfem/i.test(c)) return "Women";
  if (/\bmen\b|male|herren|männer|\bm\b|\bmasc/i.test(c)) return "Men";
  return "Other";
}

// The first place a finished game decides (winner gets it, loser the next):
// gold medal / final → 1, bronze → 3, "Placement 5-6" → 5. Null otherwise.
export function placeOfRound(round) {
  const r = String(round || "").toLowerCase();
  if (/semi|halbfinal|quarter|viertel|repechage|hoffnung|intermediate/.test(r)) return null;
  if (/gold medal|^\s*finale?\s*$|platz 1\b/.test(r)) return 1;
  if (/bronze|3rd|third|platz 3\b/.test(r)) return 3;
  const range = r.match(/(?:placement|places?|platz|p)\s*(\d+)\s*[-–/]\s*(\d+)/);
  if (range) return Number(range[2]) === Number(range[1]) + 1 ? Number(range[1]) : null;
  const single = r.match(/(?:placement|platz)\s*(\d+)\b/);
  return single ? Number(single[1]) : null;
}

export const realTeams = (results) => [...new Set(results.flatMap((r) => [r.teamA, r.teamB]).filter((t) => t && !isPlaceholder(t)))];

// Final ranking of one category from its results. Teams without a placement
// game take the free places: deeper knockout run first, then group position,
// then group record. decided = the final has been played; complete = every
// knockout game is finished (an unplayed group game doesn't count).
export function finalRanking(results) {
  const teams = realTeams(results);
  if (!teams.length) return null;
  const place = new Map();
  let decided = false;
  for (const r of results) {
    const p = placeOfRound(r.round);
    if (!p || !finished(r) || num(r.setsA) === num(r.setsB) || isPlaceholder(r.teamA) || isPlaceholder(r.teamB)) continue;
    const aWon = num(r.setsA) > num(r.setsB);
    place.set(aWon ? r.teamA : r.teamB, p);
    place.set(aWon ? r.teamB : r.teamA, p + 1);
    if (p === 1) decided = true;
  }
  const group = results.filter((r) => isGroupRound(r.round));
  const groupPos = new Map();
  const labels = [...new Set(group.map((r) => r.group || ""))];
  for (const g of labels) rankGroup(group.filter((r) => (r.group || "") === g)).forEach((t, i) => groupPos.set(t, i));
  const koRun = (t) => results.filter((r) => !isGroupRound(r.round) && finished(r) && (r.teamA === t || r.teamB === t)).length;
  const rec = compareRecords(group);
  const rest = teams.filter((t) => !place.has(t)).sort((a, b) =>
    koRun(b) - koRun(a) || (groupPos.get(a) ?? 99) - (groupPos.get(b) ?? 99) || rec(a, b));
  const taken = new Set(place.values());
  let next = 1;
  for (const t of rest) { while (taken.has(next)) next++; place.set(t, next); taken.add(next); }
  const rows = [...place].map(([team, pos]) => ({ team, pos })).sort((a, b) => a.pos - b.pos);
  return { rows, decided, complete: results.filter((r) => !isGroupRound(r.round)).every(finished) };
}

// "dd/mm/yy" (or ISO "yyyy-mm-dd") + "HH:MM" → local Date, or null.
export function scheduledStart(date, time) {
  const t = String(time || "").match(/(\d{1,2})[:h.](\d{2})/);
  if (!t) return null;
  let y, m, d;
  const iso = String(date || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
  const dmy = String(date || "").match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (iso) [y, m, d] = [+iso[1], +iso[2], +iso[3]];
  else if (dmy) [d, m, y] = [+dmy[1], +dmy[2], +dmy[3] < 100 ? 2000 + +dmy[3] : +dmy[3]];
  else return null;
  return new Date(y, m - 1, d, +t[1], +t[2]);
}
const millis = (ts) => (ts?.toMillis ? ts.toMillis() : typeof ts === "number" ? ts : ts?.seconds ? ts.seconds * 1000 : null);

// Length of one finished game in minutes. "measured" = first to last point,
// recorded by the súmula; otherwise "estimated" = scheduled start to report
// submission (only kept when plausible, 15–180 min). Null when neither.
export function gameMinutes(report, game) {
  const t = report?.timing;
  if (t?.start && t?.end && t.end > t.start) return { minutes: (t.end - t.start) / 60000, measured: true };
  const sub = millis(report?.submittedAt);
  const st = scheduledStart(game?.date, game?.time);
  if (!sub || !st) return null;
  const min = (sub - st.getTime()) / 60000;
  return min >= 15 && min <= 180 ? { minutes: min, measured: false } : null;
}

// Average game length by best-of: [{ bestOf, games, measured: {avg, n}, estimated: {avg, n} }].
export function durationByBestOf(items) {
  const by = new Map();
  for (const { bestOf, length } of items) {
    const k = num(bestOf) || 0;
    if (!by.has(k)) by.set(k, { bestOf: k, games: 0, m: [], e: [] });
    const b = by.get(k);
    b.games++;
    if (length) (length.measured ? b.m : b.e).push(length.minutes);
  }
  const avg = (a) => ({ n: a.length, avg: a.length ? a.reduce((x, y) => x + y, 0) / a.length : null });
  return [...by.values()].sort((a, b) => a.bestOf - b.bestOf).map((b) => ({ bestOf: b.bestOf, games: b.games, measured: avg(b.m), estimated: avg(b.e) }));
}

// Card totals from the public results' card lists, per category.
export function cardsByCategory(results) {
  const out = {};
  for (const r of results) for (const c of r.cards || []) {
    const k = c.category || r.category || "";
    const o = (out[k] = out[k] || { y: 0, yr: 0, r: 0 });
    o.y += num(c.y); o.yr += num(c.yr); o.r += num(c.r);
  }
  return out;
}

// "Quarterfinal 3" → "Quarterfinal"; "Placement 5-6" stays.
export const stageOf = (round) => String(round || "").replace(/\s+\d+\s*$/, "").trim();
const medal = (stage) => { const p = placeOfRound(stage); return p === 1 ? 2 : p === 3 ? 1 : 0; };
const bestOfs = (list) => [...new Set(list.map((r) => num(r.bestOf)).filter(Boolean))].sort((a, b) => a - b);

// How one category was played, read from its games: the group stage (groups,
// teams per group, single/double round robin) and the knockout stages in
// game order with how many games each had.
export function formatOf(results) {
  const sorted = [...results].sort((a, b) => num(a.nr) - num(b.nr));
  const grp = sorted.filter((r) => isGroupRound(r.round));
  const ko = sorted.filter((r) => !isGroupRound(r.round));
  const gm = new Map();
  for (const r of grp) {
    const k = r.group || "";
    if (!gm.has(k)) gm.set(k, { label: k, teams: new Set(), games: 0 });
    const g = gm.get(k);
    g.games++;
    for (const t of [r.teamA, r.teamB]) if (t && !isPlaceholder(t)) g.teams.add(t);
  }
  const groups = [...gm.values()].sort((a, b) => a.label.localeCompare(b.label)).map((g) => {
    const n = g.teams.size, single = (n * (n - 1)) / 2;
    return { label: g.label, teams: n, games: g.games, double: n > 1 && g.games >= 2 * single };
  });
  const stages = [];
  for (const r of ko) {
    const s = stageOf(r.round);
    let st = stages.find((x) => x.stage === s);
    if (!st) stages.push((st = { stage: s, games: 0, bestOf: num(r.bestOf), placement: placeOfRound(r.round) >= 5 }));
    st.games++;
  }
  return {
    teams: realTeams(results).length, games: results.length,
    groupStage: grp.length ? stageOf(grp[0].round) : "", groups, groupBestOf: bestOfs(grp),
    // Medal games last (bronze before gold); placement games by place.
    stages: stages.filter((x) => !x.placement).sort((a, b) => medal(a.stage) - medal(b.stage))
      .concat(stages.filter((x) => x.placement).sort((a, b) => placeOfRound(a.stage) - placeOfRound(b.stage))),
    koBestOf: bestOfs(ko),
  };
}

// Playing days: [{ day (Date, midnight), games, courts: [..], first, last (Date), minutes }].
// items: { date, time, court, minutes (game length), end (ms of the last point, optional) }.
// A game ends at its recorded last point when plausible, else start + minutes.
export function playingDays(items) {
  const by = new Map();
  for (const it of items) {
    const st = scheduledStart(it.date, it.time);
    if (!st) continue;
    const s = st.getTime();
    const end = it.end && it.end > s && it.end - s < 6 * 3600000 ? it.end : s + (num(it.minutes) || 60) * 60000;
    const key = `${st.getFullYear()}-${st.getMonth()}-${st.getDate()}`;
    if (!by.has(key)) by.set(key, { day: new Date(st.getFullYear(), st.getMonth(), st.getDate()), games: 0, courts: new Set(), first: s, last: end });
    const d = by.get(key);
    d.games++;
    if (it.court != null && it.court !== "") d.courts.add(String(it.court));
    d.first = Math.min(d.first, s);
    d.last = Math.max(d.last, end);
  }
  const byNum = (a, b) => (Number(a) - Number(b)) || a.localeCompare(b);
  return [...by.values()].sort((a, b) => a.day - b.day).map((d) => ({
    day: d.day, games: d.games, courts: [...d.courts].sort(byNum),
    first: new Date(d.first), last: new Date(d.last), minutes: (d.last - d.first) / 60000,
  }));
}
