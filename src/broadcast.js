// Links to the broadcast scoreboard overlay hosted with Fistball Live
// (overlay.html). Public, no login — paste into OBS/vMix as a browser source.
export const LIVE_URL = "https://c-englert.github.io/fistball-live/";

// { game: "<gameId>" } pins one game; { court: "1" } follows whatever game is
// on that court (in progress → just finished → next up).
export function overlayUrl(eventId, { game, court } = {}) {
  const q = new URLSearchParams({ event: eventId });
  if (game) q.set("game", game);
  else if (court) q.set("court", court);
  return `${LIVE_URL}overlay.html?${q}`;
}
