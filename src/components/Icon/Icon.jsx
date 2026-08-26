const ICONS = {
  logo: <path d="M13.6 2 5 13.2h5.2L9.3 22 19 10.5h-6.1L13.6 2Z" fill="currentColor" stroke="none" />,
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
