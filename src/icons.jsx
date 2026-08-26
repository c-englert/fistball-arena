// Custom, exclusive line-icon set for Fistball Arena. One cohesive family:
// 24-viewBox, currentColor stroke, round caps/joins. No emoji, no icon library.

function Svg({ size = 20, sw = 1.7, children, ...rest }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...rest}>
      {children}
    </svg>
  );
}

// Global
export const IconEvents = (p) => (
  <Svg {...p}><rect x="3.5" y="8.5" width="13" height="11.5" rx="2.2" />
    <path d="M8 8.5V6.2A2.2 2.2 0 0 1 10.2 4h8.6A2.2 2.2 0 0 1 21 6.2v9.6a2.2 2.2 0 0 1-2.2 2.2H16.5" />
    <path d="M7 13.5h6M7 16.5h4" /></Svg>
);
export const IconUsers = (p) => (
  <Svg {...p}><circle cx="9" cy="8.5" r="3" /><path d="M3.6 19.4a5.5 5.5 0 0 1 10.8 0" />
    <circle cx="17.6" cy="10" r="2.1" /><path d="M17.6 12.1v4.5M17.6 15.2h1.5" /></Svg>
);
export const IconGuide = (p) => (
  <Svg {...p}><path d="M12 6.6C10 5.1 7.2 4.6 4.6 5.3v12.5C7.2 17.1 10 17.6 12 19.1" />
    <path d="M12 6.6C14 5.1 16.8 4.6 19.4 5.3v12.5C16.8 17.1 14 17.6 12 19.1" /><path d="M12 6.6v12.5" /></Svg>
);

// Event
export const IconGames = (p) => (
  <Svg {...p}><circle cx="15" cy="8" r="3.4" /><path d="M4 20h16" /><path d="M5.6 16c2-2.1 4.4-3.1 6.9-2.7" /></Svg>
);
export const IconStandings = (p) => (
  <Svg {...p}><path d="M4 20h16" /><path d="M6.5 20v-4.5M12 20V8.5M17.5 20v-7" /></Svg>
);
export const IconBracket = (p) => (
  <Svg {...p}><path d="M4 7h3v5h4" /><path d="M4 17h3v-5" /><path d="M11 12h5.5" /><circle cx="19" cy="12" r="1.4" /></Svg>
);
export const IconSchedule = (p) => (
  <Svg {...p}><rect x="4" y="5" width="16" height="15" rx="2.4" /><path d="M4 9.5h16M8.5 5V3M15.5 5V3" />
    <path d="M8 13h2M14 13h2M8 16.5h2" /></Svg>
);
export const IconRoster = (p) => (
  <Svg {...p} sw={1.6}><path d="M9 4.4 5.4 6.6 4 10.2l2.6 1.5L8 10.2V20h8v-9.8l1.4 1.5L20 10.2 18.6 6.6 15 4.4a3 3 0 0 1-6 0Z" /></Svg>
);
export const IconSettings = (p) => (
  <Svg {...p}><path d="M4 8h8.5M17 8h3" /><circle cx="14.7" cy="8" r="2.2" />
    <path d="M4 16h3.3M11.7 16H20" /><circle cx="9.3" cy="16" r="2.2" /></Svg>
);

// Utility
export const IconBack = (p) => (
  <Svg {...p} sw={2}><path d="M14 6l-6 6 6 6" /></Svg>
);
export const IconSignOut = (p) => (
  <Svg {...p}><path d="M15 4h3.5A1.5 1.5 0 0 1 20 5.5v13A1.5 1.5 0 0 1 18.5 20H15" />
    <path d="M10 12h9M16 8l4 4-4 4" /></Svg>
);
