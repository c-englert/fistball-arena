import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

// Registers the service worker in "prompt" mode and shows a toast when a new
// version is waiting. Tapping Update messages the waiting worker to skipWaiting;
// when it takes control (controllerchange) the page reloads once. Also polls for
// updates every minute so open tabs learn about a deploy.
export default function UpdatePrompt() {
  const [show, setShow] = useState(false);
  const regRef = useRef(null);
  const updateRef = useRef(null);

  useEffect(() => {
    updateRef.current = registerSW({
      immediate: true,
      onNeedRefresh() { setShow(true); },
      onRegisteredSW(_swUrl, reg) {
        regRef.current = reg || null;
        if (reg) setInterval(() => { reg.update().catch(() => {}); }, 60 * 1000);
      },
    });
    if ("serviceWorker" in navigator) {
      let reloading = false;
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (reloading) return;
        reloading = true;
        window.location.reload();
      });
    }
  }, []);

  const apply = () => {
    const waiting = regRef.current && regRef.current.waiting;
    if (waiting) { waiting.postMessage({ type: "SKIP_WAITING" }); return; }
    if (updateRef.current) { updateRef.current(true); return; } // fallback
    window.location.reload();
  };

  if (!show) return null;
  return (
    <div className="update-toast" role="status">
      <span>New version available</span>
      <button className="btn sm" onClick={apply}>Update</button>
    </div>
  );
}
