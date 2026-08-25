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
  history: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3.5 2.1" />
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
