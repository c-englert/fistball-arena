// Weather on the playing days, from Open-Meteo (free, no key): the venue city
// is geocoded from the event's "place" ("Santiago - Chile"), then hourly
// temperature and humidity come from its historical-forecast archive.
// days: playingDays() output. Returns { place, lat, lon, days: [{ key, min, max, avgPlay, humPlay }] } or null.
const pad = (n) => String(n).padStart(2, "0");
export const dayKey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

export async function geocode(place) {
  const parts = String(place || "").split(/\s*[-,·/]\s*/).map((s) => s.trim()).filter(Boolean);
  if (!parts.length) return null;
  const res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(parts[0])}&count=10&language=en`).then((r) => r.json());
  const list = res?.results || [];
  const rest = parts.slice(1).join(" ").toLowerCase();
  const hit = (rest && list.find((x) => rest.includes(String(x.country || "").toLowerCase()) || rest.includes(String(x.country_code || "").toLowerCase()))) || list[0];
  return hit ? { name: [hit.name, hit.country].filter(Boolean).join(", "), lat: hit.latitude, lon: hit.longitude } : null;
}

export async function fetchWeather(place, days) {
  if (!days?.length) return null;
  const loc = await geocode(place);
  if (!loc) return null;
  const keys = days.map((d) => dayKey(d.day));
  const url = `https://historical-forecast-api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}`
    + `&start_date=${keys[0]}&end_date=${keys[keys.length - 1]}&hourly=temperature_2m,relative_humidity_2m&timezone=auto`;
  const h = (await fetch(url).then((r) => r.json()))?.hourly;
  if (!h?.time) return null;
  return {
    place: loc.name, lat: loc.lat, lon: loc.lon,
    days: days.map((d) => {
      const key = dayKey(d.day);
      const from = d.first.getHours(), to = d.last.getHours() + (d.last.getMinutes() ? 1 : 0);
      const all = [], play = [], hum = [];
      h.time.forEach((t, i) => {
        if (!t.startsWith(key) || h.temperature_2m[i] == null) return;
        all.push(h.temperature_2m[i]);
        const hr = Number(t.slice(11, 13));
        if (hr >= from && hr <= to) { play.push(h.temperature_2m[i]); if (h.relative_humidity_2m[i] != null) hum.push(h.relative_humidity_2m[i]); }
      });
      return { key, min: all.length ? Math.min(...all) : null, max: all.length ? Math.max(...all) : null, avgPlay: avg(play), humPlay: avg(hum) };
    }),
  };
}
