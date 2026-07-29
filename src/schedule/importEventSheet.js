// Import a whole past event from its Google Sheet: the schedule WITH final
// scores (Results tab) + rosters (DB tab). Gives the event-driven Live a full
// standings/matches/bracket from the database. (Súmula line-up/card detail is a
// separate, content-anchored parser.)

import { team } from "../seed.js";
import { fetchRosters } from "../roster/importRoster.js";

function parseCSV(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else inQ = false; }
      else field += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
    else if (c !== "\r") field += c;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}
const num = (x) => { const n = parseInt(String(x).replace(/[^\d-]/g, ""), 10); return isNaN(n) ? 0 : n; };
const MONTHS = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06", jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };
function toShortDate(s) {
  const m = String(s).match(/(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/);
  if (!m) return String(s).trim();
  return `${m[1].padStart(2, "0")}/${MONTHS[m[2].toLowerCase()] || "01"}/${m[3].slice(2)}`;
}
const STATUS = ["Not Started", "Starting", "In progress", "Finished"];

// Parse one Results row into { game, result } (or null).
function parseResultRow(r0) {
  const r = r0.concat(Array(44).fill("")).map((x) => (x || "").trim());
  const nr = num(r[2]), teamA = r[4], teamB = r[5], category = r[7], round = r[6];
  if (!nr || !teamA || !teamB || !category) return null;
  const bestOf = num(r[8]) || 5;
  const setsA = num(r[9]), setsB = num(r[11]);
  const pipeIdx = r.findIndex((c) => c.trim() === "|");
  let pointsA = 0, pointsB = 0;
  if (pipeIdx > 0) { pointsA = num(r[pipeIdx - 1]); pointsB = num(r[pipeIdx + 1]); }
  const sets = [];
  const setEnd = pipeIdx > 13 ? pipeIdx : r.length;
  for (let i = 12; i + 2 < setEnd; i += 3) {
    if ((r[i + 1] || "").trim() !== "x") break;
    const a = num(r[i]), b = num(r[i + 2]);
    if (a === 0 && b === 0) continue;
    sets.push([a, b]);
  }
  let status = "Not Started";
  for (const c of r) { const t = c.trim(); if (STATUS.includes(t)) { status = t; break; } }
  const date = toShortDate(r[0]), time = r[1], court = r[3];
  return {
    game: { nr, date, time, court, bestOf, round, category, teamA: team(teamA), teamB: team(teamB) },
    result: { nr, date, time, court, round, category, bestOf, teamA, teamB, setsA, setsB, pointsA, pointsB, sets, status },
  };
}

// fetchEventFromSheet(sheetId) -> { games, results, rosters, warnings, ... }
// resultsTab: the tab holding the schedule + scores (named "Results" in the
// event workbooks; the Fistball Live source sheet uses gid 0).
export async function fetchEventFromSheet(sheetId, { resultsTab = "Results", dbTab = "DB" } = {}) {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(resultsTab)}&_=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status})`);
  const rows = parseCSV(await res.text());

  const games = [], results = [], warnings = [];
  const seen = new Set();
  for (const r0 of rows) {
    const parsed = parseResultRow(r0);
    if (!parsed) continue;
    if (seen.has(parsed.game.nr)) continue;
    seen.add(parsed.game.nr);
    games.push(parsed.game);
    results.push(parsed.result);
  }
  games.sort((a, b) => a.nr - b.nr);
  results.sort((a, b) => a.nr - b.nr);

  // Rosters from the DB tab (optional).
  let rosters = {};
  try {
    const r = await fetchRosters(sheetId, dbTab);
    rosters = r.rosters || {};
    if (r.warnings?.length) warnings.push(...r.warnings.map((w) => "DB: " + w));
  } catch (e) { warnings.push("DB tab not read: " + (e?.message || e)); }

  if (!games.length) warnings.push("No matches found in the Results tab.");
  const finished = results.filter((r) => r.status === "Finished").length;
  return { games, results, rosters, warnings, gameCount: games.length, finished, teamCount: Object.keys(rosters).length };
}
