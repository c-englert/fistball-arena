import { test } from "node:test";
import assert from "node:assert/strict";
import { finalRanking, placeOfRound, genderOf, gameMinutes, durationByBestOf, cardsByCategory, scheduledStart, formatOf, playingDays, stageOf, medalGames } from "./finalReport.js";

const R = (round, a, b, sa, sb, over = {}) => ({ round, teamA: a, teamB: b, setsA: sa, setsB: sb, pointsA: sa * 11, pointsB: sb * 11, status: "Finished", ...over });

test("placeOfRound", () => {
  assert.equal(placeOfRound("Gold medal match"), 1);
  assert.equal(placeOfRound("Bronze medal match"), 3);
  assert.equal(placeOfRound("Placement 5-6"), 5);
  assert.equal(placeOfRound("Placement 11-12"), 11);
  assert.equal(placeOfRound("Placement 7-9"), null);
  assert.equal(placeOfRound("Semifinal 1"), null);
  assert.equal(placeOfRound("Quarterfinal"), null);
});

test("genderOf: women before men", () => {
  assert.equal(genderOf("National Teams Women"), "Women");
  assert.equal(genderOf("Clubs Men"), "Men");
  assert.equal(genderOf("U18 W Gold"), "Women");
  assert.equal(genderOf("Mixed"), "Other");
});

test("finalRanking: medal games fix places; quarterfinal loser takes 5th", () => {
  const res = [
    R("Qualification round", "A", "B", 2, 0), R("Qualification round", "A", "C", 2, 0), R("Qualification round", "A", "D", 2, 0), R("Qualification round", "A", "E", 2, 0),
    R("Qualification round", "B", "C", 2, 0), R("Qualification round", "B", "D", 2, 0), R("Qualification round", "B", "E", 2, 0),
    R("Qualification round", "C", "D", 2, 0), R("Qualification round", "C", "E", 2, 0), R("Qualification round", "D", "E", 2, 1),
    R("Quarterfinal", "D", "E", 2, 1),
    R("Semifinal 1", "A", "D", 2, 0), R("Semifinal 2", "B", "C", 2, 1),
    R("Bronze medal match", "D", "C", 0, 2), R("Gold medal match", "A", "B", 1, 3),
    R("Qualification round", "Winner X", "E", 0, 0, { status: "Not Started" }),
  ];
  const r = finalRanking(res);
  assert.deepEqual(r.rows.map((x) => x.team), ["B", "A", "C", "D", "E"]);
  assert.equal(r.decided, true);
  assert.equal(r.complete, true);
});

test("finalRanking: undecided while the final is open", () => {
  const r = finalRanking([R("Semifinal 1", "A", "B", 2, 0), R("Gold medal match", "A", "C", 0, 0, { status: "Not Started" })]);
  assert.equal(r.decided, false);
  assert.equal(r.complete, false);
});

test("gameMinutes: measured from timing, else plausible estimate", () => {
  assert.deepEqual(gameMinutes({ timing: { start: 1000, end: 1000 + 45 * 60000 } }, {}), { minutes: 45, measured: true });
  const st = scheduledStart("04/11/26", "10:40").getTime();
  assert.deepEqual(gameMinutes({ submittedAt: st + 50 * 60000 }, { date: "04/11/26", time: "10:40" }), { minutes: 50, measured: false });
  assert.equal(gameMinutes({ submittedAt: st + 400 * 60000 }, { date: "04/11/26", time: "10:40" }), null);
  assert.equal(gameMinutes({}, { date: "04/11/26", time: "10:40" }), null);
});

test("durationByBestOf and cardsByCategory", () => {
  const d = durationByBestOf([
    { bestOf: 3, length: { minutes: 40, measured: true } }, { bestOf: 3, length: { minutes: 50, measured: true } },
    { bestOf: 5, length: { minutes: 70, measured: false } }, { bestOf: 5, length: null },
  ]);
  assert.deepEqual(d, [
    { bestOf: 3, games: 2, measured: { n: 2, avg: 45 }, estimated: { n: 0, avg: null } },
    { bestOf: 5, games: 2, measured: { n: 0, avg: null }, estimated: { n: 1, avg: 70 } },
  ]);
  const c = cardsByCategory([{ category: "M", cards: [{ category: "M", y: 1, yr: 0, r: 0 }, { category: "M", y: 1, yr: 1, r: 0 }] }]);
  assert.deepEqual(c, { M: { y: 2, yr: 1, r: 0 } });
});

test("formatOf: groups, round robin and knockout stages", () => {
  const rr = (g, ts, bo) => ts.flatMap((a, i) => ts.slice(i + 1).map((b) => ({ round: "Qualification round", group: g, teamA: a, teamB: b, bestOf: bo })));
  const res = [...rr("A", ["a", "b", "c", "d"], 3), ...rr("B", ["e", "f", "g", "h"], 3)].map((r, i) => ({ ...r, nr: i + 1 }));
  res.push({ nr: 20, round: "Semifinal 1", teamA: "a", teamB: "f", bestOf: 5 }, { nr: 21, round: "Semifinal 2", teamA: "e", teamB: "b", bestOf: 5 },
    { nr: 22, round: "Placement 5-6", teamA: "c", teamB: "g", bestOf: 5 }, { nr: 23, round: "Gold medal match", teamA: "a", teamB: "e", bestOf: 5 });
  const f = formatOf(res);
  assert.equal(f.teams, 8);
  assert.equal(f.games, 16);
  assert.deepEqual(f.groups.map((g) => [g.label, g.teams, g.games, g.double]), [["A", 4, 6, false], ["B", 4, 6, false]]);
  assert.deepEqual(f.groupBestOf, [3]);
  assert.deepEqual(f.stages.map((x) => [x.stage, x.games, x.placement]), [["Semifinal", 2, false], ["Gold medal match", 1, false], ["Placement 5-6", 1, true]]);
  assert.deepEqual(f.koBestOf, [5]);
  assert.equal(stageOf("Quarterfinal 3"), "Quarterfinal");
});

test("playingDays: window per day from first start to last end", () => {
  const end = new Date(2026, 10, 4, 18, 10).getTime();
  const d = playingDays([
    { date: "04/11/26", time: "09:00", court: "1", minutes: 50 },
    { date: "04/11/26", time: "17:00", court: "2", minutes: 50, end },
    { date: "05/11/26", time: "10:00", court: "1", minutes: 40 },
  ]);
  assert.equal(d.length, 2);
  assert.deepEqual(d[0].courts, ["1", "2"]);
  assert.equal(d[0].games, 2);
  assert.equal(d[0].minutes, 9 * 60 + 10);
  assert.equal(d[1].minutes, 40);
});

test("medalGames: gold before bronze, with set scores", () => {
  const m = [
    { round: "Bronze medal match", status: "Finished", teamA: "x", teamB: "y", setsA: 3, setsB: 1, sets: [{ a: 11, b: 4 }, { a: 7, b: 11 }, { a: 11, b: 8 }, { a: 11, b: 1 }, { a: 0, b: 0 }] },
    { round: "Gold medal match", status: "Finished", teamA: "a", teamB: "b", setsA: 0, setsB: 3, sets: [{ a: 8, b: 11 }, { a: 5, b: 11 }, { a: 7, b: 11 }] },
    { round: "Semifinal 1", status: "Finished", teamA: "a", teamB: "x", setsA: 3, setsB: 0 },
    { round: "Gold medal match", status: "Scheduled", teamA: "c", teamB: "d" },
  ];
  const g = medalGames(m);
  assert.deepEqual(g.map((x) => x.round), ["Gold medal match", "Bronze medal match"]);
  assert.deepEqual(g[1].sets, ["11/4", "7/11", "11/8", "11/1"]);
});
