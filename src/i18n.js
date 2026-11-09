// Languages for the game report (súmula) screen and its PDF: English,
// Español, Deutsch, Português. Keys are the English text; missing entries
// fall back to English. {name} placeholders are filled from `vars`.
import { useEffect, useState } from "react";
import settingsDict from "./i18n/settings.js";
import scheduleDict from "./i18n/schedule.js";
import officialsDict from "./i18n/officials.js";
import kitsDict from "./i18n/kits.js";
import shellDict from "./i18n/shell.js";

export const LANGS = [
  { code: "en", label: "EN", name: "English", locale: "en-GB" },
  { code: "es", label: "ES", name: "Español", locale: "es-ES" },
  { code: "de", label: "DE", name: "Deutsch", locale: "de-DE" },
  { code: "pt", label: "PT", name: "Português", locale: "pt-BR" },
];
export const langName = (code) => (LANGS.find((l) => l.code === code) || LANGS[0]).name;
export const localeOf = (code) => (LANGS.find((l) => l.code === code) || LANGS[0]).locale;

const D = {
  es: {
    // tabs, header, status bar
    "Info": "Info", "Line-ups": "Alineaciones", "Score": "Marcador", "Referees": "Árbitros", "Finish": "Cierre",
    "Starting 5 · {team}": "Titulares · {team}", "‹ Games": "‹ Partidos", "Court {c}": "Cancha {c}", "Best of {n}": "Al mejor de {n}", "vs": "vs",
    "Language": "Idioma", "Loading…": "Cargando…",
    "Show the menu again": "Mostrar el menú", "Hide the menu — more room for the score sheet": "Ocultar el menú — más espacio para la planilla",
    "✕ Exit full screen": "✕ Salir de pantalla completa", "⛶ Full screen": "⛶ Pantalla completa",
    "Copy the live scoreboard link for this game (OBS/vMix browser source)": "Copiar el enlace del marcador en vivo de este partido (OBS/vMix)",
    "📺 Broadcast link": "📺 Enlace de transmisión", "Clear only this game report": "Borrar solo esta planilla", "Reset this report": "Reiniciar esta planilla",
    "✓ This report was submitted — read only.": "✓ Esta planilla fue enviada — solo lectura.",
    "Only an event admin can amend it.": "Solo un administrador del evento puede corregirla.",
    "📦 This event is archived — read only. Re-activate it in Settings → Event status to score.": "📦 Este evento está archivado — solo lectura. Reactívalo en Settings → Event status para anotar.",
    "👁 Read only — you don’t have scoring access for this event.": "👁 Solo lectura — no tienes acceso para anotar en este evento.",
    "🔒 Being scored by {name} — read only.": "🔒 {name} está anotando — solo lectura.", "another official": "otro oficial",
    "🔓 Read only — reload the page to start scoring (the lock wasn’t acquired).": "🔓 Solo lectura — recarga la página para empezar a anotar.",
    "Admin unlock": "Desbloquear (admin)", "Event admins only — logged with your name and the reason": "Solo administradores del evento — queda registrado con tu nombre y el motivo",
    "Reopen to amend": "Reabrir para corregir", "Open Settings": "Abrir Settings",
    "✓ Submitted": "✓ Enviada", "Read only": "Solo lectura", "Saving…": "Guardando…", "✓ Saved (live)": "✓ Guardado (en vivo)",
    "Next ›": "Siguiente ›", "Submitted": "Enviada", "Submit report": "Enviar planilla",
    // info
    "Match information": "Datos del partido", "Match Nr": "Partido Nº", "Date": "Fecha", "Time": "Hora", "Court": "Cancha", "Round": "Fase",
    "Category": "Categoría", "Best of": "Al mejor de", "Team A": "Equipo A", "Team B": "Equipo B",
    "Round & category come from the schedule; the rest is filled in the next tabs.": "La fase y la categoría vienen del calendario; el resto se completa en las pestañas siguientes.",
    // starting five
    "Attacker left": "Atacante izquierdo", "Attacker right": "Atacante derecho", "Centre": "Centro", "Defender left": "Defensor izquierdo", "Defender right": "Defensor derecho",
    "NET": "RED", "— suspended": "— suspendido", "⛔ Suspended — pick another player": "⛔ Suspendido — elige otro jugador", "Starting 5 — {team}": "Titulares — {team}",
    "Link to this tab in Arena for media — they need viewer access to the event": "Enlace a esta pestaña para la prensa — necesitan acceso de lectura al evento",
    "🔗 Link for media": "🔗 Enlace para la prensa",
    "Fill in with the coach before the game: who starts and in which position. Saved instantly. Internal only — never shown on Fistball Live; media see it here with viewer access.":
      "Completar con el entrenador antes del partido: quién empieza y en qué posición. Se guarda al instante. Solo interno — nunca aparece en Fistball Live.",
    "Read only — the referee or the event head fills this in.": "Solo lectura — lo completa el árbitro o el jefe del evento.",
    "{n}/5 positions set.": "{n}/5 posiciones definidas.",
    "No line-up loaded for this team yet — load the roster in Line-ups first.": "Aún no hay jugadores para este equipo — carga la lista en Alineaciones.",
    "Clear all": "Borrar todo",
    // line-ups
    "Players — tap C (captain), OC (on court), or a card": "Jugadores — toca C (capitán), EC (en cancha) o una tarjeta",
    "Fill both line-ups from the Teams registry": "Completar ambas alineaciones desde el registro de equipos", "↻ Load roster": "↻ Cargar lista",
    "⚠️ No line-up loaded for {team}.": "⚠️ No hay jugadores cargados para {team}.",
    "Read-only access — the roster couldn't be loaded (event archived or you're not a member of this event).": "Solo lectura — no se pudo cargar la lista (evento archivado o no eres miembro).",
    "Players are found by the team's exact name — “{name}” must be spelled the same in Players & staff ({cat}). Import the squads or fix the name, then tap ↻ Load roster.":
      "Los jugadores se buscan por el nombre exacto del equipo — “{name}” debe escribirse igual en Players & staff ({cat}). Importa las listas o corrige el nombre y toca ↻ Cargar lista.",
    "Fix team names in Players & staff →": "Corregir nombres en Players & staff →",
    "⛔ Suspended": "⛔ Suspendido", "Lift the suspension": "Levantar la suspensión", "Mark as suspended for this game (event head)": "Marcar como suspendido para este partido (jefe del evento)",
    "Unsuspend": "Quitar suspensión", "Suspend": "Suspender", "Staff": "Cuerpo técnico", "Captain": "Capitán", "On court": "En cancha",
    "C": "C", "OC": "EC", "Y": "A", "YR": "AR", "R": "R",
    // score
    "Set {n}": "Set {n}", "Swap which team is on the left of the tablet": "Cambiar qué equipo queda a la izquierda de la tablet", "⇄ Swap sides": "⇄ Cambiar lados",
    "Deciding set — which team is on the left?": "Set decisivo — ¿qué equipo está a la izquierda?",
    "Tapped the wrong side? Tap that point in the record to fix it.": "¿Tocaste el lado equivocado? Toca ese punto en el registro para corregirlo.",
    "Rally {n} — who scored?": "Punto {n} — ¿quién anotó?", "✕ Remove": "✕ Quitar", "Cancel": "Cancelar", "+ point": "+ punto",
    "↶ Undo last point": "↶ Deshacer último punto", "sets": "sets", "Winner: {team}": "Ganador: {team}",
    "Time-outs": "Tiempos muertos", "(one per team per set · records the set & score at the moment)": "(uno por equipo por set · registra el set y el marcador del momento)",
    "One time-out per team per set": "Un tiempo muerto por equipo por set", "No time-out left (set {n})": "Sin tiempo muerto (set {n})", "+ Time-out": "+ Tiempo muerto",
    "none": "ninguno", "No time-out left: {team} already took its time-out in set {n}.": "Sin tiempo muerto: {team} ya pidió su tiempo muerto en el set {n}.",
    "Choice of ball / serve": "Elección de balón / saque", "1st set": "1er set", "Deciding set": "Set decisivo",
    // referees
    "Referee team": "Equipo arbitral", "Referee 1": "Árbitro 1", "Referee 2": "Árbitro 2", "Recording Clerk": "Planillero", "Assistant 1": "Asistente 1", "Assistant 2": "Asistente 2",
    "Pre-filled from the referees assigned to this game (Referees screen). Pick from the list or type a name.": "Precargado con los árbitros asignados a este partido. Elige de la lista o escribe un nombre.",
    "Name": "Nombre", "Referee": "Árbitro",
    // finish
    "Summary": "Resumen", "No sets recorded yet": "Aún no hay sets registrados", "Cards": "Tarjetas", "No cards in this game.": "No hubo tarjetas en este partido.",
    "Yellow": "Amarilla", "Yellow-red": "Amarilla-roja", "Red": "Roja", "Suspended": "Suspendido", "(did not play)": "(no jugó)",
    "Amended after submission": "Corregida después del envío", "Remarks / extraordinary events": "Observaciones / hechos extraordinarios",
    "Protests, incidents, notes…": "Protestas, incidentes, notas…", "Responsible person": "Responsable", "Signatures (confirm)": "Firmas (confirmar)",
    "Captain — {team}": "Capitán — {team}", "Signed": "Firmado", "Sign": "Firmar", "Game report PDF": "PDF de la planilla",
    "Generates the full game report (súmula) in the tournament layout — to save, print or e-mail.": "Genera la planilla completa con el formato del torneo — para guardar, imprimir o enviar.",
    "⬇ Download PDF": "⬇ Descargar PDF", "PDF language": "Idioma del PDF",
    // alerts
    "No roster found for these teams. Import players in the Teams page first.": "No se encontró la lista de estos equipos. Importa los jugadores primero.",
    "Mark #{nr} {name} as SUSPENDED for this game? He can't be on court or captain.": "¿Marcar a #{nr} {name} como SUSPENDIDO para este partido? No podrá estar en cancha ni ser capitán.",
    "Couldn't save the suspension: ": "No se pudo guardar la suspensión: ", "Couldn't save the starting five: ": "No se pudieron guardar los titulares: ",
    "Reason for amending this submitted report (e.g. “Yellow card #7 removed after review”):": "Motivo de la corrección de esta planilla enviada (p. ej. “Se quitó la amarilla del #7 tras revisión”):",
    "Please give a reason — it is logged on the report.": "Indica un motivo — queda registrado en la planilla.", "Could not reopen: ": "No se pudo reabrir: ",
    // PDF
    "Fistball Game Report": "Planilla de partido de Fistball", "Points record": "Registro de puntos", "No points recorded.": "No hay puntos registrados.",
    "(set · score at the moment)": "(set · marcador del momento)", "Team registration": "Inscripción de equipos",
    "C = captain · dot = on court · Y / YR / R = cautions": "C = capitán · punto = en cancha · Y / YR / R = amarilla / amarilla-roja / roja",
    "Ball / serve: 1st set · deciding set": "Balón / saque: 1er set · set decisivo", "Ball / serve": "Balón / saque", "1st": "1º", "Deciding": "Decisivo", "Responsible": "Responsable", "signed": "firmado", "SUSPENDED": "SUSPENDIDO", "Team {s}": "Equipo {s}",
  },
  de: {
    "Info": "Info", "Line-ups": "Aufstellungen", "Score": "Spielstand", "Referees": "Schiedsrichter", "Finish": "Abschluss",
    "Starting 5 · {team}": "Startfünf · {team}", "‹ Games": "‹ Spiele", "Court {c}": "Feld {c}", "Best of {n}": "Best of {n}", "vs": "–",
    "Language": "Sprache", "Loading…": "Wird geladen…",
    "Show the menu again": "Menü wieder zeigen", "Hide the menu — more room for the score sheet": "Menü ausblenden — mehr Platz für den Spielbericht",
    "✕ Exit full screen": "✕ Vollbild beenden", "⛶ Full screen": "⛶ Vollbild",
    "Copy the live scoreboard link for this game (OBS/vMix browser source)": "Link zur Live-Anzeigetafel dieses Spiels kopieren (OBS/vMix)",
    "📺 Broadcast link": "📺 Stream-Link", "Clear only this game report": "Nur diesen Spielbericht löschen", "Reset this report": "Spielbericht zurücksetzen",
    "✓ This report was submitted — read only.": "✓ Dieser Spielbericht wurde abgeschickt — nur lesen.",
    "Only an event admin can amend it.": "Nur ein Admin der Veranstaltung kann ihn ändern.",
    "📦 This event is archived — read only. Re-activate it in Settings → Event status to score.": "📦 Diese Veranstaltung ist archiviert — nur lesen. Unter Settings → Event status wieder aktivieren.",
    "👁 Read only — you don’t have scoring access for this event.": "👁 Nur lesen — du hast für diese Veranstaltung keinen Zugang zum Protokollieren.",
    "🔒 Being scored by {name} — read only.": "🔒 Wird von {name} protokolliert — nur lesen.", "another official": "einem anderen Offiziellen",
    "🔓 Read only — reload the page to start scoring (the lock wasn’t acquired).": "🔓 Nur lesen — Seite neu laden, um zu protokollieren.",
    "Admin unlock": "Entsperren (Admin)", "Event admins only — logged with your name and the reason": "Nur Admins — wird mit deinem Namen und dem Grund protokolliert",
    "Reopen to amend": "Zum Ändern öffnen", "Open Settings": "Settings öffnen",
    "✓ Submitted": "✓ Abgeschickt", "Read only": "Nur lesen", "Saving…": "Speichert…", "✓ Saved (live)": "✓ Gespeichert (live)",
    "Next ›": "Weiter ›", "Submitted": "Abgeschickt", "Submit report": "Spielbericht abschicken",
    "Match information": "Spielinformationen", "Match Nr": "Spiel-Nr.", "Date": "Datum", "Time": "Zeit", "Court": "Feld", "Round": "Runde",
    "Category": "Kategorie", "Best of": "Best of", "Team A": "Team A", "Team B": "Team B",
    "Round & category come from the schedule; the rest is filled in the next tabs.": "Runde und Kategorie kommen aus dem Spielplan; der Rest wird in den nächsten Tabs ausgefüllt.",
    "Attacker left": "Angreifer links", "Attacker right": "Angreifer rechts", "Centre": "Mitte", "Defender left": "Abwehr links", "Defender right": "Abwehr rechts",
    "NET": "LEINE", "— suspended": "— gesperrt", "⛔ Suspended — pick another player": "⛔ Gesperrt — anderen Spieler wählen", "Starting 5 — {team}": "Startfünf — {team}",
    "Link to this tab in Arena for media — they need viewer access to the event": "Link zu diesem Tab für Medien — sie brauchen Lesezugang zur Veranstaltung",
    "🔗 Link for media": "🔗 Link für Medien",
    "Fill in with the coach before the game: who starts and in which position. Saved instantly. Internal only — never shown on Fistball Live; media see it here with viewer access.":
      "Vor dem Spiel mit dem Trainer ausfüllen: wer beginnt und auf welcher Position. Wird sofort gespeichert. Nur intern — nie auf Fistball Live sichtbar.",
    "Read only — the referee or the event head fills this in.": "Nur lesen — der Schiedsrichter oder die Turnierleitung füllt das aus.",
    "{n}/5 positions set.": "{n}/5 Positionen besetzt.",
    "No line-up loaded for this team yet — load the roster in Line-ups first.": "Noch keine Spieler für dieses Team — zuerst unter Aufstellungen laden.",
    "Clear all": "Alles löschen",
    "Players — tap C (captain), OC (on court), or a card": "Spieler — tippe K (Kapitän), F (auf dem Feld) oder eine Karte",
    "Fill both line-ups from the Teams registry": "Beide Aufstellungen aus dem Teamregister füllen", "↻ Load roster": "↻ Kader laden",
    "⚠️ No line-up loaded for {team}.": "⚠️ Keine Spieler für {team} geladen.",
    "Read-only access — the roster couldn't be loaded (event archived or you're not a member of this event).": "Nur Lesezugang — Kader konnte nicht geladen werden (archiviert oder kein Mitglied).",
    "Players are found by the team's exact name — “{name}” must be spelled the same in Players & staff ({cat}). Import the squads or fix the name, then tap ↻ Load roster.":
      "Spieler werden über den genauen Teamnamen gefunden — „{name}“ muss in Players & staff ({cat}) gleich geschrieben sein. Kader importieren oder Namen korrigieren, dann ↻ Kader laden.",
    "Fix team names in Players & staff →": "Teamnamen in Players & staff korrigieren →",
    "⛔ Suspended": "⛔ Gesperrt", "Lift the suspension": "Sperre aufheben", "Mark as suspended for this game (event head)": "Für dieses Spiel sperren (Turnierleitung)",
    "Unsuspend": "Sperre aufheben", "Suspend": "Sperren", "Staff": "Betreuer", "Captain": "Kapitän", "On court": "Auf dem Feld",
    "C": "K", "OC": "F", "Y": "G", "YR": "GR", "R": "R",
    "Set {n}": "Satz {n}", "Swap which team is on the left of the tablet": "Tauschen, welches Team links auf dem Tablet ist", "⇄ Swap sides": "⇄ Seiten tauschen",
    "Deciding set — which team is on the left?": "Entscheidungssatz — welches Team ist links?",
    "Tapped the wrong side? Tap that point in the record to fix it.": "Falsche Seite getippt? Tippe den Ball im Protokoll an, um ihn zu korrigieren.",
    "Rally {n} — who scored?": "Ball {n} — wer hat gepunktet?", "✕ Remove": "✕ Entfernen", "Cancel": "Abbrechen", "+ point": "+ Punkt",
    "↶ Undo last point": "↶ Letzten Punkt zurück", "sets": "Sätze", "Winner: {team}": "Sieger: {team}",
    "Time-outs": "Auszeiten", "(one per team per set · records the set & score at the moment)": "(eine pro Team und Satz · mit Satz und Spielstand)",
    "One time-out per team per set": "Eine Auszeit pro Team und Satz", "No time-out left (set {n})": "Keine Auszeit mehr (Satz {n})", "+ Time-out": "+ Auszeit",
    "none": "keine", "No time-out left: {team} already took its time-out in set {n}.": "Keine Auszeit mehr: {team} hat in Satz {n} schon eine Auszeit genommen.",
    "Choice of ball / serve": "Wahl Ball / Angabe", "1st set": "1. Satz", "Deciding set": "Entscheidungssatz",
    "Referee team": "Schiedsrichterteam", "Referee 1": "Schiedsrichter 1", "Referee 2": "Schiedsrichter 2", "Recording Clerk": "Schreiber", "Assistant 1": "Linienrichter 1", "Assistant 2": "Linienrichter 2",
    "Pre-filled from the referees assigned to this game (Referees screen). Pick from the list or type a name.": "Vorbelegt mit den eingeteilten Schiedsrichtern. Aus der Liste wählen oder Namen eingeben.",
    "Name": "Name", "Referee": "Schiedsrichter",
    "Summary": "Zusammenfassung", "No sets recorded yet": "Noch keine Sätze", "Cards": "Karten", "No cards in this game.": "Keine Karten in diesem Spiel.",
    "Yellow": "Gelb", "Yellow-red": "Gelb-Rot", "Red": "Rot", "Suspended": "Gesperrt", "(did not play)": "(nicht gespielt)",
    "Amended after submission": "Nach dem Abschicken geändert", "Remarks / extraordinary events": "Bemerkungen / besondere Vorkommnisse",
    "Protests, incidents, notes…": "Proteste, Vorfälle, Notizen…", "Responsible person": "Verantwortlich", "Signatures (confirm)": "Unterschriften (bestätigen)",
    "Captain — {team}": "Kapitän — {team}", "Signed": "Unterschrieben", "Sign": "Unterschreiben", "Game report PDF": "Spielbericht als PDF",
    "Generates the full game report (súmula) in the tournament layout — to save, print or e-mail.": "Erstellt den vollständigen Spielbericht im Turnierlayout — zum Speichern, Drucken oder Versenden.",
    "⬇ Download PDF": "⬇ PDF herunterladen", "PDF language": "Sprache des PDF",
    "No roster found for these teams. Import players in the Teams page first.": "Kein Kader für diese Teams gefunden. Zuerst die Spieler importieren.",
    "Mark #{nr} {name} as SUSPENDED for this game? He can't be on court or captain.": "#{nr} {name} für dieses Spiel SPERREN? Er darf weder spielen noch Kapitän sein.",
    "Couldn't save the suspension: ": "Sperre konnte nicht gespeichert werden: ", "Couldn't save the starting five: ": "Startfünf konnte nicht gespeichert werden: ",
    "Reason for amending this submitted report (e.g. “Yellow card #7 removed after review”):": "Grund für die Änderung des abgeschickten Spielberichts (z. B. „Gelbe Karte #7 nach Prüfung entfernt“):",
    "Please give a reason — it is logged on the report.": "Bitte einen Grund angeben — er wird im Spielbericht vermerkt.", "Could not reopen: ": "Konnte nicht geöffnet werden: ",
    "Fistball Game Report": "Faustball-Spielbericht", "Points record": "Ballprotokoll", "No points recorded.": "Keine Punkte erfasst.",
    "(set · score at the moment)": "(Satz · Spielstand)", "Team registration": "Mannschaftsaufstellung",
    "C = captain · dot = on court · Y / YR / R = cautions": "C = Kapitän · Punkt = auf dem Feld · Y / YR / R = Gelb / Gelb-Rot / Rot",
    "Ball / serve: 1st set · deciding set": "Ball / Angabe: 1. Satz · Entscheidungssatz", "Ball / serve": "Ball / Angabe", "1st": "1.", "Deciding": "Entscheidung", "Responsible": "Verantwortlich", "signed": "unterschrieben", "SUSPENDED": "GESPERRT", "Team {s}": "Team {s}",
  },
  pt: {
    "Info": "Info", "Line-ups": "Escalações", "Score": "Placar", "Referees": "Arbitragem", "Finish": "Encerramento",
    "Starting 5 · {team}": "Titulares · {team}", "‹ Games": "‹ Jogos", "Court {c}": "Quadra {c}", "Best of {n}": "Melhor de {n}", "vs": "x",
    "Language": "Idioma", "Loading…": "Carregando…",
    "Show the menu again": "Mostrar o menu", "Hide the menu — more room for the score sheet": "Esconder o menu — mais espaço para a súmula",
    "✕ Exit full screen": "✕ Sair da tela cheia", "⛶ Full screen": "⛶ Tela cheia",
    "Copy the live scoreboard link for this game (OBS/vMix browser source)": "Copiar o link do placar ao vivo deste jogo (OBS/vMix)",
    "📺 Broadcast link": "📺 Link da transmissão", "Clear only this game report": "Apagar só esta súmula", "Reset this report": "Zerar esta súmula",
    "✓ This report was submitted — read only.": "✓ Esta súmula foi enviada — somente leitura.",
    "Only an event admin can amend it.": "Só um admin do evento pode corrigi-la.",
    "📦 This event is archived — read only. Re-activate it in Settings → Event status to score.": "📦 Este evento está arquivado — somente leitura. Reative em Settings → Event status para anotar.",
    "👁 Read only — you don’t have scoring access for this event.": "👁 Somente leitura — você não tem acesso de mesário neste evento.",
    "🔒 Being scored by {name} — read only.": "🔒 {name} está anotando — somente leitura.", "another official": "outro mesário",
    "🔓 Read only — reload the page to start scoring (the lock wasn’t acquired).": "🔓 Somente leitura — recarregue a página para começar a anotar.",
    "Admin unlock": "Destravar (admin)", "Event admins only — logged with your name and the reason": "Só admins do evento — fica registrado com seu nome e o motivo",
    "Reopen to amend": "Reabrir para corrigir", "Open Settings": "Abrir Settings",
    "✓ Submitted": "✓ Enviada", "Read only": "Somente leitura", "Saving…": "Salvando…", "✓ Saved (live)": "✓ Salvo (ao vivo)",
    "Next ›": "Próximo ›", "Submitted": "Enviada", "Submit report": "Enviar súmula",
    "Match information": "Dados do jogo", "Match Nr": "Jogo nº", "Date": "Data", "Time": "Hora", "Court": "Quadra", "Round": "Fase",
    "Category": "Categoria", "Best of": "Melhor de", "Team A": "Equipe A", "Team B": "Equipe B",
    "Round & category come from the schedule; the rest is filled in the next tabs.": "Fase e categoria vêm da programação; o resto é preenchido nas próximas abas.",
    "Attacker left": "Atacante esquerdo", "Attacker right": "Atacante direito", "Centre": "Centro", "Defender left": "Defensor esquerdo", "Defender right": "Defensor direito",
    "NET": "FITA", "— suspended": "— suspenso", "⛔ Suspended — pick another player": "⛔ Suspenso — escolha outro jogador", "Starting 5 — {team}": "Titulares — {team}",
    "Link to this tab in Arena for media — they need viewer access to the event": "Link desta aba para a imprensa — precisam de acesso de leitura ao evento",
    "🔗 Link for media": "🔗 Link para a imprensa",
    "Fill in with the coach before the game: who starts and in which position. Saved instantly. Internal only — never shown on Fistball Live; media see it here with viewer access.":
      "Preencher com o técnico antes do jogo: quem começa e em qual posição. Salva na hora. Só interno — nunca aparece no Fistball Live.",
    "Read only — the referee or the event head fills this in.": "Somente leitura — o árbitro ou o chefe do evento preenche.",
    "{n}/5 positions set.": "{n}/5 posições definidas.",
    "No line-up loaded for this team yet — load the roster in Line-ups first.": "Ainda não há jogadores desta equipe — carregue a lista em Escalações.",
    "Clear all": "Limpar tudo",
    "Players — tap C (captain), OC (on court), or a card": "Jogadores — toque C (capitão), EQ (em quadra) ou um cartão",
    "Fill both line-ups from the Teams registry": "Preencher as duas escalações pelo cadastro de equipes", "↻ Load roster": "↻ Carregar lista",
    "⚠️ No line-up loaded for {team}.": "⚠️ Nenhum jogador carregado para {team}.",
    "Read-only access — the roster couldn't be loaded (event archived or you're not a member of this event).": "Somente leitura — não foi possível carregar a lista (evento arquivado ou você não é membro).",
    "Players are found by the team's exact name — “{name}” must be spelled the same in Players & staff ({cat}). Import the squads or fix the name, then tap ↻ Load roster.":
      "Os jogadores são encontrados pelo nome exato da equipe — “{name}” deve estar escrito igual em Players & staff ({cat}). Importe as listas ou corrija o nome e toque ↻ Carregar lista.",
    "Fix team names in Players & staff →": "Corrigir nomes em Players & staff →",
    "⛔ Suspended": "⛔ Suspenso", "Lift the suspension": "Retirar a suspensão", "Mark as suspended for this game (event head)": "Marcar como suspenso neste jogo (chefe do evento)",
    "Unsuspend": "Retirar suspensão", "Suspend": "Suspender", "Staff": "Comissão técnica", "Captain": "Capitão", "On court": "Em quadra",
    "C": "C", "OC": "EQ", "Y": "A", "YR": "AV", "R": "V",
    "Set {n}": "Set {n}", "Swap which team is on the left of the tablet": "Trocar qual equipe fica à esquerda no tablet", "⇄ Swap sides": "⇄ Trocar lados",
    "Deciding set — which team is on the left?": "Set decisivo — qual equipe está à esquerda?",
    "Tapped the wrong side? Tap that point in the record to fix it.": "Tocou no lado errado? Toque nesse ponto no registro para corrigir.",
    "Rally {n} — who scored?": "Ponto {n} — quem marcou?", "✕ Remove": "✕ Remover", "Cancel": "Cancelar", "+ point": "+ ponto",
    "↶ Undo last point": "↶ Desfazer último ponto", "sets": "sets", "Winner: {team}": "Vencedor: {team}",
    "Time-outs": "Tempos", "(one per team per set · records the set & score at the moment)": "(um por equipe por set · registra o set e o placar do momento)",
    "One time-out per team per set": "Um tempo por equipe por set", "No time-out left (set {n})": "Sem tempo disponível (set {n})", "+ Time-out": "+ Tempo",
    "none": "nenhum", "No time-out left: {team} already took its time-out in set {n}.": "Sem tempo disponível: {team} já pediu tempo no set {n}.",
    "Choice of ball / serve": "Escolha de bola / saque", "1st set": "1º set", "Deciding set": "Set decisivo",
    "Referee team": "Equipe de arbitragem", "Referee 1": "Árbitro 1", "Referee 2": "Árbitro 2", "Recording Clerk": "Mesário", "Assistant 1": "Assistente 1", "Assistant 2": "Assistente 2",
    "Pre-filled from the referees assigned to this game (Referees screen). Pick from the list or type a name.": "Preenchido com os árbitros escalados para este jogo. Escolha da lista ou digite um nome.",
    "Name": "Nome", "Referee": "Árbitro",
    "Summary": "Resumo", "No sets recorded yet": "Ainda não há sets registrados", "Cards": "Cartões", "No cards in this game.": "Nenhum cartão neste jogo.",
    "Yellow": "Amarelo", "Yellow-red": "Amarelo-vermelho", "Red": "Vermelho", "Suspended": "Suspenso", "(did not play)": "(não jogou)",
    "Amended after submission": "Corrigida após o envio", "Remarks / extraordinary events": "Observações / ocorrências extraordinárias",
    "Protests, incidents, notes…": "Protestos, incidentes, anotações…", "Responsible person": "Responsável", "Signatures (confirm)": "Assinaturas (confirmar)",
    "Captain — {team}": "Capitão — {team}", "Signed": "Assinado", "Sign": "Assinar", "Game report PDF": "PDF da súmula",
    "Generates the full game report (súmula) in the tournament layout — to save, print or e-mail.": "Gera a súmula completa no formato do torneio — para salvar, imprimir ou enviar.",
    "⬇ Download PDF": "⬇ Baixar PDF", "PDF language": "Idioma do PDF",
    "No roster found for these teams. Import players in the Teams page first.": "Nenhuma lista encontrada para estas equipes. Importe os jogadores primeiro.",
    "Mark #{nr} {name} as SUSPENDED for this game? He can't be on court or captain.": "Marcar #{nr} {name} como SUSPENSO neste jogo? Ele não poderá entrar em quadra nem ser capitão.",
    "Couldn't save the suspension: ": "Não foi possível salvar a suspensão: ", "Couldn't save the starting five: ": "Não foi possível salvar os titulares: ",
    "Reason for amending this submitted report (e.g. “Yellow card #7 removed after review”):": "Motivo da correção desta súmula enviada (ex.: “Cartão amarelo do #7 retirado após revisão”):",
    "Please give a reason — it is logged on the report.": "Informe um motivo — ele fica registrado na súmula.", "Could not reopen: ": "Não foi possível reabrir: ",
    "Fistball Game Report": "Súmula de Punhobol", "Points record": "Registro de pontos", "No points recorded.": "Nenhum ponto registrado.",
    "(set · score at the moment)": "(set · placar do momento)", "Team registration": "Relação das equipes",
    "C = captain · dot = on court · Y / YR / R = cautions": "C = capitão · ponto = em quadra · Y / YR / R = amarelo / amarelo-vermelho / vermelho",
    "Ball / serve: 1st set · deciding set": "Bola / saque: 1º set · set decisivo", "Ball / serve": "Bola / saque", "1st": "1º", "Deciding": "Decisivo", "Responsible": "Responsável", "signed": "assinado", "SUSPENDED": "SUSPENSO", "Team {s}": "Equipe {s}",
  },
};

const ROUND = {
  es: { qr: "Fase de clasificación", sf: "Semifinal", qf: "Cuartos de final", bronze: "Partido por el bronce", gold: "Partido por el oro", final: "Final", place: "Puestos", group: "Grupo" },
  de: { qr: "Vorrunde", sf: "Halbfinale", qf: "Viertelfinale", bronze: "Spiel um Bronze", gold: "Spiel um Gold", final: "Finale", place: "Platz", group: "Gruppe" },
  pt: { qr: "Fase de classificação", sf: "Semifinal", qf: "Quartas de final", bronze: "Disputa do bronze", gold: "Disputa do ouro", final: "Final", place: "Colocação", group: "Grupo" },
};

const fill = (s, v) => (v ? String(s).replace(/\{(\w+)\}/g, (m, k) => (k in v ? v[k] : m)) : s);
// Per-area dictionaries (src/i18n/*.js) merged under the súmula's (D).
for (const area of [settingsDict, scheduleDict, officialsDict, kitsDict, shellDict]) {
  for (const code of ["es", "de", "pt"]) D[code] = { ...(area[code] || {}), ...D[code] };
}
export function makeT(lang) {
  const d = D[lang] || {};
  return (en, vars) => fill(d[en] || en, vars);
}
// Round names come from the schedule in English ("Semifinal 1", "Placement 5-6").
export function tRound(lang, round) {
  const R = ROUND[lang];
  const s = String(round || "");
  if (!R || !s) return s;
  let m;
  if (/^\s*(qualification round|preliminary round)\s*$/i.test(s)) return R.qr;
  if ((m = s.match(/^\s*semi-?finals?\s*(\d*)\s*$/i))) return `${R.sf}${m[1] ? " " + m[1] : ""}`;
  if ((m = s.match(/^\s*quarter-?finals?\s*(\d*)\s*$/i))) return `${R.qf}${m[1] ? " " + m[1] : ""}`;
  if (/^\s*bronze medal match\s*$/i.test(s)) return R.bronze;
  if (/^\s*gold medal match\s*$/i.test(s)) return R.gold;
  if (/^\s*finale?\s*$/i.test(s)) return R.final;
  if ((m = s.match(/^\s*placement\s*(\d+)\s*[-–]\s*(\d+)\s*$/i))) return `${R.place} ${m[1]}–${m[2]}`;
  if ((m = s.match(/^\s*group\s+(\w+)\s*$/i))) return `${R.group} ${m[1]}`;
  return s;
}
// Bilingual helper for the PDF: "English / Deutsch" (English only when the
// second language is English or none).
export function makeBi(second) {
  const t2 = makeT(second);
  const two = second && second !== "en" && D[second];
  return {
    bi: (en, vars) => { const a = fill(en, vars); if (!two) return a; const b = t2(en, vars); return b === a ? a : `${a} / ${b}`; },
    biRound: (r) => { const a = String(r || ""); if (!two) return a; const b = tRound(second, a); return b === a ? a : `${a} / ${b}`; },
  };
}

// The screen language: chosen in the súmula (remembered on this device), else the browser's.
const KEY = "arena_lang";
function initialLang() {
  try { const s = localStorage.getItem(KEY); if (LANGS.some((l) => l.code === s)) return s; } catch (_) { /* no storage */ }
  for (const n of navigator.languages || [navigator.language || "en"]) {
    const c = String(n).slice(0, 2).toLowerCase();
    if (LANGS.some((l) => l.code === c)) return c;
  }
  return "en";
}
const listeners = new Set();
let current = typeof navigator !== "undefined" ? initialLang() : "en";
export function useLang() {
  const [lang, setLangState] = useState(current);
  useEffect(() => { listeners.add(setLangState); return () => listeners.delete(setLangState); }, []);
  const setLang = (code) => {
    current = code;
    try { localStorage.setItem(KEY, code); } catch (_) { /* no storage */ }
    listeners.forEach((f) => f(code));
  };
  return [lang, setLang];
}

// Translate with the current screen language — for components (re-renders on
// change) use useT(); tNow() is for plain functions (alerts, helpers).
export function useT() {
  const [lang] = useLang();
  return makeT(lang);
}
export function tNow(en, vars) { return makeT(current)(en, vars); }
export function currentLang() { return current; }
