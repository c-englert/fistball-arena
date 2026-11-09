import { LANGS, useLang } from "./i18n.js";

// Screen language (EN / ES / DE / PT) — shared by every page, remembered on this device.
export default function LangPicker({ className = "lang-pick" }) {
  const [lang, setLang] = useLang();
  return (
    <select className={className} value={lang} onChange={(e) => setLang(e.target.value)} title="Language" aria-label="Language">
      {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
    </select>
  );
}
