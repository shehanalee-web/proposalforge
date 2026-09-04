const ICONS = {
  logo: (
    <>
      <path d="M8 4.5h5.25L17.5 8.75V18.5A1.5 1.5 0 0 1 16 20H8a1.5 1.5 0 0 1-1.5-1.5V6A1.5 1.5 0 0 1 8 4.5Z" />
      <path d="M13.25 4.5V8.5H17.5" />
      <path d="M10 12.25h4.75M10 15h4.75M10 17.75h3" />
    </>
  ),
  dashboard: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="2" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="2" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="2" />
    </>
  ),
  new: <path d="M12 5v14M5 12h14" />,
  templates: (
    <>
      <rect x="8" y="4" width="12" height="15" rx="1.75" />
      <path d="M6 7.5v11.25A1.75 1.75 0 0 0 7.75 20.5H16" />
    </>
  ),
  history: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.5 2.1" />
    </>
  ),
  proposals: (
    <>
      <path d="M7 3.5h7.5L19.5 9v11.5A1.5 1.5 0 0 1 18 22H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14.5 3.5V9H19.5M8.5 13h7M8.5 17h5" />
    </>
  ),
  brand: (
    <>
      <circle cx="7.5" cy="8" r="3" />
      <circle cx="16" cy="7.5" r="2.25" />
      <circle cx="15.5" cy="16" r="3.25" />
      <circle cx="7.25" cy="16.25" r="2.5" />
    </>
  ),
  services: (
    <>
      <rect x="3.5" y="7" width="17" height="13" rx="1.75" />
      <path d="M8 7V5.75A1.75 1.75 0 0 1 9.75 4h4.5A1.75 1.75 0 0 1 16 5.75V7" />
    </>
  ),
  assets: (
    <>
      <rect x="3.5" y="5.5" width="17" height="13" rx="1.75" />
      <path d="m3.5 15.5 4.5-4.5 3.5 3.5 2.5-2.5 6.5 6.5" />
      <circle cx="15.5" cy="9" r="1.25" />
    </>
  ),
  content: (
    <>
      <rect x="3.5" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13" y="3.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="3.5" y="13" width="7.5" height="7.5" rx="1.5" />
      <path d="M14.5 16.5h4.5M16.75 14.25v4.5" />
    </>
  ),
  cases: (
    <>
      <path d="M5 7.5h14A1.5 1.5 0 0 1 20.5 9v9.5A1.5 1.5 0 0 1 19 20H5a1.5 1.5 0 0 1-1.5-1.5V9A1.5 1.5 0 0 1 5 7.5Z" />
      <path d="M9 7.5V6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 6v1.5" />
    </>
  ),
  testimonials: (
    <>
      <path d="M5 6.5h6.5v6.5H8.5L5 16.5V6.5Z" />
      <path d="M13 10.5H19.5v6.5H16.5L13 20.5V10.5Z" />
    </>
  ),
  team: (
    <>
      <circle cx="9" cy="8" r="2.75" />
      <circle cx="16" cy="9" r="2.25" />
      <path d="M3.5 18.5c.4-3 2.6-4.75 5.5-4.75s5.1 1.75 5.5 4.75" />
      <path d="M14 13.9c1.7-.35 3.6.4 4.6 2.6" />
    </>
  ),
  settings: (
    <>
      <path d="M4 7h9.5M18 7h2M4 12h3.5M12 12h8M4 17h6.5M15 17h5" />
      <circle cx="15.75" cy="7" r="2" />
      <circle cx="9.75" cy="12" r="2" />
      <circle cx="12.75" cy="17" r="2" />
    </>
  ),
  grip: (
    <>
      <circle cx="9" cy="7" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15" cy="7" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="9" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15" cy="12" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="9" cy="17" r="1.15" fill="currentColor" stroke="none" />
      <circle cx="15" cy="17" r="1.15" fill="currentColor" stroke="none" />
    </>
  ),
  more: (
    <>
      <circle cx="12" cy="6.5" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" stroke="none" />
      <circle cx="12" cy="17.5" r="1.2" fill="currentColor" stroke="none" />
    </>
  ),
  check: <path d="M5 12.5 9.5 17 19 7.5" />,
  spark: (
    <>
      <path d="M12 3.5 13.15 8.4 18 9.5 13.15 10.6 12 15.5 10.85 10.6 6 9.5 10.85 8.4 12 3.5Z" />
      <path d="M18.5 14.25 19.05 16.2 21 16.75 19.05 17.3 18.5 19.25 17.95 17.3 16 16.75 17.95 16.2 18.5 14.25Z" />
      <path d="M6.25 14.5 6.7 16.2 8.4 16.65 6.7 17.1 6.25 18.8 5.8 17.1 4.1 16.65 5.8 16.2 6.25 14.5Z" />
    </>
  ),
  typeArchitecture: (
    <>
      <path d="M4 20.5h16" />
      <path d="M6.5 20.5V10l5.5-5.5L17.5 10v10.5" />
      <path d="M10.5 20.5v-4.5h3v4.5" />
    </>
  ),
  typeMotion: (
    <>
      <rect x="4" y="6" width="16" height="12" rx="2" />
      <path d="m10 9.5 5 2.5-5 2.5V9.5Z" />
    </>
  ),
  typeMarketing: (
    <>
      <path d="M5 10.25v3.5h3.25L15 18V6.5l-6.75 3.75H5Z" />
      <path d="M17.25 9.75a2.75 2.75 0 0 1 0 4.5" />
    </>
  ),
  typeAgency: (
    <>
      <path d="M12 4.5 13.4 9h4.7L14.7 11.8 16.1 16.5 12 13.6 7.9 16.5 9.3 11.8 6 9h4.6L12 4.5Z" />
    </>
  ),
  typeConstruction: (
    <>
      <path d="M4 20.5h16" />
      <path d="M7 20.5V12h10v8.5" />
      <path d="M7 12 12 6.75 17 12" />
    </>
  ),
  typeSoftware: (
    <>
      <path d="m8 9-3.5 3L8 15M16 9l3.5 3L16 15M13.25 7.5 10.75 16.5" />
    </>
  ),
  typeCatalogue: (
    <>
      <rect x="4" y="4.5" width="7" height="7" rx="1.25" />
      <rect x="13" y="4.5" width="7" height="7" rx="1.25" />
      <rect x="4" y="13.5" width="7" height="7" rx="1.25" />
      <rect x="13" y="13.5" width="7" height="7" rx="1.25" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M15.5 15.5 20 20" />
    </>
  ),
  close: <path d="M6 6 18 18M18 6 6 18" />,
  chevronDown: <path d="M5 9l7 6 7-6" />,
  /* Block-type icons */
  blockCover: (
    <>
      <rect x="3.5" y="4" width="17" height="16" rx="2" />
      <path d="M7.5 15h9M7.5 18h5" />
      <path d="M3.5 11h17" />
    </>
  ),
  blockText: (
    <>
      <path d="M4 7h16M4 12h12M4 17h14" />
    </>
  ),
  blockGallery: (
    <>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m3 16 5-5 4 4 3-3 6 5" />
      <circle cx="15.5" cy="9.5" r="1.5" />
    </>
  ),
  blockPricing: (
    <>
      <path d="M12 4v16M8 8h8M8 12h8M8 16h5" />
      <circle cx="12" cy="4" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  blockTimeline: (
    <>
      <path d="M12 4v16" />
      <circle cx="12" cy="7" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="12" cy="17" r="2" />
      <path d="M14 7h5M5 12h7M14 17h4" />
    </>
  ),
  blockDeliverables: (
    <>
      <path d="M9 6h10M9 10h8M9 14h10M9 18h6" />
      <circle cx="5.5" cy="6" r="1" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="14" r="1" fill="currentColor" stroke="none" />
      <circle cx="5.5" cy="18" r="1" fill="currentColor" stroke="none" />
    </>
  ),
  blockSpecs: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M4 9h16M4 14h16M12 9v11" />
    </>
  ),
  blockTeam: (
    <>
      <circle cx="9" cy="8" r="2.75" />
      <circle cx="16" cy="9" r="2.25" />
      <path d="M3.5 18.5c.4-3 2.6-4.75 5.5-4.75s5.1 1.75 5.5 4.75" />
      <path d="M14 13.9c1.7-.35 3.6.4 4.6 2.6" />
    </>
  ),
  blockTestimonials: (
    <>
      <path d="M5 6.5h6.5v6.5H8.5L5 16.5V6.5Z" />
      <path d="M13 10.5H19.5v6.5H16.5L13 20.5V10.5Z" />
    </>
  ),
  blockFaq: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 9.5a2.5 2.5 0 0 1 4.5 1.5c0 1.5-2.5 2-2.5 4" />
      <circle cx="12" cy="17.5" r=".75" fill="currentColor" stroke="none" />
    </>
  ),
  blockTerms: (
    <>
      <path d="M7 3.5h7.5L19.5 9v11.5A1.5 1.5 0 0 1 18 22H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14.5 3.5V9H19.5M8.5 13h7M8.5 17h5" />
    </>
  ),
  blockSignature: (
    <>
      <path d="M4 18h16" />
      <path d="M6 14c1.5-3 3-6 4.5-6s2 3 3.5 3 2.5-2 4-2" />
    </>
  ),
  blockAttachments: (
    <>
      <path d="M14 3v7.5a2.5 2.5 0 0 1-5 0V5a4 4 0 0 1 8 0v6.5a5.5 5.5 0 0 1-11 0V7" />
    </>
  ),
  blockCustom: (
    <>
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <path d="M12 8v8M8 12h8" />
    </>
  ),
  /* Utility icons */
  duplicate: (
    <>
      <rect x="8" y="8" width="11" height="11" rx="1.75" />
      <path d="M16 6.5V5.75A1.75 1.75 0 0 0 14.25 4H5.75A1.75 1.75 0 0 0 4 5.75v8.5A1.75 1.75 0 0 0 5.75 16H7.5" />
    </>
  ),
  trash: (
    <>
      <path d="M5 7h14M9 7V5.5h6V7M7 7l.75 12.5a1.5 1.5 0 0 0 1.5 1.5h5.5a1.5 1.5 0 0 0 1.5-1.5L17 7" />
    </>
  ),
  eye: (
    <>
      <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Z" />
      <circle cx="12" cy="12" r="3" />
    </>
  ),
  eyeOff: (
    <>
      <path d="M4.5 4.5 19.5 19.5" />
      <path d="M17.9 14.2A9.7 9.7 0 0 0 21.5 12S18 5.5 12 5.5a8.4 8.4 0 0 0-3.1.6" />
      <path d="M6.7 8.3A9.7 9.7 0 0 0 2.5 12S6 18.5 12 18.5a8.5 8.5 0 0 0 2.5-.4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  undo: <path d="M8 8H4.5V4.5M4.7 8A8 8 0 1 1 4 12" />,
  redo: <path d="M16 8h3.5V4.5M19.3 8A8 8 0 1 0 20 12" />,
  arrowUp: <path d="M12 19V5M6 11l6-6 6 6" />,
  arrowDown: <path d="M12 5v14M6 13l6 6 6-6" />,
  chevronUp: <path d="M5 15l7-6 7 6" />,
  chevronLeft: <path d="M15 5l-6 7 6 7" />,
  chevronRight: <path d="M9 5l6 7-6 7" />,
  download: (
    <>
      <path d="M12 4v11" />
      <path d="m7.5 11.5 4.5 4.5 4.5-4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  print: (
    <>
      <path d="M7 8V4.5h10V8" />
      <path d="M7 15.5H5.5A1.5 1.5 0 0 1 4 14v-4.5A1.5 1.5 0 0 1 5.5 8h13A1.5 1.5 0 0 1 20 9.5V14a1.5 1.5 0 0 1-1.5 1.5H17" />
      <rect x="7" y="13.5" width="10" height="6.5" rx="1" />
    </>
  ),
  share: (
    <>
      <circle cx="18" cy="5.5" r="2.25" />
      <circle cx="6" cy="12" r="2.25" />
      <circle cx="18" cy="18.5" r="2.25" />
      <path d="M8.1 10.9 15.9 6.6M8.1 13.1 15.9 17.4" />
    </>
  ),
  bookmark: (
    <>
      <path d="M7 4.5h10A1.5 1.5 0 0 1 18.5 6v14L12 16.5 5.5 20V6A1.5 1.5 0 0 1 7 4.5Z" />
    </>
  ),
  star: (
    <>
      <path d="m12 4.5 2.1 4.3 4.7.7-3.4 3.3.8 4.7L12 15.4 7.8 17.5l.8-4.7-3.4-3.3 4.7-.7L12 4.5Z" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="11" height="12" rx="1.5" />
      <path d="M6 16H5a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 5 3.5h9.5A1.5 1.5 0 0 1 16 5v1" />
    </>
  ),
  maximize: (
    <>
      <path d="M9 5H5v4M15 5h4v4M5 15v4h4M19 15v4h-4" />
    </>
  ),
  minimize: (
    <>
      <path d="M9 5H5v4M15 5h4v4M5 15v4h4M19 15v4h-4" />
      <rect x="8" y="8" width="8" height="8" rx="1" />
    </>
  ),
  zoomIn: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M10.5 7.5v6M7.5 10.5h6M15.5 15.5 20 20" />
    </>
  ),
  zoomOut: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M7.5 10.5h6M15.5 15.5 20 20" />
    </>
  ),
  menu: (
    <>
      <path d="M5 7h14M5 12h14M5 17h14" />
    </>
  ),
  message: (
    <>
      <path d="M5 5.5h14A1.5 1.5 0 0 1 20.5 7v8A1.5 1.5 0 0 1 19 16.5H9.5L5 20V7A1.5 1.5 0 0 1 5 5.5Z" />
    </>
  ),
  xCircle: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
  fileImage: (
    <>
      <path d="M7 3.5h7.5L19.5 9v11.5A1.5 1.5 0 0 1 18 22H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14.5 3.5V9H19.5" />
      <path d="m7 17.5 3-3 2 2 2.5-2.5 3.5 3.5" />
    </>
  ),
  filePdf: (
    <>
      <path d="M7 3.5h7.5L19.5 9v11.5A1.5 1.5 0 0 1 18 22H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14.5 3.5V9H19.5M8.5 14h3.5a1.5 1.5 0 0 1 0 3H8.5v3" />
    </>
  ),
  fileVideo: (
    <>
      <path d="M7 3.5h7.5L19.5 9v11.5A1.5 1.5 0 0 1 18 22H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14.5 3.5V9H19.5" />
      <path d="m9.5 13.5 6 3.25-6 3.25v-6.5Z" />
    </>
  ),
  fileZip: (
    <>
      <path d="M7 3.5h7.5L19.5 9v11.5A1.5 1.5 0 0 1 18 22H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14.5 3.5V9H19.5M10 7v2M10 11v2M10 15v2" />
    </>
  ),
  fileCad: (
    <>
      <path d="M7 3.5h7.5L19.5 9v11.5A1.5 1.5 0 0 1 18 22H7a1.5 1.5 0 0 1-1.5-1.5V5A1.5 1.5 0 0 1 7 3.5Z" />
      <path d="M14.5 3.5V9H19.5M8.5 16l3.5-6 3.5 6H8.5Z" />
    </>
  ),
  clipboard: (
    <>
      <rect x="7" y="5" width="10" height="15" rx="1.5" />
      <path d="M9 5V4.5A1.5 1.5 0 0 1 10.5 3h3A1.5 1.5 0 0 1 15 4.5V5" />
      <path d="M10 10h4M10 13.5h4M10 17h2.5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 19V8" />
      <path d="m7.5 12.5 4.5-4.5 4.5 4.5" />
      <path d="M5 19.5h14" />
    </>
  ),
  pen: (
    <>
      <path d="M14.5 5.5 18.5 9.5" />
      <path d="M5 19.5 7.2 18.3 16.8 8.7 14.7 6.6 5.1 16.2 4 19.5Z" />
    </>
  ),
  card: (
    <>
      <rect x="3.5" y="6" width="17" height="12" rx="1.75" />
      <path d="M3.5 10h17M7 15h4" />
    </>
  ),
  lock: (
    <>
      <rect x="6" y="11" width="12" height="9" rx="1.5" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
}

function Icon({ name, size = 18, className }) {
  const glyph = ICONS[name]

  if (!glyph) return null

  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {glyph}
    </svg>
  )
}

export default Icon
