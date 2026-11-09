import { test } from "node:test";
import assert from "node:assert/strict";
import { finalRanking, placeOfRound, genderOf, gameMinutes, durationByBestOf, cardsByCategory, scheduledStart } from "./finalReport.js";

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
