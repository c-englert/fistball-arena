// Event final report model (pure): the numbers (reportData) and the
// translated block model (reportModel) shared by the screen/print view and
// the Word document.
import { isPlaceholder } from "../schedule/advance.js";
import { flagFor, countryName } from "../flags.js";
import { tRound, tCategory, localeOf } from "../i18n.js";
import { finalRanking, genderOf, gameMinutes, durationByBestOf, cardsByCategory, realTeams, formatOf, playingDays, medalGames } from "./finalReport.js";

export const GENDERS = ["Women", "Men", "Other"];
const MEDAL = { 1: "🥇", 2: "🥈", 3: "🥉" };
const short = (n) => String(n || "").split(" - ")[0];
const num = (x) => (Number.isFinite(+x) ? +x : 0);
export const fmtMin = (m) => {
  if (m == null) return "—";
  const t = Math.round(m), h = Math.floor(t / 60), min = t % 60;
  return h ? (min ? `${h} h ${min} min` : `${h} h`) : `${min} min`;
};

// rosterOf(team, category) → { players, staff } | undefined. reports: null while loading.
export function reportData({ games, results, rosterOf, reports, defaultMinutes }) {
    const cats = [...new Set(results.map((r) => r.category).filter(Boolean))]
      .sort((a, b) => GENDERS.indexOf(genderOf(a)) - GENDERS.indexOf(genderOf(b)) || a.localeCompare(b));
    const gameById = Object.fromEntries(games.map((g) => [g.id, g]));
    const repById = Object.fromEntries((reports || []).map((r) => [r.id, r]));
    const cards = cardsByCategory(results);
    const perCat = cats.map((cat) => {
      const res = results.filter((r) => r.category === cat);
      const teams = realTeams(res);
      let players = 0, staff = 0;
      for (const t of teams) {
        const ro = rosterOf(t, cat);
        players += (ro?.players || []).length;
        staff += (ro?.staff || []).length;
      }
      const real = res.filter((r) => !isPlaceholder(r.teamA) && !isPlaceholder(r.teamB));
      return {
        cat, gender: genderOf(cat), teams: teams.length, players, staff,
        played: res.filter((r) => r.status === "Finished").length, scheduled: real.length,
        cards: cards[cat] || { y: 0, yr: 0, r: 0 },
        ranking: finalRanking(res), format: formatOf(res),
      };
    });
    const done = results.filter((r) => r.status === "Finished");
    const lengths = done.map((r) => {
      const g = gameById[r.id] || r;
      return { r, g, bestOf: num(r.bestOf || g.bestOf), length: reports ? gameMinutes(repById[r.id], g) : null };
    });
    const durations = durationByBestOf(lengths);
    const avgOf = Object.fromEntries(durations.map((d) => [d.bestOf, d.measured.n ? d.measured.avg : d.estimated.avg]));
    const fallback = num(defaultMinutes) || 60;
    const days = playingDays(lengths.map(({ r, g, bestOf, length }) => ({
      date: g.date || r.date, time: g.time || r.time, court: g.court ?? r.court,
      minutes: length?.measured ? length.minutes : avgOf[bestOf] || fallback,
      end: repById[r.id]?.timing?.end || null,
    })));
    const courts = [...new Set(days.flatMap((d) => d.courts))].sort((a, b) => (Number(a) - Number(b)) || a.localeCompare(b));
    const sum = (k) => perCat.reduce((s, c) => s + c[k], 0);
    const total = {
      teams: sum("teams"), players: sum("players"), staff: sum("staff"), played: sum("played"), scheduled: sum("scheduled"),
      cards: perCat.reduce((s, c) => ({ y: s.y + c.cards.y, yr: s.yr + c.cards.yr, r: s.r + c.cards.r }), { y: 0, yr: 0, r: 0 }),
    };
    const order = new Map(cats.map((c, i) => [c, i]));
    // Lineups of the medal games: the game report's when there is one, else the registered squad.
    const lineup = (rep, team, cat) => {
      const src = rep?.players?.length ? rep : rosterOf(team, cat) || {};
      return { players: (src.players || []).map((p) => ({ nr: p.nr, name: p.name, first: p.first })), staff: (src.staff || []).map((x) => ({ role: x.role, name: x.name, first: x.first })) };
    };
    const medals = medalGames(results).sort((a, b) => (order.get(a.category) ?? 99) - (order.get(b.category) ?? 99) || a.place - b.place)
      .map((m) => ({ ...m, lineupA: lineup(repById[m.id]?.teamA, m.teamA, m.category), lineupB: lineup(repById[m.id]?.teamB, m.teamB, m.category) }));
    return { perCat, durations, total, days, courts, medals };
}

// tr: translator for lang. fields: { host, technical, notes }. mapPages: images of a PDF venue map.
export function reportModel({ data, lang, tr, event, branding, fields, refsCount, reports, teamLogos, venueMap, mapPages, weather }) {
    const loc = localeOf(lang);
    const R = (s) => tRound(lang, s);
    const hm = (d) => d.toLocaleTimeString(loc, { hour: "2-digit", minute: "2-digit" });
    const of = (c, k) => `${c[k]}`;
    const dates = event?.dates || [event?.startDate, event?.endDate].filter(Boolean).join(" – ");
    const venue = [event?.place, event?.address].filter(Boolean).join(" · ");
    const sections = [];
    const C = (cat) => tCategory(lang, cat);
    // Country names in the report's language (national teams only); clubs as written.
    const T = (team, cat) => (/club/i.test(cat || "") ? short(team) : countryName(team, lang));
    const FT = (team, cat) => `${flagFor(team)} ${T(team, cat)}`.trim();
    const full = (p) => [p.first, p.name].filter(Boolean).join(" ");
    const add = (heading, blocks, newPage) => sections.push({ heading: `${sections.length + 1}. ${heading}`, blocks, newPage });

    add(tr("Event details"), [{ type: "kv", rows: [
      [tr("Event"), event?.name || "—"], [tr("Dates"), dates || "—"], [tr("Venue"), venue || "—"],
      [tr("Host"), fields.host || "—"], [tr("Technical responsible"), fields.technical || "—"],
    ] }]);

    add(tr("Categories"), GENDERS.map((gen) => {
      const list = data.perCat.filter((c) => c.gender === gen);
      return list.length ? { type: "p", text: `${tr(gen)}: ${list.map((c) => C(c.cat)).join(", ")}` } : null;
    }).filter(Boolean));

    // Format: overview + one paragraph block per category.
    const bo = (l) => l.join("/");
    const fmt = [{ type: "p", text: tr("{cats} categories, {teams} teams and {games} games, played over {days} days on {courts} courts.", {
      cats: data.perCat.length, teams: data.total.teams, games: data.total.played, days: data.days.length, courts: data.courts.length,
    }) }];
    for (const c of data.perCat) {
      const f = c.format;
      fmt.push({ type: "h3", text: C(c.cat) });
      fmt.push({ type: "p", text: tr("{n} teams · {g} games.", { n: f.teams, g: f.games }) });
      if (f.groups.length) {
        const rr = f.groups.every((g) => g.double) ? tr("double round robin") : tr("round robin");
        fmt.push({ type: "p", text: f.groups.length === 1
          ? tr("{stage}: one group of {n} teams, {rr} — {g} games, best of {bo}.", { stage: R(f.groupStage), n: f.groups[0].teams, rr, g: f.groups[0].games, bo: bo(f.groupBestOf) })
          : tr("{stage}: {k} groups ({list}), {rr} within each group — {g} games, best of {bo}.", {
            stage: R(f.groupStage), k: f.groups.length, rr, bo: bo(f.groupBestOf), g: f.groups.reduce((s, g) => s + g.games, 0),
            list: f.groups.map((g) => tr("group {g}: {n} teams", { g: g.label || "–", n: g.teams })).join("; "),
          }) });
      }
      const main = f.stages.filter((x) => !x.placement), place = f.stages.filter((x) => x.placement);
      const boOf = (l) => bo([...new Set(l.map((x) => x.bestOf).filter(Boolean))].sort((a, b) => a - b));
      if (main.length) fmt.push({ type: "p", text: tr("Knockout stage (best of {bo}): {list}.", {
        bo: boOf(main), list: main.map((x) => (x.games > 1 ? `${R(x.stage)} (${x.games})` : R(x.stage))).join(" · "),
      }) });
      if (place.length) fmt.push({ type: "p", text: tr("Placement games (best of {bo}): {list}.", {
        bo: boOf(place), list: place.map((x) => R(x.stage)).join(" · "),
      }) });
    }
    add(tr("Format"), fmt);

    // Courts and playing time per day.
    const totalMin = data.days.reduce((s, d) => s + d.minutes, 0);
    add(tr("Courts and playing time"), data.days.length ? [
      { type: "p", text: tr("Courts used: {n} ({list}).", { n: data.courts.length, list: data.courts.map((c) => tr("Court {c}", { c })).join(", ") }) },
      { type: "table", num: [1, 3, 4, 5],
        head: [tr("Day"), tr("Games"), tr("Courts"), tr("First game"), tr("Last game ends"), tr("Playing time")],
        rows: data.days.map((d) => [
          d.day.toLocaleDateString(loc, { weekday: "short", day: "2-digit", month: "2-digit" }), String(d.games), d.courts.join(", "),
          hm(d.first), hm(d.last), fmtMin(d.minutes),
        ]),
        total: [tr("Total"), String(data.days.reduce((s, d) => s + d.games, 0)), String(data.courts.length), "", "", fmtMin(totalMin)] },
      { type: "p", text: tr("Average per day: {t}.", { t: fmtMin(totalMin / data.days.length) }) },
      { type: "p", small: true, text: tr("Playing time = start of the first game to the end of the last game of the day. The end is the last point when recorded by the game report; otherwise the scheduled start plus the average game length.") },
    ] : [{ type: "p", text: "—" }]);

    // Weather on the playing days (reference for the medical team).
    if (data.days.length) {
      const deg = (v) => (v == null ? "—" : `${v.toLocaleString(loc, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} °C`);
      const pct = (v) => (v == null ? "—" : `${Math.round(v)} %`);
      const wd = weather?.days || [];
      const mean = (k) => { const v = wd.map((d) => d[k]).filter((x) => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
      add(tr("Weather on the playing days"), weather === undefined ? [{ type: "p", text: tr("Loading…") }] : !wd.length
        ? [{ type: "p", text: tr("Weather data is not available for this venue or these dates.") }] : [
          { type: "table", num: [1, 2, 3, 4],
            head: [tr("Day"), tr("Min."), tr("Max."), tr("Average during the games"), tr("Humidity during the games")],
            rows: data.days.map((d, i) => [
              d.day.toLocaleDateString(loc, { weekday: "short", day: "2-digit", month: "2-digit" }),
              deg(wd[i]?.min), deg(wd[i]?.max), deg(wd[i]?.avgPlay), pct(wd[i]?.humPlay),
            ]),
            total: [tr("Average"), deg(mean("min")), deg(mean("max")), deg(mean("avgPlay")), pct(mean("humPlay"))] },
          { type: "p", small: true, text: tr("Air temperature and relative humidity per hour at {place} ({lat}, {lon}), from Open-Meteo weather model data — not measured at the courts. “During the games” = the hours from the first to the last game of the day.", {
            place: weather.place, lat: weather.lat.toFixed(2), lon: weather.lon.toFixed(2) }) },
        ]);
    }

    add(tr("Teams, players, officials and games"), [
      { type: "table", num: [1, 2, 3, 4], head: [tr("Category"), tr("Teams"), tr("Players"), tr("Team officials"), tr("Games played")],
        rows: data.perCat.map((c) => [C(c.cat), of(c, "teams"), of(c, "players"), of(c, "staff"), `${c.played}${c.scheduled > c.played ? ` ${tr("of {n}", { n: c.scheduled })}` : ""}`]),
        total: [tr("Total"), of(data.total, "teams"), of(data.total, "players"), of(data.total, "staff"), `${data.total.played}${data.total.scheduled > data.total.played ? ` ${tr("of {n}", { n: data.total.scheduled })}` : ""}`] },
      { type: "p", text: `${tr("Referees:")} ${refsCount} · ${tr("Players + team officials:")} ${data.total.players + data.total.staff}` },
    ]);

    const ct = (k) => k.y + k.yr + k.r;
    add(tr("Disciplinary — cards"), [{ type: "table", num: [1, 2, 3, 4], head: [tr("Category"), tr("Yellow"), tr("Yellow-red"), tr("Red"), tr("Total")],
      rows: data.perCat.map((c) => [C(c.cat), String(c.cards.y), String(c.cards.yr), String(c.cards.r), String(ct(c.cards))]),
      total: [tr("Total"), String(data.total.cards.y), String(data.total.cards.yr), String(data.total.cards.r), String(ct(data.total.cards))] }]);

    const anyEstimated = data.durations.some((d) => !d.measured.n && d.estimated.n);
    add(tr("Average game length"), reports === null ? [{ type: "p", text: tr("Loading…") }] : [
      { type: "table", num: [1, 2], head: [tr("Best of"), tr("Games"), tr("Average"), tr("Based on")],
        rows: data.durations.map((d) => {
          const use = d.measured.n ? d.measured : d.estimated;
          return [tr("Best of {n}", { n: d.bestOf || "?" }), String(d.games), use.n ? `${d.measured.n ? "" : "≈ "}${fmtMin(use.avg)}` : "—",
            d.measured.n ? tr("{n} games timed (first to last point)", { n: d.measured.n }) : d.estimated.n ? tr("{n} games, estimated*", { n: d.estimated.n }) : tr("no times recorded")];
        }) },
      ...(anyEstimated ? [{ type: "p", small: true, text: tr("* Estimated from the scheduled start to the moment the game report was submitted, so delays before the start and the time to sign are included. From now on, Arena records each game's real length (first to last point) automatically.") }] : []),
    ]);

    const rank = [];
    for (const gen of GENDERS) {
      const list = data.perCat.filter((c) => c.gender === gen && c.ranking);
      if (!list.length) continue;
      rank.push({ type: "h3", text: tr(gen) });
      rank.push({ type: "ranks", items: list.map((c) => ({
        title: `${C(c.cat)}${c.ranking.decided ? (c.ranking.complete ? "" : ` ${tr("(provisional)")}`) : ` ${tr("(final not played yet)")}`}`,
        rows: c.ranking.rows.map((x) => ({
          pos: c.ranking.decided ? (MEDAL[x.pos] ? `${MEDAL[x.pos]} ${x.pos}` : String(x.pos)) : "–",
          team: FT(x.team, c.cat), logo: teamLogos[x.team] || null,
        })),
      })) });
    }
    add(tr("Final ranking"), rank, true);

    if (data.medals.length) {
      const blocks = [{ type: "table", num: [],
        head: [tr("Category"), tr("Round"), tr("Match"), tr("Sets")],
        rows: data.medals.map((m) => [C(m.category), R(m.round), `${FT(m.teamA, m.category)} ${m.setsA}:${m.setsB} ${T(m.teamB, m.category)} ${flagFor(m.teamB)}`.trim(), m.sets.join(", ") || "—"]) }];
      // Players and coaches of both teams, one table per medal game.
      for (const m of data.medals) {
        const col = (l) => [...l.players.map((p) => `${p.nr != null && p.nr !== "" ? `#${p.nr} ` : ""}${full(p)}`),
          ...l.staff.map((x) => `${x.role ? `${tr(x.role)}: ` : ""}${full(x)}`)];
        const a = col(m.lineupA), b = col(m.lineupB);
        if (!a.length && !b.length) continue;
        blocks.push({ type: "h3", text: `${C(m.category)} — ${R(m.round)}` });
        blocks.push({ type: "table", num: [], head: [FT(m.teamA, m.category), FT(m.teamB, m.category)],
          rows: Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [a[i] || "", b[i] || ""]) });
      }
      add(tr("Medal matches"), blocks);
    }

    if (venueMap) add(tr("Venue map"), venueMap.kind === "image" ? [{ type: "image", src: venueMap.data }]
      : mapPages.length ? mapPages.map((src) => ({ type: "image", src }))
        : [{ type: "p", text: tr("The venue map is a PDF ({name}) — attach it to the report.", { name: venueMap.name || "Venue map.pdf" }) }], true);

    if (fields.notes?.trim()) add(tr("Notes"), fields.notes.split(/\n+/).filter((s) => s.trim()).map((text) => ({ type: "p", text })));

    return {
      title: tr("Event final report"), eventName: event?.name || "",
      lines: [dates, venue], eventLogo: branding?.eventLogo?.dataUrl || null,
      promoters: (branding?.promoters || []).map((p) => p.dataUrl).filter(Boolean), sections,
    };
}
