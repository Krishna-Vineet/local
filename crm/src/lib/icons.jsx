// Inline SVG icon set (24px viewBox, stroke-based) — no external deps.

const PATHS = {
  dashboard: (<><rect x="3" y="3" width="7.5" height="9" rx="1.5" /><rect x="13.5" y="3" width="7.5" height="5.5" rx="1.5" /><rect x="13.5" y="12" width="7.5" height="9" rx="1.5" /><rect x="3" y="15.5" width="7.5" height="5.5" rx="1.5" /></>),
  revenue: (<><path d="M12 2v20" /><path d="M17 5.5H9.5a3.25 3.25 0 0 0 0 6.5h5a3.25 3.25 0 0 1 0 6.5H6.5" /></>),
  building: (<><path d="M4 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16" /><path d="M16 9h3a1.5 1.5 0 0 1 1.5 1.5V21" /><path d="M2.5 21h19" /><path d="M8 7h2M8 11h2M8 15h2M12 7h1M12 11h1M12 15h1" /></>),
  template: (<><rect x="3" y="3" width="18" height="18" rx="2.5" /><path d="M3 9h18M9.5 21V9" /></>),
  users: (<><circle cx="9" cy="8" r="3.4" /><path d="M2.8 20c.7-3.3 3.2-5 6.2-5s5.5 1.7 6.2 5" /><path d="M16 4.9a3.4 3.4 0 0 1 0 6.2M17.8 15.4c2 .7 3.1 2.3 3.5 4.6" /></>),
  log: (<><path d="M8 6h13M8 12h13M8 18h13" /><circle cx="4" cy="6" r="1.1" fill="currentColor" stroke="none" /><circle cx="4" cy="12" r="1.1" fill="currentColor" stroke="none" /><circle cx="4" cy="18" r="1.1" fill="currentColor" stroke="none" /></>),
  calendar: (<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10.5h18" /><circle cx="8.5" cy="15" r="1.2" fill="currentColor" stroke="none" /><circle cx="13" cy="15" r="1.2" fill="currentColor" stroke="none" /><circle cx="17" cy="18" r="1.2" fill="currentColor" stroke="none" /></>),
  headset: (<><path d="M4 13v-2a8 8 0 0 1 16 0v2" /><rect x="2.8" y="13" width="4" height="6.5" rx="1.8" /><rect x="17.2" y="13" width="4" height="6.5" rx="1.8" /><path d="M19.5 19.5c0 1.7-1.6 2.5-3.5 2.5h-2" /></>),
  sliders: (<><path d="M4 8h9M17 8h3M4 16h3M11 16h9" /><circle cx="15" cy="8" r="2.2" /><circle cx="9" cy="16" r="2.2" /></>),
  tag: (<><path d="M20.6 13.4 12 22 2.5 12.5V3H12l8.6 8.6a1.4 1.4 0 0 1 0 1.8Z" /><circle cx="7.5" cy="7.5" r="1.5" /></>),
  user: (<><circle cx="12" cy="8" r="4" /><path d="M4.5 20.5c1-4 4-6 7.5-6s6.5 2 7.5 6" /></>),
  logout: (<><path d="M14 4h-7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" /><path d="M10 12h11M17.5 8.5 21 12l-3.5 3.5" /></>),
  camera: (<><path d="M15.5 6.5h-2L12 4.6H8l-1.5 1.9h-2A2.5 2.5 0 0 0 2 9v8.5A2.5 2.5 0 0 0 4.5 20h15A2.5 2.5 0 0 0 22 17.5V9a2.5 2.5 0 0 0-2.5-2.5Z" /><circle cx="12" cy="13" r="3.6" /></>),
  plus: <path d="M12 5v14M5 12h14" />,
  search: (<><circle cx="11" cy="11" r="6.5" /><path d="m20 20-3.8-3.8" /></>),
  x: <path d="M6 6l12 12M18 6 6 18" />,
  code: <path d="M8 7 3.5 12 8 17M16 7l4.5 5-4.5 5M13.5 4.5l-3 15" />,
  'chevron-down': <path d="m6 9 6 6 6-6" />,
  'chevron-right': <path d="m9 6 6 6-6 6" />,
  'chevron-left': <path d="m15 6-6 6 6 6" />,
  check: <path d="m4.5 12.5 5 5L20 6.5" />,
  'check-circle': (<><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16.5 9" /></>),
  alert: (<><path d="M12 3.5 22 20H2Z" /><path d="M12 10v4.5" /><circle cx="12" cy="17.2" r="1" fill="currentColor" stroke="none" /></>),
  info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5" /><circle cx="12" cy="7.8" r="1.1" fill="currentColor" stroke="none" /></>),
  wifi: (<><path d="M2.5 9.5a14.5 14.5 0 0 1 19 0" /><path d="M5.5 13a10 10 0 0 1 13 0" /><path d="M8.5 16.4a5.5 5.5 0 0 1 7 0" /><circle cx="12" cy="19.5" r="1.2" fill="currentColor" stroke="none" /></>),
  'wifi-off': (<><path d="m3 3 18 18" /><path d="M5.5 13a10 10 0 0 1 4.2-2.5M12 6.3c3.2 0 6.3 1 8.7 3.2" /><path d="M8.5 16.4a5.5 5.5 0 0 1 5.6-1.3" /><circle cx="12" cy="19.5" r="1.2" fill="currentColor" stroke="none" /></>),
  filter: <path d="M4 5h16l-6.2 7.2V19l-3.6-2v-4.8Z" />,
  download: (<><path d="M12 3.5v11M7.5 10 12 14.5 16.5 10" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>),
  edit: (<><path d="M4 20h4.5L20 8.5a2.1 2.1 0 0 0-3-3L5.5 17Z" /><path d="m14.5 8 2.5 2.5" /></>),
  trash: (<><path d="M4.5 7h15" /><path d="M9 7V4.8A1.3 1.3 0 0 1 10.3 3.5h3.4A1.3 1.3 0 0 1 15 4.8V7" /><path d="M6.5 7 7.4 20a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5L17.5 7" /><path d="M10 11v6M14 11v6" /></>),
  pause: (<><rect x="6.5" y="5" width="3.6" height="14" rx="1" /><rect x="13.9" y="5" width="3.6" height="14" rx="1" /></>),
  play: <path d="M7.5 5.5v13l10-6.5Z" />,
  refresh: (<><path d="M20 12a8 8 0 1 1-2.3-5.6" /><path d="M20 3.5V8h-4.5" /></>),
  eye: (<><path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" /><circle cx="12" cy="12" r="2.8" /></>),
  'eye-off': (<><path d="M10.3 6.1A9.8 9.8 0 0 1 12 5.8c6 0 9.5 6.2 9.5 6.2a17.6 17.6 0 0 1-2.4 3.1M14.7 14.6a2.8 2.8 0 0 1-4.4-1.4" /><path d="M6.4 7.4A16.4 16.4 0 0 0 2.5 12S6 18.2 12 18.2a9.6 9.6 0 0 0 3.2-.55" /><path d="m3.5 3.5 17 17" /></>),
  sun: (<><circle cx="12" cy="12" r="4" /><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.2 5.2l1.6 1.6M17.2 17.2l1.6 1.6M18.8 5.2l-1.6 1.6M6.8 17.2l-1.6 1.6" /></>),
  moon: <path d="M20.2 14.5A8.3 8.3 0 0 1 9.5 3.8a8.3 8.3 0 1 0 10.7 10.7Z" />,
  battery: (<><rect x="2.5" y="7.5" width="17" height="9" rx="2" /><path d="M21.5 10.5v3" /></>),
  aperture: (<><circle cx="12" cy="12" r="9" /><path d="m12 3 4.8 8.3M20.8 8.5 12 9.6M19.5 17h-9.6M12 21l-4.8-8.3M3.2 15.5 12 14.4M4.5 7h9.6" /></>),
  'user-check': (<><circle cx="9.5" cy="8" r="3.4" /><path d="M3 20c.7-3.3 3.2-5 6.5-5 1.2 0 2.3.2 3.2.7" /><path d="m14.5 17.5 2.3 2.3 4.2-4.8" /></>),
  'log-out': <path d="M14 4h-7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />,
  copy: (<><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5.5 15H4.5A1.5 1.5 0 0 1 3 13.5v-9A1.5 1.5 0 0 1 4.5 3h9A1.5 1.5 0 0 1 15 4.5v1" /></>),
  bell: (<><path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6" /><path d="M10 19a2.2 2.2 0 0 0 4 0" /></>),
  upload: (<><path d="M12 14.5v-11M7.5 8 12 3.5 16.5 8" /><path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" /></>),
  image: (<><rect x="3" y="4" width="18" height="16" rx="2.5" /><circle cx="9" cy="10" r="1.8" /><path d="m5 18 5-5 3 3 3.5-3.5L21 17" /></>),
  link: (<><path d="M9.5 14.5 14.5 9.5" /><path d="M11 6.5 12.8 4.7a4 4 0 0 1 5.7 5.7L16.5 12.5" /><path d="M13 17.5l-1.8 1.8a4 4 0 0 1-5.7-5.7L7.5 11.5" /></>),
  lock: (<><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /></>),
  mail: (<><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>),
  clock: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.5 2" /></>),
  'arrow-up-right': <path d="M7 17 17 7M9 7h8v8" />,
  sparkles: (<><path d="M12 3.5 13.8 9l5.5 1.8-5.5 1.8L12 18l-1.8-5.4L4.7 10.8 10.2 9Z" /><path d="M19 15.5l.9 2.6 2.6.9-2.6.9-.9 2.6-.9-2.6-2.6-.9 2.6-.9Z" /></>),
  shield: (<><path d="M12 2.8 20 6v6c0 5-3.4 8.4-8 9.2C7.4 20.4 4 17 4 12V6Z" /><path d="m8.8 12 2.3 2.3 4.2-4.3" /></>),
  monitor: (<><rect x="3" y="4.5" width="18" height="12.5" rx="2" /><path d="M9 20.5h6M12 17v3.5" /></>),
  printer: (<><path d="M7 8V3.5h10V8" /><rect x="3.5" y="8" width="17" height="8.5" rx="1.8" /><path d="M7 13.5h10V20.5H7Z" /><circle cx="17.2" cy="11" r="0.9" fill="currentColor" stroke="none" /></>),
  phone: <path d="M6.8 3.5h3l1.5 4.2-2 1.5a12.5 12.5 0 0 0 5.5 5.5l1.5-2 4.2 1.5v3a2 2 0 0 1-2.2 2A17 17 0 0 1 4.8 5.7a2 2 0 0 1 2-2.2Z" />,
  pin: (<><path d="M12 21s7-6.1 7-11a7 7 0 1 0-14 0c0 4.9 7 11 7 11Z" /><circle cx="12" cy="10" r="2.6" /></>),
  send: <path d="M20.5 3.5 3.5 10.8l7 2.2 2.2 7Z" />,
  qr: (<><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h3v3h-3zM20 14v6h-3" /></>),
  wallet: (<><rect x="3" y="6" width="18" height="14" rx="2.5" /><path d="M3 10h18" /><circle cx="16.5" cy="14.8" r="1.2" fill="currentColor" stroke="none" /></>),
  'external': (<><path d="M14 4.5h5.5V10" /><path d="M19.5 4.5 11 13" /><path d="M9 5.5H6A1.5 1.5 0 0 0 4.5 7v11A1.5 1.5 0 0 0 6 19.5h11a1.5 1.5 0 0 0 1.5-1.5v-3" /></>),
  ban: (<><circle cx="12" cy="12" r="9" /><path d="m5.8 5.8 12.4 12.4" /></>),
  'circle-dot': (<><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" /></>),
  zap: <path d="M13 2.5 4.5 13.5H11l-1 8L19.5 10.5H13Z" />,
  heart: <path d="M12 20.5S3.5 15 3.5 9.2A4.6 4.6 0 0 1 12 6.4a4.6 4.6 0 0 1 8.5 2.8c0 5.8-8.5 11.3-8.5 11.3Z" />,
}

export function Icon({ name, size = 18, className = '', strokeWidth = 1.8, style }) {
  const path = PATHS[name] || PATHS['circle-dot']
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={style}
      aria-hidden="true"
    >
      {path}
    </svg>
  )
}

export default Icon
