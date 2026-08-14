import { useNavigate } from "react-router-dom";
import ScheduleGrid from "../schedule/ScheduleGrid.jsx";
import { useEvent } from "../eventContext.js";

// Standalone page wrapper around the drag-and-drop schedule grid.
export default function ArrangeSchedule() {
  const nav = useNavigate();
  const { eventId, isAdmin, archived } = useEvent();
  const base = `/e/${eventId}`;

  if (!isAdmin) return <div className="empty">Admins only. <button className="btn" onClick={() => nav(base)}>Back</button></div>;

  return (
    <div className="app">
      <header className="topbar">
        <button className="iconbtn" onClick={() => nav(base)}>‹ Games</button>
        <div className="brand-logo sm"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="IFA" /></div>
        <div className="spacer" />
        <div style={{ textAlign: "right" }}>
          <div className="title">Arrange schedule</div>
          <div className="sub">Drag games onto a day · court · time</div>
        </div>
      </header>
      <div className="content">
        {archived && <div className="warn-box">This event is archived — read-only.</div>}
        <ScheduleGrid />
      </div>
    </div>
  );
}
