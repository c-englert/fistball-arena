import { useState } from "react";
import { GUIDE, UI, LANGS } from "../content/guide.js";

// In-app reference guide with a language switcher. Content lives in
// src/content/guide.js (single source of truth, kept in sync with the app).
export default function Guide() {
  const [lang, setLang] = useState(() => localStorage.getItem("fb_guide_lang") || "pt");
  const pick = (l) => { setLang(l); localStorage.setItem("fb_guide_lang", l); };
  const g = GUIDE[lang] || GUIDE.pt;
  const ui = UI[lang] || UI.pt;
  const html = (s) => ({ dangerouslySetInnerHTML: { __html: s } });

  return (
    <>
      <h2 className="page-h">{ui.heading}</h2>
      <div>
        <div className="lang-bar">
          <span className="filter-label">{ui.lang}</span>
          {LANGS.map((l) => (
            <button key={l.code} className={`filter-pill ${lang === l.code ? "active" : ""}`} onClick={() => pick(l.code)}>{l.label}</button>
          ))}
        </div>

        <div className="card guide">
          <h1 className="guide-title">{g.title}</h1>
          <p className="guide-sub">{g.subtitle}</p>
          <p className="guide-lead" {...html(g.intro)} />

          {g.sections.map((sec, si) => (
            <section key={si} className="guide-section">
              <h2 className="guide-h">{sec.h}</h2>
              {sec.blocks.map((b, bi) => {
                if (b.t === "p") return <p key={bi} className="guide-p" {...html(b.text)} />;
                if (b.t === "note") return <p key={bi} className="guide-note" {...html(b.text)} />;
                if (b.t === "ul") return (
                  <ul key={bi} className="guide-ul">
                    {b.items.map((it, ii) => <li key={ii} {...html(it)} />)}
                  </ul>
                );
                if (b.t === "ol") return (
                  <ol key={bi} className="guide-ol" start={b.start || 1}>
                    {b.items.map((it, ii) => <li key={ii} {...html(it)} />)}
                  </ol>
                );
                if (b.t === "warn") return (
                  <div key={bi} className="guide-warn">
                    <div className="guide-warn-h">⚠ {b.title}</div>
                    {b.items.map((it, ii) => <p key={ii} className="guide-warn-p" {...html(it)} />)}
                  </div>
                );
                return null;
              })}
            </section>
          ))}

          <div className="guide-summary" {...html(g.summary)} />
          <p className="guide-updated">{ui.updated}</p>
        </div>
      </div>
    </>
  );
}
