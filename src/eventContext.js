import { createContext, useContext } from "react";

// Current event scope, provided by EventShell and consumed by the pages.
export const EventContext = createContext({
  eventId: null, event: null, myRole: null, archived: false, isAdmin: false,
});
export const useEvent = () => useContext(EventContext);
