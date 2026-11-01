const paths = {
  runbooks: "M3 4h6a4 4 0 0 1 3 1.5A4 4 0 0 1 15 4h6v16h-6a4 4 0 0 0-3 1.5A4 4 0 0 0 9 20H3z M12 5.5v16 M6 8h3 M6 12h3 M15 8h3 M15 12h3",
  assistant: "M12 3v3 M4 9h16v11H4z M1 12h3 M20 12h3 M8 13h.01 M16 13h.01 M8 17h8",
  dashboard: "M3 3h7v7H3z M14 3h7v7h-7z M3 14h7v7H3z M14 14h7v7h-7z",
  system: "M3 3h18v7H3z M3 14h18v7H3z M7 6h1 M7 17h1 M12 6h5 M12 17h5",
  alerts: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9 M10 21h4",
  profile: "M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M4 21v-2a8 8 0 0 1 16 0v2",
  retention: "M3 3h18v5H3z M5 8v13h14V8 M9 12h6",
  menu: "M4 6h16 M4 12h16 M4 18h16",
  close: "m6 6 12 12 M18 6 6 18",
  collapse: "m14 6-6 6 6 6",
  expand: "m10 6 6 6-6 6",
  arrow: "M4 12h16 m-6-6 6 6-6 6",
  refresh: "M20 7v5h-5 M4 17v-5h5 M6 7a7 7 0 0 1 11-2l3 3 M4 16l3 3a7 7 0 0 0 11-2",
  activity: "M2 12h5l3-8 4 16 3-8h5",
  check: "m5 12 4 4L19 6",
  warning: "m12 3 10 18H2L12 3 M12 9v5 M12 17h.01",
  offline: "M4 4l16 16 M8 8a6 6 0 0 0 8 8 M10 3a9 9 0 0 1 11 11 M3 10a9 9 0 0 0 11 11",
  cpu: "M7 7h10v10H7z M9 1v4 M15 1v4 M9 19v4 M15 19v4 M1 9h4 M1 15h4 M19 9h4 M19 15h4",
  memory: "M3 5h18v12H3z M7 9v4 M11 9v4 M15 9v4 M19 9v4 M7 17v3 M12 17v3 M17 17v3",
  response: "M12 8v5l3 2 M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0",
  shield: "m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3 M8 12l3 3 5-6",
  logout: "M10 4H4v16h6 M10 12h11 m-4-4 4 4-4 4",
  eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12 M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0",
  eyeOff: "m3 3 18 18 M10 5a13 13 0 0 1 12 7 19 19 0 0 1-4 4 M6 6a20 20 0 0 0-4 6s4 7 10 7a12 12 0 0 0 5-1 M10 10a3 3 0 0 0 4 4",
};

export default function Icon({ name, className = "", ...props }) {
  return <svg className={`ui-icon ${className}`.trim()} aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}><path d={paths[name] || paths.activity} /></svg>;
}
