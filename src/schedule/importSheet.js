// Import an existing schedule straight from the event's Google Sheet (the same
// public gviz CSV the Fistball Live viewer reads). Produces games in Arena's
// shape so they can be previewed and published like generated ones — preserving
// the real matchups, days, times, courts and (irregular) round names.

import { team } from "../seed.js";

// Minimal CSV parser (handles quoted fields with commas and escaped quotes).
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

const MONTHS = { jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12" };

// "Thursday - 23 Jul 2026" -> "23/07/26"
function toShortDate(s) {
  const m = String(s).match(/(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})/);
  if (!m) return String(s).trim();
  const dd = m[1].padStart(2, "0");
  const mm = MONTHS[m[2].toLowerCase()] || "01";
  return `${dd}/${mm}/${m[3].slice(2)}`;
}

// Seed-label placeholders ("1st Group A", "Winner SF1", "Loser SF2", "5th Silver")
// vs. real clubs that legitimately carry numbers ("SSV Bozen 2", "Widnau 1").
function isPlaceholderName(name) {
  const n = String(name || "").trim();
  if (!n) return true;
  return /(winner|loser)/i.test(n) || /\b\d+(st|nd|rd|th)\b/i.test(n) || /\b(sf|qf)\s*\d/i.test(n);
}

// Sheets have no group column, so infer groups from the fixtures: teams only
// play within their group in the round-robin, so each connected component of the
// "who played whom" graph (per category, real teams only) is one group. Labels
// A/B/C… are ordered by the group's earliest match number. Only applied when a
// category actually splits into 2+ groups; a single round-robin stays ungrouped.
function inferGroups(games) {
  const byCat = new Map();
  for (const g of games) {
    if (!byCat.has(g.category)) byCat.set(g.category, []);
    byCat.get(g.category).push(g);
  }
  const LABELS = "ABCDEFGHIJKL";
  for (const list of byCat.values()) {
    const stage = list.filter((g) => !isPlaceholderName(g._a) && !isPlaceholderName(g._b));
    const adj = new Map();
    const ensure = (t) => (adj.has(t) ? adj.get(t) : (adj.set(t, new Set()), adj.get(t)));
    for (const g of stage) { ensure(g._a).add(g._b); ensure(g._b).add(g._a); }
    const seen = new Set(), comps = [];
    for (const t of adj.keys()) {
      if (seen.has(t)) continue;
      const stack = [t], comp = [];
      seen.add(t);
      while (stack.length) {
        const x = stack.pop(); comp.push(x);
        for (const y of adj.get(x)) if (!seen.has(y)) { seen.add(y); stack.push(y); }
      }
      comps.push(comp);
    }
    if (comps.length < 2) continue; // single group → leave ungrouped
    const minNr = (comp) => {
      const s = new Set(comp);
      let m = Infinity;
      for (const g of stage) if (s.has(g._a) || s.has(g._b)) m = Math.min(m, g.nr);
      return m;
    };
    comps.sort((a, b) => minNr(a) - minNr(b));
    const label = new Map();
    comps.forEach((comp, i) => comp.forEach((t) => label.set(t, LABELS[i] || String(i + 1))));
    for (const g of stage) g.group = label.get(g._a) || label.get(g._b) || "";
  }
}

// Fetch + parse the sheet into { games, warnings }.
export async function fetchSheetGames(sheetId, gid = "0") {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&gid=${gid}&_=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status})`);
  const rows = parseCSV(await res.text());

  const games = [];
  const warnings = [];
  const seen = new Set();
  for (const r0 of rows) {
    const r = r0.concat(Array(40).fill("")).map((x) => (x || "").trim());
    const nr = num(r[2]);
    const teamA = r[4], teamB = r[5], category = r[7], round = r[6];
    if (!nr || !teamA || !teamB || !category) continue; // header / blank rows
    if (seen.has(nr)) { warnings.push(`Duplicate match #${nr} in sheet — kept the first.`); continue; }
    seen.add(nr);
    games.push({
      nr,
      date: toShortDate(r[0]),
      time: r[1],
      court: r[3],
      bestOf: num(r[8]) || 5,
      round,
      category,
      group: "",
      teamA: team(teamA),
      teamB: team(teamB),
      _a: teamA, _b: teamB, // raw names for group inference (not published)
    });
  }
  games.sort((a, b) => a.nr - b.nr);
  inferGroups(games);
  for (const g of games) { delete g._a; delete g._b; }
  if (!games.length) warnings.push("No matches found in the sheet.");
  const grouped = [...new Set(games.map((g) => g.group).filter(Boolean))].length;
  if (grouped) warnings.push(`Detected ${grouped} group(s) from the fixtures.`);
  return { games, warnings, unplaced: [] };
}
