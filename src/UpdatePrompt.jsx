import { useEffect, useRef, useState } from "react";
import { registerSW } from "virtual:pwa-register";

// Registers the service worker in "prompt" mode and shows a toast when a new
// version is available. Also polls for updates every minute so open tabs learn
// about a deploy without a manual reload. Clicking Update applies + reloads.
export default function UpdatePrompt() {
  const [show, setShow] = useState(false);
  const applyRef = useRef(null);

  useEffect(() => {
    applyRef.current = registerSW({
      immediate: true,
      onNeedRefresh() { setShow(true); },
      onRegisteredSW(_swUrl, reg) {
        if (reg) setInterval(() => { reg.update().catch(() => {}); }, 60 * 1000);
      },
    });
  }, []);

  if (!show) return null;
  return (
    <div className="update-toast" role="status">
      <span>New version available</span>
      <button className="btn sm" onClick={() => applyRef.current && applyRef.current(true)}>Update</button>
    </div>
  );
}
