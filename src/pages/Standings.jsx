import { useNavigate } from "react-router-dom";
import { useEvent } from "../eventContext.js";

// The Fistball Live viewer, embedded and pinned to THIS event via ?event=.
const LIVE_URL = "https://c-englert.github.io/fistball-live/";

export default function Standings() {
  const nav = useNavigate();
  const { eventId, event } = useEvent();
  return (
    <div className="app">
      <header className="topbar">
        <button className="iconbtn" onClick={() => nav(`/e/${eventId}`)}>‹ Games</button>
        <div className="brand-logo sm"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <div className="spacer" />
        <div style={{ textAlign: "right" }}>
          <div className="title">Standings &amp; results</div>
          <div className="sub">{event?.name}</div>
        </div>
      </header>
      <iframe className="live-embed" src={`${LIVE_URL}?event=${eventId}`} title="Standings" loading="lazy" />
    </div>
  );
}
