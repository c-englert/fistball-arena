import { Document, Page, View, Text, StyleSheet } from "@react-pdf/renderer";

const PURPLE = "#3a2d6b", LINE = "#8a90a2", LIGHT = "#eceef3";
const s = StyleSheet.create({
  page: { padding: 24, fontSize: 8, fontFamily: "Helvetica", color: "#111" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold", color: PURPLE },
  sub: { fontSize: 9, color: "#555", marginTop: 2, marginBottom: 6 },
  dayHead: { fontSize: 10, fontFamily: "Helvetica-Bold", backgroundColor: PURPLE, color: "#fff", padding: 4, marginTop: 10 },
  thead: { flexDirection: "row", backgroundColor: LIGHT, borderBottomWidth: 1, borderColor: LINE },
  tr: { flexDirection: "row", borderBottomWidth: 0.5, borderColor: LINE, minHeight: 15, alignItems: "center" },
  th: { fontFamily: "Helvetica-Bold", padding: 3, fontSize: 7 },
  td: { padding: 3, fontSize: 8 },
  cNr: { width: 26 }, cTime: { width: 34 }, cCourt: { width: 44 }, cCat: { width: 96 }, cTeams: { flex: 1 }, cRound: { width: 92 },
  foot: { position: "absolute", bottom: 14, left: 24, right: 24, fontSize: 7, color: "#888", textAlign: "center" },
});

const parseD = (v) => { const [d, m, y] = String(v || "").split("/").map(Number); return d ? (y || 0) * 10000 + (m || 0) * 100 + d : 0; };
const toMin = (t) => { const [h, mm] = String(t || "").split(":").map(Number); return (h || 0) * 60 + (mm || 0); };
const dayLabel = (v) => {
  const [dd, mm, yy] = String(v || "").split("/").map(Number);
  if (!dd) return v || "—";
  return new Date(2000 + (yy || 0), (mm || 1) - 1, dd).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
};
// A team may carry a short/display name; fall back to the full name.
const nm = (t) => (t?.short || t?.name || t || "");

export default function SchedulePDF({ games = [], event }) {
  const list = [...games]
    .filter((g) => g.teamA && g.teamB)
    .sort((a, b) => parseD(a.date) - parseD(b.date) || toMin(a.time) - toMin(b.time)
      || String(a.court || "").localeCompare(String(b.court || ""), undefined, { numeric: true }) || (a.nr - b.nr));

  const days = [];
  const idx = new Map();
  for (const g of list) {
    const k = g.date || "—";
    if (!idx.has(k)) { idx.set(k, days.length); days.push({ date: k, items: [] }); }
    days[idx.get(k)].items.push(g);
  }

  return (
    <Document>
      <Page size="A4" style={s.page}>
        <Text style={s.title}>{event?.name || "Game schedule"}</Text>
        <Text style={s.sub}>{[event?.place, event?.dates].filter(Boolean).join("  ·  ")}{list.length ? `  ·  ${list.length} games` : ""}</Text>

        {list.length === 0 && <Text style={{ marginTop: 20 }}>No games to show.</Text>}

        {days.map((day) => (
          <View key={day.date}>
            <Text style={s.dayHead}>{dayLabel(day.date)}  ·  {day.items.length} games</Text>
            <View style={s.thead} fixed>
              <Text style={[s.th, s.cNr]}>#</Text>
              <Text style={[s.th, s.cTime]}>Time</Text>
              <Text style={[s.th, s.cCourt]}>Court</Text>
              <Text style={[s.th, s.cCat]}>Category</Text>
              <Text style={[s.th, s.cTeams]}>Match</Text>
              <Text style={[s.th, s.cRound]}>Round</Text>
            </View>
            {day.items.map((g) => (
              <View key={g.nr} style={s.tr} wrap={false}>
                <Text style={[s.td, s.cNr]}>{g.nr}</Text>
                <Text style={[s.td, s.cTime]}>{g.time || "—"}</Text>
                <Text style={[s.td, s.cCourt]}>{g.court ? `Court ${g.court}` : "—"}</Text>
                <Text style={[s.td, s.cCat]}>{g.category}</Text>
                <Text style={[s.td, s.cTeams]}>{nm(g.teamA)}  vs  {nm(g.teamB)}</Text>
                <Text style={[s.td, s.cRound]}>{g.round}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text style={s.foot} fixed render={({ pageNumber, totalPages }) => `${event?.name || ""}  —  page ${pageNumber} / ${totalPages}`} />
      </Page>
    </Document>
  );
}
