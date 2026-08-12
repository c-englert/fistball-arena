import { useEffect, useRef, useState } from "react";

// Welcome modal inviting the user to install the PWA. Auto-shows once when the
// browser offers installation (beforeinstallprompt); on iOS Safari it shows
// Add-to-Home-Screen instructions. "Maybe later" remembers the dismissal.
const KEY = "arena_install_dismissed";
const isStandalone = () => matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
const dismissed = () => { try { return localStorage.getItem(KEY) === "1"; } catch { return false; } };
const remember = () => { try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } };

export default function InstallPrompt() {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState("prompt"); // "prompt" | "ios"
  const promptRef = useRef(null);

  useEffect(() => {
    if (isStandalone() || dismissed()) return undefined;
    let showTimer;
    const onBIP = (e) => {
      e.preventDefault();
      promptRef.current = e;
      setMode("prompt");
      showTimer = setTimeout(() => setOpen(true), 1200);
    };
    const onInstalled = () => { setOpen(false); remember(); };
    window.addEventListener("beforeinstallprompt", onBIP);
    window.addEventListener("appinstalled", onInstalled);
    if (isIOS()) { setMode("ios"); showTimer = setTimeout(() => setOpen(true), 1500); }
    return () => {
      window.removeEventListener("beforeinstallprompt", onBIP);
      window.removeEventListener("appinstalled", onInstalled);
      clearTimeout(showTimer);
    };
  }, []);

  const later = () => { setOpen(false); remember(); };
  const install = async () => {
    const p = promptRef.current;
    setOpen(false);
    if (!p) return;
    p.prompt();
    await p.userChoice;
    promptRef.current = null;
    remember();
  };

  if (!open) return null;
  return (
    <div className="modal-overlay" onClick={() => setOpen(false)}>
      <div className="install-card" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="installTitle">
        <div className="install-logo"><img src={import.meta.env.BASE_URL + "ifa-mark.png"} alt="" /></div>
        <h2 id="installTitle" className="install-title">Install Fistball Arena</h2>
        {mode === "ios"
          ? <p className="install-msg">Tap the <b>Share</b> button, then <b>“Add to Home Screen”</b> to install.</p>
          : <p className="install-msg">Install the app for quick access to your events, schedule and game reports.</p>}
        {mode !== "ios" && <button className="btn primary install-primary" onClick={install}>Install App</button>}
        <button className="btn install-ghost" onClick={later}>Maybe later</button>
      </div>
    </div>
  );
}
