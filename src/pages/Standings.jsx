import { useEvent } from "../eventContext.js";

// The Fistball Live viewer, embedded and pinned to THIS event via ?event=.
const LIVE_URL = "https://c-englert.github.io/fistball-live/";

export default function Standings() {
  const { eventId } = useEvent();
  return <iframe className="live-embed" src={`${LIVE_URL}?event=${eventId}`} title="Standings" loading="lazy" />;
}
