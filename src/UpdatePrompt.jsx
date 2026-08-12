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

  // Bulletproof: tell the waiting worker to activate, and regardless unregister
  // the SW + clear caches and hard-reload so the newest build always loads.
  const apply = async () => {
    try { regRef.current?.waiting?.postMessage({ type: "SKIP_WAITING" }); } catch { /* ignore */ }
    try {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
      if (window.caches) { const keys = await caches.keys(); await Promise.all(keys.map((k) => caches.delete(k))); }
    } catch { /* ignore */ }
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
