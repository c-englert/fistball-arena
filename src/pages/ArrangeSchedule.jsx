import { useNavigate } from "react-router-dom";
import ScheduleGrid from "../schedule/ScheduleGrid.jsx";
import { useEvent } from "../eventContext.js";

// Drag-and-drop schedule grid page (rendered inside the app shell).
export default function ArrangeSchedule() {
  const nav = useNavigate();
  const { eventId, isAdmin, archived } = useEvent();
  if (!isAdmin) return <div className="empty">Admins only. <button className="btn" onClick={() => nav(`/e/${eventId}`)}>Back</button></div>;
  return (
    <>
      <h2 className="page-h">Arrange schedule</h2>
      {archived && <div className="warn-box">This event is archived — read-only.</div>}
      <ScheduleGrid />
    </>
  );
}
