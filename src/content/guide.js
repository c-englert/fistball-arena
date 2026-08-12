// In-app reference guide: "Create an event & build the games".
// SINGLE SOURCE OF TRUTH — keep this in sync whenever event creation, the
// schedule generator, imports, the Live publish flow or the súmula flow change.
// Rendered by src/pages/Guide.jsx (language switcher). Inline <b>…</b> allowed.
//
// Shape per language:
//   { title, subtitle, intro, sections: [{ h, blocks: [...] }], summary }
// Block kinds: { t:"p"|"note", text } | { t:"ol", start, items } |
//              { t:"ul", items } | { t:"warn", title, items }

export const LANGS = [
  { code: "pt", label: "Português" },
  { code: "en", label: "English" },
  { code: "es", label: "Español" },
  { code: "de", label: "Deutsch" },
];

export const UI = {
  pt: { menu: "Guia", heading: "Guia", sub: "Criar um evento e montar os jogos", back: "‹ Voltar", lang: "Idioma", updated: "Atualizado conforme as mudanças no app." },
  en: { menu: "Guide", heading: "Guide", sub: "Create an event & build the games", back: "‹ Back", lang: "Language", updated: "Kept in sync with app changes." },
  es: { menu: "Guía", heading: "Guía", sub: "Crear un evento y armar los partidos", back: "‹ Volver", lang: "Idioma", updated: "Se mantiene al día con los cambios del app." },
  de: { menu: "Anleitung", heading: "Anleitung", sub: "Event anlegen und Spiele aufbauen", back: "‹ Zurück", lang: "Sprache", updated: "Wird mit App-Änderungen aktuell gehalten." },
};

export const GUIDE = {
  /* ------------------------------- PORTUGUÊS ------------------------------- */
  pt: {
    title: "Criar um evento e montar os jogos",
    subtitle: "Da criação do evento até as partidas finais",
    intro: "Este guia descreve, na ordem correta, como criar um novo evento no Fistball Arena, cadastrar times e pessoas, montar a estrutura de jogos (fase de grupos + eliminatórias) e publicar tudo no Fistball Live.",
    sections: [
      { h: "Parte A — Criar o evento", blocks: [
        { t: "ol", start: 1, items: [
          'Na lista de eventos, clique em <b>“New event”</b> (visível só para org-admins).',
          'Preencha <b>Name</b> (ex.: “2027 U18 World Championship”), <b>Place</b> (ex.: “Jona · Switzerland”) e as <b>datas</b> pelo seletor de intervalo (início e fim).',
          'Confirme. O evento é criado, abre automaticamente e nasce com status <b>active</b>.',
        ] },
        { t: "note", text: 'Dica: logo após criar, abra <b>Manage ▾ → Settings → Categories</b> e marque os chips — <b>tipo</b> (National Teams/Clubs), <b>sexo</b> (Men/Women) e <b>idade</b> opcional (U18, U14…). O app cria todas as categorias (tipo × idade × sexo) antes do Excel, e elas já entram pré-preenchidas no gerador de Schedule.' },
      ] },
      { h: "Parte B — Cadastrar times e pessoas (recomendado antes dos jogos)", blocks: [
        { t: "p", text: 'No menu <b>“Manage ▾”</b> (canto superior direito, dentro do evento):' },
        { t: "ol", start: 4, items: [
          '<b>Players &amp; staff</b> → importe o elenco pelo <b>Excel</b> (arquivo “…DATA.xlsx”): traz jogadores, staff e árbitros de uma vez, com uma tela de revisão dos nomes dos times. É a forma padrão para um evento novo.',
          '<b>Access</b> → autorize quem vai pontuar por e-mail, com papel <b>admin / official / viewer</b>. Também dá pra autorizar direto pelo card da pessoa (“Give access”).',
          '(opcional) <b>Settings → Event logos</b> → suba o logo do evento e dos patrocinadores.',
        ] },
        { t: "note", text: '<b>Alternativa (legado):</b> a opção <b>DB sheet</b> (aba “DB” de uma planilha Google) na mesma tela existe só para quando o elenco já vive numa planilha — o fluxo antigo. Para um evento novo, use o Excel.' },
        { t: "note", text: 'Em qualquer caso, o cadastro é guardado <b>por nome do time</b>. Use exatamente os mesmos nomes no gerador de jogos — assim as súmulas já vêm com as escalações preenchidas.' },
      ] },
      { h: "Parte C — Montar a estrutura de jogos", blocks: [
        { t: "p", text: '<b>Manage ▾ → Schedule.</b> O gerador tem 4 passos (abas no topo):' },
        { t: "ol", start: 7, items: [
          '<b>Groups</b> — para cada categoria (ex.: “U18 Men”): dê o nome da categoria, crie os grupos (<b>+ Add group</b> → A, B, …) e adicione os times de cada grupo.',
          '<b>Format</b> — por categoria: <b>Best of</b> (1/3/5); <b>Qualifiers per group</b> (1 ou 2 — quantos avançam de cada grupo); <b>Double round-robin</b> (ida e volta, opcional); <b>Generate knockout bracket</b> (marque para gerar as eliminatórias).',
          '<b>Slots</b> — quadras, dias, horário inicial, duração do slot, slots por dia e o <b>First match #</b>. Isso distribui os jogos em horários/quadras automaticamente.',
          'Clique em <b>“Save setup”</b> quando quiser (salva a configuração; ela recarrega se você voltar depois).',
          '<b>Preview &amp; Publish → Generate</b>: monta a lista completa (grupos + eliminatórias) e mostra quantos jogos gerou.',
          'Marque <b>Replace all</b> (na primeira vez) e clique em <b>Publish → confirme</b>. Os jogos aparecem na lista do evento.',
        ] },
      ] },
      { h: "Parte D — Como as finais são geradas", blocks: [
        { t: "p", text: 'Com <b>“Generate knockout bracket”</b> marcado, o gerador cria as fases finais a partir dos classificados, como um <b>esqueleto de chave</b>:' },
        { t: "ul", items: [
          '<b>2 grupos × 2 classificados</b> → Semifinal 1, Semifinal 2, disputa de 3º (Bronze) e Final',
          '2 grupos × 1 → Final direta',
          '4 grupos × 2 (ou × 1) → Quartas → Semis → Bronze → Final',
          '1 grupo → Final (1º×2º) + disputa de 3º (3º×4º)',
        ] },
        { t: "warn", title: "Duas ressalvas importantes", items: [
          'As partidas eliminatórias nascem com <b>rótulos de posição</b>, não times reais (“1st Group A”, “Winner SF1”, “Loser SF2”). <b>Hoje o app não preenche automaticamente</b> o vencedor da semi na final — esse avanço ainda é manual. O Live mostra a estrutura da chave; o time real só entra quando definido.',
          'O <b>“Qualifiers per group” só vai até 2</b> e <b>nomear grupos</b> (ex.: “Semi-finals”) ainda não existe — são as duas melhorias pendentes.',
        ] },
        { t: "note", text: 'Para as finais funcionarem com <b>times reais e súmula/placar</b>, o caminho sólido hoje é montar a chave já com os times definidos, ou importar de uma planilha que já tenha as finais preenchidas. O auto-bracket serve como esqueleto/visualização.' },
      ] },
      { h: "Parte E — Publicar no Fistball Live", blocks: [
        { t: "ol", start: 13, items: [
          '<b>Manage ▾ → Settings → Fistball Live</b> → publique este evento no Live. Isso define o ponteiro público que o app espectador segue. Se o evento ainda não começou, o Live mostra um <b>countdown</b>.',
        ] },
      ] },
      { h: "Parte F — Durante o torneio", blocks: [
        { t: "ol", start: 14, items: [
          'Cada official abre um jogo na lista → preenche a <b>súmula</b> (escalações pré-preenchidas se os rosters foram importados), marca rallies/sets e cartões, e <b>submete</b>.',
          'A cada save/submit o placar e os cartões vão para o Live automaticamente (standings, chave e aba <b>Cards</b>).',
          'Ao fim, em <b>Settings</b> você pode <b>arquivar</b> o evento (vira somente-leitura).',
        ] },
      ] },
    ],
    summary: "<b>Resumo do fluxo:</b> New event → Players &amp; staff (importar) → Access → Schedule (Groups → Format → Slots → Generate → Publish) → Settings (publicar no Live) → pontuar as súmulas.",
  },

  /* -------------------------------- ENGLISH ------------------------------- */
  en: {
    title: "Create an event & build the games",
    subtitle: "From creating the event to the final matches",
    intro: "This guide describes, in the right order, how to create a new event in Fistball Arena, register teams and people, build the game structure (group stage + knockout) and publish everything to Fistball Live.",
    sections: [
      { h: "Part A — Create the event", blocks: [
        { t: "ol", start: 1, items: [
          'On the events list, click <b>“New event”</b> (visible only to org-admins).',
          'Fill in <b>Name</b> (e.g. “2027 U18 World Championship”), <b>Place</b> (e.g. “Jona · Switzerland”) and the <b>dates</b> using the range picker (start and end).',
          'Confirm. The event is created, opens automatically and starts with status <b>active</b>.',
        ] },
        { t: "note", text: 'Tip: right after creating, open <b>Manage ▾ → Settings → Categories</b> and mark the chips — <b>type</b> (National Teams/Clubs), <b>sex</b> (Men/Women) and optional <b>age</b> (U18, U14…). The app builds every category (type × age × sex) before the Excel, and they are pre-filled into the Schedule generator.' },
      ] },
      { h: "Part B — Register teams and people (recommended before the games)", blocks: [
        { t: "p", text: 'From the <b>“Manage ▾”</b> menu (top-right, inside the event):' },
        { t: "ol", start: 4, items: [
          '<b>Players &amp; staff</b> → import the squad via <b>Excel</b> (the “…DATA.xlsx” file): it brings players, staff and referees at once, with a team-name review screen. This is the standard way for a new event.',
          '<b>Access</b> → authorize who will score, by email, with role <b>admin / official / viewer</b>. You can also authorize straight from a person’s card (“Give access”).',
          '(optional) <b>Settings → Event logos</b> → upload the event and sponsor logos.',
        ] },
        { t: "note", text: '<b>Alternative (legacy):</b> the <b>DB sheet</b> option (the “DB” tab of a Google Sheet) on the same screen exists only when the squad already lives in a spreadsheet — the old workflow. For a new event, use Excel.' },
        { t: "note", text: 'Either way, the registry is keyed <b>by team name</b>. Use the exact same names in the schedule generator — that way the game reports come pre-filled with the line-ups.' },
      ] },
      { h: "Part C — Build the game structure", blocks: [
        { t: "p", text: '<b>Manage ▾ → Schedule.</b> The generator has 4 steps (tabs at the top):' },
        { t: "ol", start: 7, items: [
          '<b>Groups</b> — for each category (e.g. “U18 Men”): set the category name, create the groups (<b>+ Add group</b> → A, B, …) and add each group’s teams.',
          '<b>Format</b> — per category: <b>Best of</b> (1/3/5); <b>Qualifiers per group</b> (1 or 2 — how many advance from each group); <b>Double round-robin</b> (home &amp; away, optional); <b>Generate knockout bracket</b> (tick to generate the knockout).',
          '<b>Slots</b> — courts, days, start time, slot length, slots per day and the <b>First match #</b>. This places the games into times/courts automatically.',
          'Click <b>“Save setup”</b> whenever you like (it saves the configuration; it reloads if you come back later).',
          '<b>Preview &amp; Publish → Generate</b>: builds the full list (groups + knockout) and shows how many games it produced.',
          'Tick <b>Replace all</b> (the first time) and click <b>Publish → confirm</b>. The games appear in the event’s list.',
        ] },
      ] },
      { h: "Part D — How the finals are generated", blocks: [
        { t: "p", text: 'With <b>“Generate knockout bracket”</b> ticked, the generator builds the final rounds from the qualifiers, as a <b>bracket skeleton</b>:' },
        { t: "ul", items: [
          '<b>2 groups × 2 qualifiers</b> → Semifinal 1, Semifinal 2, Bronze match and Final',
          '2 groups × 1 → straight Final',
          '4 groups × 2 (or × 1) → Quarterfinals → Semis → Bronze → Final',
          '1 group → Final (1st×2nd) + Bronze match (3rd×4th)',
        ] },
        { t: "warn", title: "Two important caveats", items: [
          'The knockout matches are created with <b>position placeholders</b>, not real teams (“1st Group A”, “Winner SF1”, “Loser SF2”). <b>The app does not fill the semifinal winner into the final automatically yet</b> — that advancement is still manual. The Live shows the bracket structure; the real team only appears once defined.',
          '<b>“Qualifiers per group” only goes up to 2</b>, and <b>naming groups</b> (e.g. “Semi-finals”) does not exist yet — these are the two pending improvements.',
        ] },
        { t: "note", text: 'For the finals to work with <b>real teams and reports/scores</b>, the solid path today is to build the bracket with the teams already defined, or import from a spreadsheet that already has the finals filled in. The auto-bracket serves as a skeleton/visualization.' },
      ] },
      { h: "Part E — Publish to Fistball Live", blocks: [
        { t: "ol", start: 13, items: [
          '<b>Manage ▾ → Settings → Fistball Live</b> → publish this event to the Live. This sets the public pointer the spectator app follows. If the event hasn’t started, the Live shows a <b>countdown</b>.',
        ] },
      ] },
      { h: "Part F — During the tournament", blocks: [
        { t: "ol", start: 14, items: [
          'Each official opens a game from the list → fills in the <b>report</b> (line-ups pre-filled if the rosters were imported), logs rallies/sets and cards, and <b>submits</b>.',
          'On every save/submit the score and cards go to the Live automatically (standings, bracket and the <b>Cards</b> tab).',
          'At the end, in <b>Settings</b> you can <b>archive</b> the event (it becomes read-only).',
        ] },
      ] },
    ],
    summary: "<b>Flow summary:</b> New event → Players &amp; staff (import) → Access → Schedule (Groups → Format → Slots → Generate → Publish) → Settings (publish to Live) → score the reports.",
  },

  /* -------------------------------- ESPAÑOL ------------------------------- */
  es: {
    title: "Crear un evento y armar los partidos",
    subtitle: "Desde la creación del evento hasta las finales",
    intro: "Esta guía describe, en el orden correcto, cómo crear un nuevo evento en Fistball Arena, registrar equipos y personas, armar la estructura de partidos (fase de grupos + eliminatorias) y publicar todo en Fistball Live.",
    sections: [
      { h: "Parte A — Crear el evento", blocks: [
        { t: "ol", start: 1, items: [
          'En la lista de eventos, haz clic en <b>“New event”</b> (visible solo para org-admins).',
          'Completa <b>Name</b> (ej.: “2027 U18 World Championship”), <b>Place</b> (ej.: “Jona · Switzerland”) y las <b>fechas</b> con el selector de rango (inicio y fin).',
          'Confirma. El evento se crea, se abre automáticamente y nace con estado <b>active</b>.',
        ] },
        { t: "note", text: 'Consejo: justo después de crear, abre <b>Manage ▾ → Settings → Categories</b> y marca los chips — <b>tipo</b> (National Teams/Clubs), <b>sexo</b> (Men/Women) y <b>edad</b> opcional (U18, U14…). La app crea todas las categorías (tipo × edad × sexo) antes del Excel, y se precargan en el generador de Schedule.' },
      ] },
      { h: "Parte B — Registrar equipos y personas (recomendado antes de los partidos)", blocks: [
        { t: "p", text: 'En el menú <b>“Manage ▾”</b> (arriba a la derecha, dentro del evento):' },
        { t: "ol", start: 4, items: [
          '<b>Players &amp; staff</b> → importa el plantel con <b>Excel</b> (el archivo “…DATA.xlsx”): trae jugadores, cuerpo técnico y árbitros de una vez, con una pantalla de revisión de los nombres de los equipos. Es la forma estándar para un evento nuevo.',
          '<b>Access</b> → autoriza quién va a puntuar, por correo, con rol <b>admin / official / viewer</b>. También puedes autorizar desde la ficha de la persona (“Give access”).',
          '(opcional) <b>Settings → Event logos</b> → sube el logo del evento y de los patrocinadores.',
        ] },
        { t: "note", text: '<b>Alternativa (heredada):</b> la opción <b>DB sheet</b> (la pestaña “DB” de una hoja de Google) en la misma pantalla existe solo cuando el plantel ya vive en una planilla — el flujo antiguo. Para un evento nuevo, usa Excel.' },
        { t: "note", text: 'En cualquier caso, el registro se guarda <b>por nombre del equipo</b>. Usa exactamente los mismos nombres en el generador de partidos — así las planillas ya vienen con las alineaciones precargadas.' },
      ] },
      { h: "Parte C — Armar la estructura de partidos", blocks: [
        { t: "p", text: '<b>Manage ▾ → Schedule.</b> El generador tiene 4 pasos (pestañas arriba):' },
        { t: "ol", start: 7, items: [
          '<b>Groups</b> — para cada categoría (ej.: “U18 Men”): pon el nombre de la categoría, crea los grupos (<b>+ Add group</b> → A, B, …) y añade los equipos de cada grupo.',
          '<b>Format</b> — por categoría: <b>Best of</b> (1/3/5); <b>Qualifiers per group</b> (1 o 2 — cuántos avanzan de cada grupo); <b>Double round-robin</b> (ida y vuelta, opcional); <b>Generate knockout bracket</b> (marca para generar las eliminatorias).',
          '<b>Slots</b> — canchas, días, hora de inicio, duración del turno, turnos por día y el <b>First match #</b>. Esto ubica los partidos en horarios/canchas automáticamente.',
          'Haz clic en <b>“Save setup”</b> cuando quieras (guarda la configuración; se recarga si vuelves luego).',
          '<b>Preview &amp; Publish → Generate</b>: arma la lista completa (grupos + eliminatorias) y muestra cuántos partidos generó.',
          'Marca <b>Replace all</b> (la primera vez) y haz clic en <b>Publish → confirma</b>. Los partidos aparecen en la lista del evento.',
        ] },
      ] },
      { h: "Parte D — Cómo se generan las finales", blocks: [
        { t: "p", text: 'Con <b>“Generate knockout bracket”</b> marcado, el generador arma las fases finales a partir de los clasificados, como un <b>esqueleto de llave</b>:' },
        { t: "ul", items: [
          '<b>2 grupos × 2 clasificados</b> → Semifinal 1, Semifinal 2, partido por el 3.º (Bronze) y Final',
          '2 grupos × 1 → Final directa',
          '4 grupos × 2 (o × 1) → Cuartos → Semis → Bronce → Final',
          '1 grupo → Final (1.º×2.º) + partido por el 3.º (3.º×4.º)',
        ] },
        { t: "warn", title: "Dos advertencias importantes", items: [
          'Los partidos eliminatorios nacen con <b>marcadores de posición</b>, no equipos reales (“1st Group A”, “Winner SF1”, “Loser SF2”). <b>La app todavía no coloca automáticamente</b> al ganador de la semi en la final — ese avance sigue siendo manual. El Live muestra la estructura de la llave; el equipo real solo aparece cuando se define.',
          'El <b>“Qualifiers per group” solo llega hasta 2</b>, y <b>nombrar grupos</b> (ej.: “Semi-finals”) todavía no existe — son las dos mejoras pendientes.',
        ] },
        { t: "note", text: 'Para que las finales funcionen con <b>equipos reales y planilla/marcador</b>, el camino sólido hoy es armar la llave con los equipos ya definidos, o importar de una planilla que ya tenga las finales completas. El auto-bracket sirve como esqueleto/visualización.' },
      ] },
      { h: "Parte E — Publicar en Fistball Live", blocks: [
        { t: "ol", start: 13, items: [
          '<b>Manage ▾ → Settings → Fistball Live</b> → publica este evento en el Live. Esto define el puntero público que sigue la app de espectadores. Si el evento no empezó, el Live muestra una <b>cuenta regresiva</b>.',
        ] },
      ] },
      { h: "Parte F — Durante el torneo", blocks: [
        { t: "ol", start: 14, items: [
          'Cada official abre un partido de la lista → completa la <b>planilla</b> (alineaciones precargadas si se importaron los rosters), registra rallies/sets y tarjetas, y <b>envía</b>.',
          'En cada guardado/envío el marcador y las tarjetas van al Live automáticamente (posiciones, llave y la pestaña <b>Cards</b>).',
          'Al final, en <b>Settings</b> puedes <b>archivar</b> el evento (queda de solo lectura).',
        ] },
      ] },
    ],
    summary: "<b>Resumen del flujo:</b> New event → Players &amp; staff (importar) → Access → Schedule (Groups → Format → Slots → Generate → Publish) → Settings (publicar en el Live) → puntuar las planillas.",
  },

  /* -------------------------------- DEUTSCH ------------------------------- */
  de: {
    title: "Ein Event anlegen und die Spiele aufbauen",
    subtitle: "Vom Anlegen des Events bis zu den Endspielen",
    intro: "Diese Anleitung beschreibt in der richtigen Reihenfolge, wie man in Fistball Arena ein neues Event anlegt, Teams und Personen erfasst, die Spielstruktur aufbaut (Gruppenphase + K.-o.-Runde) und alles in Fistball Live veröffentlicht.",
    sections: [
      { h: "Teil A — Event anlegen", blocks: [
        { t: "ol", start: 1, items: [
          'In der Event-Liste auf <b>„New event“</b> klicken (nur für Org-Admins sichtbar).',
          '<b>Name</b> (z. B. „2027 U18 World Championship“), <b>Place</b> (z. B. „Jona · Switzerland“) und die <b>Daten</b> über die Zeitraum-Auswahl (Start und Ende) ausfüllen.',
          'Bestätigen. Das Event wird erstellt, öffnet sich automatisch und startet mit Status <b>active</b>.',
        ] },
        { t: "note", text: 'Tipp: direkt nach dem Anlegen unter <b>Manage ▾ → Settings → Categories</b> die Chips markieren — <b>Typ</b> (National Teams/Clubs), <b>Geschlecht</b> (Men/Women) und optional <b>Alter</b> (U18, U14…). Die App erzeugt alle Kategorien (Typ × Alter × Geschlecht) schon vor dem Excel, und sie werden im Schedule-Generator vorbefüllt.' },
      ] },
      { h: "Teil B — Teams und Personen erfassen (empfohlen vor den Spielen)", blocks: [
        { t: "p", text: 'Im Menü <b>„Manage ▾“</b> (oben rechts, innerhalb des Events):' },
        { t: "ol", start: 4, items: [
          '<b>Players &amp; staff</b> → den Kader per <b>Excel</b> importieren (die Datei „…DATA.xlsx“): bringt Spieler, Staff und Schiedsrichter auf einmal, mit einer Prüfmaske für die Teamnamen. Das ist der Standardweg für ein neues Event.',
          '<b>Access</b> → per E-Mail festlegen, wer werten darf, mit Rolle <b>admin / official / viewer</b>. Man kann auch direkt über die Personenkarte freischalten („Give access“).',
          '(optional) <b>Settings → Event logos</b> → Event- und Sponsorenlogos hochladen.',
        ] },
        { t: "note", text: '<b>Alternative (Alt-Workflow):</b> die Option <b>DB sheet</b> (der Reiter „DB“ eines Google-Sheets) auf demselben Bildschirm gibt es nur, wenn der Kader bereits in einer Tabelle liegt — der alte Ablauf. Für ein neues Event Excel verwenden.' },
        { t: "note", text: 'In jedem Fall wird die Erfassung <b>nach Teamname</b> gespeichert. Im Spielplan-Generator exakt dieselben Namen verwenden — so sind die Spielberichte bereits mit den Aufstellungen vorbefüllt.' },
      ] },
      { h: "Teil C — Die Spielstruktur aufbauen", blocks: [
        { t: "p", text: '<b>Manage ▾ → Schedule.</b> Der Generator hat 4 Schritte (Reiter oben):' },
        { t: "ol", start: 7, items: [
          '<b>Groups</b> — je Kategorie (z. B. „U18 Men“): Kategoriename festlegen, Gruppen erstellen (<b>+ Add group</b> → A, B, …) und die Teams jeder Gruppe hinzufügen.',
          '<b>Format</b> — pro Kategorie: <b>Best of</b> (1/3/5); <b>Qualifiers per group</b> (1 oder 2 — wie viele je Gruppe weiterkommen); <b>Double round-robin</b> (Hin- &amp; Rückspiel, optional); <b>Generate knockout bracket</b> (ankreuzen, um die K.-o.-Runde zu erzeugen).',
          '<b>Slots</b> — Felder, Tage, Startzeit, Slot-Länge, Slots pro Tag und die <b>First match #</b>. Das verteilt die Spiele automatisch auf Zeiten/Felder.',
          'Jederzeit auf <b>„Save setup“</b> klicken (speichert die Konfiguration; sie wird beim späteren Zurückkehren neu geladen).',
          '<b>Preview &amp; Publish → Generate</b>: baut die vollständige Liste (Gruppen + K.-o.) und zeigt, wie viele Spiele erzeugt wurden.',
          '<b>Replace all</b> ankreuzen (beim ersten Mal) und auf <b>Publish → bestätigen</b> klicken. Die Spiele erscheinen in der Event-Liste.',
        ] },
      ] },
      { h: "Teil D — Wie die Endspiele erzeugt werden", blocks: [
        { t: "p", text: 'Mit angekreuztem <b>„Generate knockout bracket“</b> baut der Generator die Finalrunden aus den Qualifizierten — als <b>Baum-Gerüst</b>:' },
        { t: "ul", items: [
          '<b>2 Gruppen × 2 Qualifizierte</b> → Halbfinale 1, Halbfinale 2, Spiel um Platz 3 (Bronze) und Finale',
          '2 Gruppen × 1 → direktes Finale',
          '4 Gruppen × 2 (oder × 1) → Viertelfinale → Halbfinale → Bronze → Finale',
          '1 Gruppe → Finale (1.×2.) + Spiel um Platz 3 (3.×4.)',
        ] },
        { t: "warn", title: "Zwei wichtige Hinweise", items: [
          'Die K.-o.-Spiele entstehen mit <b>Platzhaltern für Platzierungen</b>, nicht mit echten Teams („1st Group A“, „Winner SF1“, „Loser SF2“). <b>Die App trägt den Halbfinalsieger noch nicht automatisch ins Finale ein</b> — dieses Weiterrücken ist noch manuell. Das Live zeigt die Baumstruktur; das echte Team erscheint erst, sobald es feststeht.',
          '<b>„Qualifiers per group“ geht nur bis 2</b>, und das <b>Benennen von Gruppen</b> (z. B. „Semi-finals“) gibt es noch nicht — das sind die beiden offenen Verbesserungen.',
        ] },
        { t: "note", text: 'Damit die Endspiele mit <b>echten Teams und Bericht/Ergebnis</b> funktionieren, ist der solide Weg heute, den Baum mit bereits feststehenden Teams aufzubauen oder aus einer Tabelle zu importieren, in der die Endspiele schon eingetragen sind. Der Auto-Baum dient als Gerüst/Visualisierung.' },
      ] },
      { h: "Teil E — In Fistball Live veröffentlichen", blocks: [
        { t: "ol", start: 13, items: [
          '<b>Manage ▾ → Settings → Fistball Live</b> → dieses Event im Live veröffentlichen. Das setzt den öffentlichen Zeiger, dem die Zuschauer-App folgt. Hat das Event noch nicht begonnen, zeigt das Live einen <b>Countdown</b>.',
        ] },
      ] },
      { h: "Teil F — Während des Turniers", blocks: [
        { t: "ol", start: 14, items: [
          'Jeder Official öffnet ein Spiel aus der Liste → füllt den <b>Bericht</b> aus (Aufstellungen vorbefüllt, wenn die Roster importiert wurden), erfasst Ballwechsel/Sätze und Karten und <b>reicht ein</b>.',
          'Bei jedem Speichern/Einreichen gehen Ergebnis und Karten automatisch ins Live (Tabelle, Baum und der <b>Cards</b>-Reiter).',
          'Am Ende kann man das Event unter <b>Settings</b> <b>archivieren</b> (es wird schreibgeschützt).',
        ] },
      ] },
    ],
    summary: "<b>Ablauf in Kürze:</b> New event → Players &amp; staff (Import) → Access → Schedule (Groups → Format → Slots → Generate → Publish) → Settings (im Live veröffentlichen) → Berichte werten.",
  },
};
