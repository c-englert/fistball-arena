import { test } from "node:test";
import assert from "node:assert/strict";
import { replay, teamStats, stratify, responsible } from "./mdp.js";

const P = (w, a) => ({ w, a });

test("errors count against the team that made them", () => {
  assert.equal(responsible(P("A", "serviceError")), "B");
  assert.equal(responsible(P("A", "attack")), "A");
});

test("replay: the loser of a point serves the next; sets close at 11 with a 2-point lead", () => {
  const log = [P("A", "attack"), P("B", "setterError"), P("B", "ace")];
  for (let i = 0; i < 10; i++) log.push(P("A", "attack"));
  // 11:2 → set 1 over; next point opens set 2, first serve team B (alternating)
  log.push(P("A", "defenseError"));
  const r = replay({ log });
  assert.equal(r.sets.length, 2);
  assert.deepEqual([r.sets[0].a, r.sets[0].b], [11, 2]);
  assert.deepEqual(r.sets[0].points.slice(0, 3).map((p) => p.server), ["A", "B", "A"]);
  assert.equal(r.sets[1].points[0].server, "B");
  assert.equal(r.current, 1);
  assert.equal(r.nextServer, "B"); // B lost the last point
});

test("replay: manual set end and chosen first serve", () => {
  const r = replay({ log: [P("A", "attack"), { next: true }, P("B", "attack")], serve: { 1: "A" } });
  assert.equal(r.sets.length, 2);
  assert.equal(r.sets[1].points[0].server, "A");
});

test("teamStats: the rows of the MDP sheet", () => {
  // A serves: A ace (A serves again? no — B lost, B serves), B service error (B served, A wins)...
  const pts = replay({ log: [P("A", "ace"), P("A", "serviceError"), P("B", "attack"), P("B", "attackError"), P("A", "defenseError")] }).sets[0].points;
  // servers: A, B (lost p1), B (lost p2), A (lost p3), A (lost p4)
  assert.deepEqual(pts.map((p) => p.server), ["A", "B", "B", "A", "A"]);
  const s = teamStats(pts);
  assert.equal(s.A.played, 5);
  assert.deepEqual([s.A.won, s.A.lost], [3, 2]);
  assert.equal(s.A.services, 3);
  assert.equal(Math.round(s.A.servicesWonPct), 67); // won p1, p5; lost p4
  assert.equal(s.A.aces, 1);
  assert.equal(s.B.serviceErrors, 1);
  assert.equal(s.B.attackWon, 1);
  assert.equal(s.A.attackLost, 1);
  assert.equal(s.A.attackErrors, 1);
  assert.equal(s.B.defenseErrors, 1);
});

test("stratify: share of every action and per-team breakdown", () => {
  const st = stratify([
    { teamA: "X", teamB: "Y", category: "Men", mdp: { log: [P("A", "setterError"), P("A", "setterError"), P("B", "ace"), P("A", "attack"), P("B", "serviceError"), P("A", "setterError")] } },
    { teamA: "X", teamB: "Z", category: "Men", mdp: { log: [] } },
  ]);
  assert.equal(st.games, 1);
  assert.equal(st.points, 6);
  assert.equal(Math.round(st.actions.find((a) => a.key === "setterError").pct), 50);
  const y = st.teams.find((t) => t.team === "Y");
  assert.equal(y.errors.setterError, 3);
  assert.equal(y.wonBy.ace, 1);
  assert.equal(y.games, 1);
});
