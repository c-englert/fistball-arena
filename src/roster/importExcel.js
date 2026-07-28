// Parse an uploaded .xlsx (the IFA "…DATA.xlsx" model) into rosters + referees.
// Same columns as the DB sheet tab, but with a `Referee` role and no category.
// xlsx is loaded on demand so it doesn't bloat the initial bundle.

export async function parseExcelRoster(file) {
  const XLSX = await import("xlsx");
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });
  return buildFromRows(rows);
}

function buildFromRows(rows) {
  const g = (r, k) => String(r[k] ?? "").trim();
  const teams = {};
  const referees = [];
  for (const r of rows) {
    const fam = g(r, "Family Name"), giv = g(r, "Given Name");
    if (!fam && !giv) continue;
    const role = g(r, "Role").toLowerCase();
    const photo = g(r, "Link to Profile Pic");
    const country = g(r, "Team");

    if (role === "referee") {
      referees.push({ name: fam, first: giv, role: g(r, "Staff Role") || "Referee", photo, birthday: g(r, "Birthday") });
      continue;
    }
    if (!country) continue;
    const t = teams[country] || (teams[country] = { name: country, players: [], staff: [] });
    if (role === "player") {
      const nr = parseInt(g(r, "Jersey Number"), 10);
      t.players.push({
        nr: isNaN(nr) ? "" : nr, name: fam, first: giv, position: g(r, "Player Position"),
        birthday: g(r, "Birthday"), height: g(r, "Height in cm"), matches: g(r, "# matches national team"),
        country, photo,
      });
    } else {
      t.staff.push({ role: g(r, "Staff Role") || "Staff", name: fam, first: giv, birthday: g(r, "Birthday"), country, photo });
    }
  }
  for (const t of Object.values(teams)) {
    t.players.sort((a, b) => (a.nr === "" ? 999 : a.nr) - (b.nr === "" ? 999 : b.nr));
  }
  const count = Object.values(teams).reduce((s, t) => s + t.players.length + t.staff.length, 0);
  return {
    teams, referees,
    teamCount: Object.keys(teams).length, count, refereeCount: referees.length,
    warnings: count || referees.length ? [] : ["No players/staff/referees found in the file."],
  };
}
