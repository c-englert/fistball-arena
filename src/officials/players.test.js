import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAssignments } from "./rules.js";
import { autoAssign } from "./assign.js";

// Player-referees: o.playsFor lists their teams; they never officiate while
// one of those teams plays (the same game or another court at that time).
const D = "29/10/26";
const pr = { first: "Pia", name: "Player", country: "Chile", roles: ["referee"], playsFor: ["CD Manquehue"] };
const ref = { first: "Rolf", name: "Ref", country: "Germany", roles: ["referee"] };
const g = (id, nr, time, court, a, b, refs = {}) => ({
  id, nr, date: D, time, court, category: "Clubs Women", round: "Qualification round",
  teamA: { name: a }, teamB: { name: b }, refs,
});

test("player-referee: hard conflict in own team's game", () => {
  const games = [g("g1", 1, "09:00", 1, "CD Manquehue", "Pumas", { r1: "Pia Player" })];
  const res = checkAssignments(games, [pr, ref], []);
  assert.ok(res.list.some((i) => i.code === "plays" && i.level === "hard" && /in this game/.test(i.msg)));
});

test("player-referee: hard conflict while own team plays on another court", () => {
  const games = [
    g("g1", 1, "09:00", 1, "CD Manquehue", "Pumas"),
    g("g2", 2, "09:00", 2, "SOGIPA", "Saman", { r1: "Pia Player" }),
  ];
  const res = checkAssignments(games, [pr, ref], []);
  assert.ok(res.list.some((i) => i.gameId === "g2" && i.code === "plays" && /game #1/.test(i.msg)));
});

test("player-referee: fine when own team doesn't play at that time", () => {
  const games = [
    g("g1", 1, "09:00", 1, "CD Manquehue", "Pumas"),
    g("g2", 2, "10:00", 2, "SOGIPA", "Saman", { r1: "Pia Player" }),
  ];
  const res = checkAssignments(games, [pr, ref], []);
  assert.ok(!res.list.some((i) => i.code === "plays"));
});

test("auto-assign never puts a player-referee on while their team plays", () => {
  const games = [
    g("g1", 1, "09:00", 1, "CD Manquehue", "Pumas"),
    g("g2", 2, "09:00", 2, "SOGIPA", "Saman"),
  ];
  const out = autoAssign(games, [pr, ref], [], { rules: { r2: "finals" } });
  const all = JSON.stringify(out);
  assert.ok(!all.includes("Pia Player"), all);
});
