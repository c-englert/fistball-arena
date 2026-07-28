// Import the players & staff registry from the event's "DB" sheet tab.
// Produces one roster per "Team - Cat" (e.g. "Austria - WEC"), matching the
// team names used on the games, so súmula line-ups can be pre-filled.

// Minimal CSV parser (quoted fields, escaped quotes).
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

// fetch + parse -> { rosters: { "Team - Cat": {name, players[], staff[]} }, teamCount, count, warnings }
export async function fetchRosters(sheetId, tab = "DB") {
  const url = `https://docs.google.com/spreadsheets/d/${sheetId}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tab)}&_=${Date.now()}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Sheet fetch failed (${res.status})`);
  const rows = parseCSV(await res.text());
  if (!rows.length) return { rosters: {}, teamCount: 0, count: 0, warnings: ["Empty sheet."] };

  const hdr = rows[0].map((h) => (h || "").trim());
  const col = (name) => hdr.indexOf(name);
  const iFam = col("Family Name"), iGiv = col("Given Name"), iRole = col("Role"),
    iStaffRole = col("Staff Role"), iPos = col("Player Position"),
    iBday = col("Birthday"), iNr = col("Jersey Number"), iTC = col("Team - Cat"),
    iPic = col("Link to Profile Pic"), iHeight = col("Height in cm"),
    iMatches = col("# matches national team"), iTeam = col("Team"), iCat = col("Category");
  if (iTC < 0 || iFam < 0) {
    return { rosters: {}, teamCount: 0, count: 0, warnings: ["This tab doesn't look like the DB registry (missing 'Team - Cat' / 'Family Name')."] };
  }

  const rosters = {};
  for (const r0 of rows.slice(1)) {
    const r = r0.map((x) => (x || "").trim());
    const tc = r[iTC];
    const fam = r[iFam], giv = r[iGiv];
    if (!tc || (!fam && !giv)) continue;
    const t = rosters[tc] || (rosters[tc] = { name: tc, players: [], staff: [] });
    const g = (i) => (i >= 0 ? (r[i] || "") : "");
    const photo = g(iPic), country = g(iTeam), cat = g(iCat), birthday = g(iBday), height = g(iHeight), matches = g(iMatches);
    if ((r[iRole] || "").toLowerCase() === "player") {
      const nr = parseInt(r[iNr], 10);
      t.players.push({ nr: isNaN(nr) ? "" : nr, name: fam, first: giv, position: g(iPos), birthday, height, matches, country, cat, photo });
    } else {
      t.staff.push({ role: r[iStaffRole] || "Staff", name: fam, first: giv, birthday, country, cat, photo });
    }
  }

  for (const t of Object.values(rosters)) {
    t.players.sort((a, b) => (a.nr === "" ? 999 : a.nr) - (b.nr === "" ? 999 : b.nr));
  }
  const teamCount = Object.keys(rosters).length;
  const count = Object.values(rosters).reduce((s, t) => s + t.players.length + t.staff.length, 0);
  return { rosters, teamCount, count, warnings: count ? [] : ["No people found in this tab."] };
}
