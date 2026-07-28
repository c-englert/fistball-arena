import React from "react";
import ReactPDF from "@react-pdf/renderer";
import { SEED_MATCHES } from "../src/seed.js";
import SumulaPDF from "../src/pdf/SumulaPDF.jsx";

const m = SEED_MATCHES[0]; // Brazil vs Austria

const team = (t, cardIdx) => ({
  name: t.name,
  players: t.players.map((p, i) => ({
    nr: p.nr, name: p.name, first: p.first, captain: !!p.captain, onCourt: true,
    cards: { y: i === cardIdx, yr: false, r: false },
  })),
  staff: t.staff.map((s) => ({ role: s.role, name: s.name, first: s.first, cards: { y: false, yr: false, r: false } })),
});

// rally sequences for two sets
const seq = (a, b) => {
  const r = [];
  const tot = a + b;
  let ca = 0, cb = 0;
  for (let i = 0; i < tot; i++) {
    if (ca < a && (cb >= b || i % 2 === 0)) { r.push("A"); ca++; } else { r.push("B"); cb++; }
  }
  return r;
};

const draft = {
  info: { nr: m.nr, date: m.date, time: m.time, court: m.court, bestOf: m.bestOf, round: m.round, category: m.category },
  teamA: team(m.teamA, 2),
  teamB: team(m.teamB, 0),
  sets: [
    { rallies: seq(12, 14) },
    { rallies: seq(11, 6) },
    { rallies: seq(11, 8) },
    { rallies: [] },
    { rallies: [] },
  ],
  ballChoice: { set1: "B", set5: "A" },
  referees: { r1: "Cornelia Chollet (SUI)", r2: "Philipp Kern (GER)", clerk: "Timo Fluri", a1: "Matthias Wullschleger", a2: "Simon Berglas" },
  remarks: "No incidents.",
  responsible: "Tobias Spaltenberger",
  signatures: { capA: true, capB: true, referee: true },
};

await ReactPDF.renderToFile(React.createElement(SumulaPDF, { draft }), "/tmp/sumula-sample.pdf");
console.log("PDF written to /tmp/sumula-sample.pdf");
