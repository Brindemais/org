let gradId = 0

export function LogoMark({ size = 40 }: { size?: number }) {
  gradId += 1
  const id = `bm-grad-${gradId}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={id} x1="4" y1="4" x2="60" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#f7e2a4" />
          <stop offset="45%" stopColor="#d4941e" />
          <stop offset="100%" stopColor="#8a5c12" />
        </linearGradient>
      </defs>
      <circle cx="32" cy="32" r="29" fill="none" stroke={`url(#${id})`} strokeWidth="2.5" />
      {/* stem of the "b" */}
      <rect x="20" y="12" width="5" height="34" rx="2.5" fill={`url(#${id})`} />
      {/* bowl of the "b" shaped like a glass */}
      <path
        d="M25 26c7-4 17-1 17 9.5S33 47 25 43"
        stroke={`url(#${id})`}
        strokeWidth="5"
        strokeLinecap="round"
        fill="none"
      />
      {/* bubbles inside the glass */}
      <circle cx="34" cy="30" r="1.6" fill={`url(#${id})`} />
      <circle cx="38" cy="35" r="1.2" fill={`url(#${id})`} />
      <circle cx="33" cy="39" r="1.4" fill={`url(#${id})`} />
    </svg>
  )
}

export function Logo({ size = 'md', dark = false, stacked = false }: { size?: 'sm' | 'md' | 'lg'; dark?: boolean; stacked?: boolean }) {
  const dims = size === 'sm' ? 30 : size === 'lg' ? 52 : 38
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg'

  if (stacked) {
    return (
      <div className="flex flex-col items-center select-none">
        <LogoMark size={dims * 1.6} />
        <span className={`font-display font-bold leading-tight mt-2 text-center ${textSize} ${dark ? 'text-ink-950' : 'text-white'}`}>
          brinde<br />
          <span className="text-gold-400">mais</span>
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 select-none">
      <LogoMark size={dims} />
      <span className={`font-display font-bold leading-none ${textSize} ${dark ? 'text-ink-950' : 'text-white'}`}>
        brinde <span className="text-gold-400">mais</span>
      </span>
    </div>
  )
}
