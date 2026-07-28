// Sample data so the UI is realistic during the usability stage.
// Later this comes from Firestore (seeded from the tournament sheet).

function roster(names) {
  // names: array of [nr, surname, first]
  return names.map(([nr, name, first]) => ({ nr, name, first }));
}

const TEAMS = {
  "Brazil - U18 Men": {
    players: roster([
      [8, "Heidrich Bender", "Lorenzo"],
      [3, "Almeida", "Rafael"],
      [5, "Costa", "Bruno"],
      [7, "Oliveira", "Matheus"],
      [9, "Souza", "Gabriel"],
      [11, "Lima", "Felipe"],
      [1, "Rocha", "Pedro"],
      [4, "Martins", "Lucas"],
    ]),
    captainNr: 8,
    staff: [
      { role: "Head Coach", name: "Heck", first: "Jorge Luiz" },
      { role: "Manager", name: "Ebert", first: "Julio" },
      { role: "Assistant Coach", name: "Azevedo", first: "Isaac" },
    ],
  },
  "Austria - U18 Men": {
    players: roster([
      [1, "Weiß", "Jonas"],
      [2, "Huber", "Elias"],
      [4, "Bauer", "Maximilian"],
      [6, "Wagner", "David"],
      [8, "Gruber", "Tobias"],
      [10, "Steiner", "Lukas"],
      [12, "Moser", "Felix"],
      [5, "Berger", "Paul"],
    ]),
    captainNr: 1,
    staff: [
      { role: "Head Coach", name: "Reinecke", first: "Uta" },
      { role: "Coach", name: "Hübner", first: "Reinhard" },
    ],
  },
  "Germany - U18 M Gold": {
    players: roster([
      [3, "Kern", "Philipp"],
      [5, "Schneider", "Heike"],
      [7, "Fischer", "Jan"],
      [9, "Meyer", "Tim"],
      [11, "Wolf", "Ben"],
      [2, "Schulz", "Nico"],
    ]),
    captainNr: 3,
    staff: [{ role: "Head Coach", name: "Reinecke", first: "Uta" }],
  },
  "Switzerland - U18 M Gold": {
    players: roster([
      [4, "Chollet", "Marc"],
      [6, "Graf", "Daniel"],
      [8, "Sieber", "Patrick"],
      [10, "Frei", "Noah"],
      [1, "Keller", "Luca"],
    ]),
    captainNr: 4,
    staff: [{ role: "Head Coach", name: "Graf", first: "Daniel" }],
  },
};

function team(name) {
  const t = TEAMS[name] || { players: [], captainNr: null, staff: [] };
  return {
    name,
    players: t.players.map((p) => ({ ...p, captain: p.nr === t.captainNr })),
    staff: t.staff || [],
  };
}

export const SEED_MATCHES = [
  {
    id: "m16", nr: 16, date: "23/07/26", time: "10:00", court: "1",
    bestOf: 5, round: "Qualification round", category: "U18 Men",
    teamA: team("Brazil - U18 Men"), teamB: team("Austria - U18 Men"),
  },
  {
    id: "m20", nr: 20, date: "23/07/26", time: "12:30", court: "1",
    bestOf: 5, round: "Qualification round", category: "U18 M Gold",
    teamA: team("Germany - U18 M Gold"), teamB: team("Switzerland - U18 M Gold"),
  },
  {
    id: "m27", nr: 27, date: "23/07/26", time: "15:00", court: "2",
    bestOf: 5, round: "Qualification round", category: "U18 M Gold",
    teamA: team("Switzerland - U18 M Gold"), teamB: team("Germany - U18 M Gold"),
  },
  {
    id: "m35", nr: 35, date: "24/07/26", time: "11:00", court: "1",
    bestOf: 5, round: "Qualification round", category: "U18 M Gold",
    teamA: team("Germany - U18 M Gold"), teamB: team("Switzerland - U18 M Gold"),
  },
  {
    id: "m37", nr: 37, date: "24/07/26", time: "13:15", court: "2",
    bestOf: 5, round: "Qualification round", category: "U18 Men",
    teamA: team("Brazil - U18 Men"), teamB: team("Austria - U18 Men"),
  },
  {
    id: "m52", nr: 52, date: "25/07/26", time: "10:15", court: "1",
    bestOf: 5, round: "4tr finals - 1", category: "U18 Men",
    teamA: team("Germany - U18 M Gold"), teamB: team("Austria - U18 Men"),
  },
];
