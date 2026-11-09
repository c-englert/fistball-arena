import { LANGS, useLang, makeT } from "./i18n.js";

// Screen language (EN / ES / DE / PT) — shared by every page, remembered on this device.
export default function LangPicker({ className = "lang-pick" }) {
  const [lang, setLang] = useLang();
  const t = makeT(lang);
  return (
    <select className={className} value={lang} onChange={(e) => setLang(e.target.value)} title={t("Language")} aria-label={t("Language")}>
      {LANGS.map((l) => <option key={l.code} value={l.code}>{l.label}</option>)}
    </select>
  );
}
