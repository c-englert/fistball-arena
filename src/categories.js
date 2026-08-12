// Category templates → concrete category names. A template row is
//   { name, sexes: ["men"|"women", …], ages: [label, …] }
// and expands to the cross-product name × age × sex, e.g.
//   { name:"Clubs", sexes:["men","women"], ages:["U18","U14"] }
//   → "Clubs U18 Men", "Clubs U18 Women", "Clubs U14 Men", "Clubs U14 Women"
// The sex word is appended so Fistball Live can split Women/Men (unless the
// base text already states it).

export const COMMON_AGES = ["Master", "U21", "U18", "U16", "U14", "U12"];

// The competition types an event can have (pick one or both).
export const TYPES = [
  { id: "national", label: "National Teams" },
  { id: "clubs", label: "Clubs" },
];
const typeLabel = (id) => (TYPES.find((t) => t.id === id) || {}).label;

export function sexWord(s) { return s === "women" ? "Women" : "Men"; }

// One concrete category name from a base ("Clubs"), an optional age ("U18") and a sex.
export function catName(name, age, sex) {
  const base = [String(name || "").trim(), age && String(age).trim()].filter(Boolean).join(" ");
  const w = sexWord(sex);
  if (/\b(men|women)\b/i.test(base)) return base || w; // base already states the sex
  return base ? `${base} ${w}` : w;
}

// Backward-compat: old rows were { name, gender }.
export function normalizeCategoryRow(row) {
  if (!row) return { name: "", sexes: ["men"], ages: [] };
  if (Array.isArray(row.sexes)) return { name: row.name || "", sexes: row.sexes.length ? row.sexes : ["men"], ages: row.ages || [] };
  return { name: row.name || "", sexes: row.gender ? [row.gender] : ["men"], ages: [] };
}

// One template row → its concrete category names.
export function expandCategory(row) {
  const r = normalizeCategoryRow(row);
  const sexes = r.sexes.length ? r.sexes : ["men"];
  const ages = r.ages.length ? r.ages : [null];
  const out = [];
  for (const age of ages) for (const sex of sexes) out.push(catName(r.name, age, sex));
  return out;
}

// Many template rows → unique concrete category names (blank names skipped).
export function expandCategories(rows) {
  const seen = new Set(), out = [];
  for (const row of rows || []) {
    if (!String(row?.name || "").trim()) continue;
    for (const name of expandCategory(row)) if (!seen.has(name)) { seen.add(name); out.push(name); }
  }
  return out;
}

// Chip-builder model: { types:["national"|"clubs"], sexes:["men"|"women"], ages:[label] }
// → the cross-product type × age × sex as concrete category names.
export function expandBuilder(b) {
  const types = (b?.types || []).map(typeLabel).filter(Boolean);
  const sexes = b?.sexes?.length ? b.sexes : ["men"];
  const ages = b?.ages?.length ? b.ages : [null];
  const seen = new Set(), out = [];
  for (const type of types) for (const age of ages) for (const sex of sexes) {
    const n = catName(type, age, sex);
    if (!seen.has(n)) { seen.add(n); out.push(n); }
  }
  return out;
}
// The event's category source, preferring the chip-builder, then legacy rows.
export function eventCategoryNames(event) {
  if (event?.categoryBuilder) return expandBuilder(event.categoryBuilder);
  return expandCategories(event?.categories || []);
}
