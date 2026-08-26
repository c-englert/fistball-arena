import { useState } from "react";

// Avatar button (photo or initials) that opens a small account menu with Sign out.
export default function AccountMenu({ me, onSignOut }) {
  const [open, setOpen] = useState(false);
  const [imgOk, setImgOk] = useState(true);
  const initials = (me.name || me.email || "?")
    .split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="menu-wrap">
      <button className="avatar-btn" onClick={() => setOpen((o) => !o)} title={me.name} aria-label="Account">
        {me.photo && imgOk
          ? <img src={me.photo} alt="" referrerPolicy="no-referrer" onError={() => setImgOk(false)} />
          : <span>{initials}</span>}
      </button>
      {open && (
        <>
          <div className="menu-backdrop" onClick={() => setOpen(false)} />
          <div className="menu-pop account">
            <div className="account-head">
              <div className="account-name">{me.name}</div>
              <div className="account-email">{me.email}{me.admin ? " · org-admin" : ""}</div>
            </div>
            <button className="menu-item" onClick={() => { setOpen(false); onSignOut(); }}>Sign out</button>
          </div>
        </>
      )}
    </div>
  );
}
