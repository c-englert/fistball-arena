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
      teamA: team(teamA),
      teamB: team(teamB),
    });
  }
  games.sort((a, b) => a.nr - b.nr);
  if (!games.length) warnings.push("No matches found in the sheet.");
  return { games, warnings, unplaced: [] };
}
