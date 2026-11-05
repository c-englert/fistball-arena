import { test } from "node:test";
import assert from "node:assert/strict";
import { teamPlans, officialPlans, planDays, refSchedule } from "./plans.js";

const D1 = "12/09/26", D2 = "13/09/26";
let nr = 0;
const game = (a, b, date, time, court, over = {}) => ({ id: `g${++nr}`, nr, date, time, court, category: "Men", round: "Qualification round", teamA: { name: a }, teamB: { name: b }, refs: {}, kit: {}, ...over });

test("teamPlans: per team and category, in time order, with the uniform worn; placeholders skipped", () => {
  const tk = { "X · Men": [{ colors: ["#e23b3b"] }, { colors: ["#ffffff", "#1a1a1a"] }], Y: [{ shirt: "#2f6df0" }] };
  const g1 = game("X", "Y", D1, "10:00", 1, { kit: { A: 2, B: 1 } });
  const g2 = game("Y", "X", D1, "09:00", 2, { kit: { A: 1 } });
  const g3 = game("Winner Semifinal 1", "X", D2, "09:00", 1, { round: "Gold medal match" });
  const g4 = game("X", "Z", D1, "11:00", 1, { category: "Women" });
  const plans = teamPlans([g1, g2, g3, g4], tk);
  assert.deepEqual(plans.map((p) => p.key), ["X · Men", "X · Women", "Y · Men", "Z · Women"]);
  const x = plans[0];
  assert.deepEqual(x.rows.map((r) => r.g.id), [g2.id, g1.id, g3.id]);
  assert.deepEqual(x.rows[1].kit.colors, ["#ffffff", "#1a1a1a"]); // uniform 2 in g1 (striped)
  assert.equal(x.rows[0].kit, null);            // not set in g2
  assert.equal(x.rows[1].opponent.name, "Y");
  assert.deepEqual(planDays([g1, g2, g3]), [D1, D2]);
});

test("officialPlans: every round of the day, free rounds, one line for a court manager on several courts, shirt colours", () => {
  const refKits = [{ id: "m", name: "Mint", shirt: "#3eb489" }];
  const refs = [{ first: "Ann", name: "Ref" }, { first: "Cm", name: "Man" }];
  const gs = [
    game("A", "B", D1, "09:00", 1, { refs: { r1: "Ann Ref", cm: "Cm Man" }, kit: { R: "m" } }),
    game("C", "D", D1, "09:00", 2, { refs: { cm: "Cm Man" } }),
    game("A", "C", D1, "10:00", 1, { refs: { r2: "Other Person" } }),
    game("B", "D", D1, "11:00", 1, { refs: { a1: "Ann Ref" } }),
    game("A", "D", D2, "09:00", 1, { refs: { r1: "Ann Ref" } }),
  ];
  const { rounds, plans } = officialPlans(gs, refs, refKits, D1);
  assert.deepEqual(rounds, ["09:00", "10:00", "11:00"]);
  assert.deepEqual(plans.map((p) => p.name), ["Ann Ref", "Cm Man", "Other Person"]); // + names outside the registry
  const ann = plans[0];
  assert.equal(ann.onDuty, 2);
  assert.deepEqual(ann.rows.map((r) => r.duties.map((d) => d.slot)), [["r1"], [], ["a1"]]);
  assert.deepEqual(ann.rows[0].duties[0].shirts.map((r) => r.name), ["Mint"]);
  const cm = plans[1].rows[0].duties;
  assert.equal(cm.length, 1);
  assert.deepEqual(cm[0].courts, [1, 2]);
});

test("refSchedule: by day + round, filtered by day and/or court", () => {
  const gs = [game("A", "B", D1, "10:00", 3), game("C", "D", D1, "10:00", 1), game("E", "F", D1, "09:00", 3), game("G", "H", D2, "09:00", 3)];
  const day1 = refSchedule(gs, D1);
  assert.deepEqual(day1.map((r) => [r.time, r.games.map((g) => g.court)]), [["09:00", [3]], ["10:00", [1, 3]]]);
  const court3 = refSchedule(gs, "all", "3");
  assert.deepEqual(court3.map((r) => [r.date, r.time]), [[D1, "09:00"], [D1, "10:00"], [D2, "09:00"]]);
  assert.equal(refSchedule(gs, D2, "1").length, 0);
});
