const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// Pretty-print an ISO ("YYYY-MM-DD") start/end range, e.g. "23–26 Jul 2026".
export function formatRange(a, b) {
  const p = (s) => { const m = /(\d{4})-(\d{2})-(\d{2})/.exec(s || ""); return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null; };
  const da = p(a), db = p(b);
  if (da && db) {
    if (da.getFullYear() === db.getFullYear() && da.getMonth() === db.getMonth())
      return `${da.getDate()}–${db.getDate()} ${MON[da.getMonth()]} ${da.getFullYear()}`;
    if (da.getFullYear() === db.getFullYear())
      return `${da.getDate()} ${MON[da.getMonth()]} – ${db.getDate()} ${MON[db.getMonth()]} ${da.getFullYear()}`;
    return `${da.getDate()} ${MON[da.getMonth()]} ${da.getFullYear()} – ${db.getDate()} ${MON[db.getMonth()]} ${db.getFullYear()}`;
  }
  const one = da || db;
  return one ? `${one.getDate()} ${MON[one.getMonth()]} ${one.getFullYear()}` : "";
}
