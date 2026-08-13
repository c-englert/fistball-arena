import { useRef, useState } from "react";
import { parseExcelRoster } from "./importExcel.js";
import { publishRosters, publishReferees } from "../cloud.js";

// Upload an .xlsx (players/staff/referees) with team-name normalization.
// Reused on the Players & staff page and on Event settings.
export default function ExcelImport({ me }) {
  const [excel, setExcel] = useState(null);
  const [names, setNames] = useState({});
  const [status, setStatus] = useState("");
  const fileRef = useRef(null);

  const onExcel = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setStatus("Reading Excel…");
    try {
      const r = await parseExcelRoster(file);
      setExcel(r);
      const map = {};
      // Suggest "Club - Gender" so women's/men's teams of the same club don't collide.
      Object.entries(r.teams).forEach(([k, t]) => (map[k] = t.gender ? `${t.name} - ${t.gender}` : t.name));
      setNames(map);
      const gnote = r.genders?.length ? ` · ${r.genders.join(" + ")}` : "";
      setStatus(`Found ${r.count} people (${r.teamCount} teams${gnote}) + ${r.refereeCount} referees.`);
    } catch (e2) { setStatus("Excel read failed: " + (e2?.message || e2)); }
  };
  const saveExcel = async () => {
    if (!excel) return;
    setStatus("Saving…");
    try {
      const rosters = {};
      for (const [orig, t] of Object.entries(excel.teams)) {
        const finalName = (names[orig] || orig).trim();
        rosters[finalName] = { ...t, name: finalName };
      }
      await publishRosters(rosters);
      if (excel.referees.length) await publishReferees(excel.referees, { replaceAll: true });
      setStatus(`Saved ${excel.count} people + ${excel.refereeCount} referees.`);
      setExcel(null);
    } catch (e) { setStatus("Save failed: " + (e?.message || e)); }
  };

  return (
    <div className="card">
      <div className="row-between">
        <h2 style={{ margin: 0 }}>Import players &amp; staff from Excel</h2>
        <button className="btn primary" onClick={() => fileRef.current?.click()}>Choose .xlsx…</button>
      </div>
      <input ref={fileRef} type="file" accept=".xlsx,.xls" hidden onChange={onExcel} />
      <p className="muted-sm">Upload the event's DATA file (players, staff and referees).</p>

      {excel?.warnings?.length > 0 && <div className="warn-box">{excel.warnings.map((w, i) => <div key={i}>⚠️ {w}</div>)}</div>}

      {excel && (
        <div style={{ marginTop: 8 }}>
          <div className="subhead">Review team names ({Object.keys(excel.teams).length}) — edit to match your schedule</div>
          {Object.entries(excel.teams).map(([orig, t]) => (
            <div className="roster-row" key={orig}>
              <span className="muted-sm" style={{ flex: "0 0 170px", overflow: "hidden", textOverflow: "ellipsis" }} title={orig}>{t.name}</span>
              {t.gender && <span className={`tag ${t.gender === "Female" ? "tag-f" : "tag-m"}`}>{t.gender === "Female" ? "F" : "M"}</span>}
              <span className="muted-sm">→</span>
              <input style={{ flex: 1 }} value={names[orig] ?? orig} onChange={(e) => setNames({ ...names, [orig]: e.target.value })} />
              <span className="tag">{t.players.length}P · {t.staff.length}S</span>
            </div>
          ))}
          {excel.refereeCount > 0 && <p className="muted-sm" style={{ marginTop: 8 }}>+ <b>{excel.refereeCount}</b> referees will be added to the event.</p>}
          <button className="btn primary" style={{ width: "100%", marginTop: 10 }} onClick={saveExcel}>
            Save {excel.count} people{excel.refereeCount ? ` + ${excel.refereeCount} referees` : ""}
          </button>
        </div>
      )}
      {status && <p className="muted-sm" style={{ marginTop: 10 }}>{status}</p>}
    </div>
  );
}
