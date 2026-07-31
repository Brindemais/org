let gradId = 0

export function LogoMark({ size = 40 }: { size?: number }) {
  gradId += 1
  const goldId = `bm-gold-${gradId}`
  const liquidId = `bm-liquid-${gradId}`

  return (
    <svg width={size} height={size} viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={goldId} x1="6" y1="4" x2="58" y2="60" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#fbe9b8" />
          <stop offset="40%" stopColor="#e0a935" />
          <stop offset="75%" stopColor="#b8791a" />
          <stop offset="100%" stopColor="#8a5c12" />
        </linearGradient>
        <linearGradient id={liquidId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8d372" />
          <stop offset="100%" stopColor="#c9861a" />
        </linearGradient>
      </defs>

      {/* stem of the "b" */}
      <rect x="17" y="9" width="8" height="30" rx="4" fill={`url(#${goldId})`} />

      {/* bowl of the "b" — goblet outline */}
      <path
        d="M23 27c9-6 24-2.5 24 10.5S36 52 23 46.5"
        stroke={`url(#${goldId})`}
        strokeWidth="6.2"
        strokeLinecap="round"
        fill="none"
      />
      {/* liquid inside the goblet */}
      <path d="M27.5 33.5c6-3 14.5-1 14.5 5.5 0 5.5-6 8.7-11.5 7.3" stroke={`url(#${liquidId})`} strokeWidth="3.2" strokeLinecap="round" fill="none" opacity="0.9" />
      <circle cx="36" cy="34" r="1.3" fill="#fde9b0" />
      <circle cx="39.5" cy="39" r="1" fill="#fde9b0" />
      <circle cx="34.5" cy="43.5" r="1.1" fill="#fde9b0" />

      {/* sparkle burst, upper right */}
      <path d="M49 10.5 L50.6 15.4 L55.5 17 L50.6 18.6 L49 23.5 L47.4 18.6 L42.5 17 L47.4 15.4 Z" fill={`url(#${goldId})`} />
      <path d="M56.5 21.5 L57.4 24 L59.9 24.9 L57.4 25.8 L56.5 28.3 L55.6 25.8 L53.1 24.9 L55.6 24 Z" fill={`url(#${goldId})`} opacity="0.85" />
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

export function LogoBadge({ size = 180 }: { size?: number }) {
  gradId += 1
  const goldId = `bm-badge-gold-${gradId}`
  return (
    <div className="inline-flex flex-col items-center select-none">
      <svg width={size} height={size} viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id={goldId} x1="20" y1="10" x2="220" y2="230" gradientUnits="userSpaceOnUse">
            <stop offset="0%" stopColor="#fbe9b8" />
            <stop offset="40%" stopColor="#e0a935" />
            <stop offset="75%" stopColor="#b8791a" />
            <stop offset="100%" stopColor="#8a5c12" />
          </linearGradient>
        </defs>
        <circle cx="120" cy="120" r="112" fill="white" stroke={`url(#${goldId})`} strokeWidth="7" />
        <circle cx="120" cy="120" r="100" fill="none" stroke={`url(#${goldId})`} strokeWidth="1.5" opacity="0.55" />

        <g transform="translate(24,19) scale(2.5)">
          <rect x="17" y="9" width="8" height="30" rx="4" fill={`url(#${goldId})`} />
          <path d="M23 27c9-6 24-2.5 24 10.5S36 52 23 46.5" stroke={`url(#${goldId})`} strokeWidth="6.2" strokeLinecap="round" fill="none" />
          <circle cx="37" cy="35" r="1.3" fill="#c9861a" />
          <circle cx="33" cy="43.5" r="1.2" fill="#c9861a" />
          <path d="M49 10.5 L50.6 15.4 L55.5 17 L50.6 18.6 L49 23.5 L47.4 18.6 L42.5 17 L47.4 15.4 Z" fill={`url(#${goldId})`} />
        </g>

        <text x="120" y="174" textAnchor="middle" fontFamily="'Manrope', sans-serif" fontWeight="800" fontSize="28" fill="#0f0f10">brinde</text>
        <text x="120" y="200" textAnchor="middle" fontFamily="'Manrope', sans-serif" fontWeight="800" fontSize="28" fill="#c9861a">mais</text>
        <line x1="72" y1="209" x2="168" y2="209" stroke={`url(#${goldId})`} strokeWidth="1" opacity="0.6" />
        <circle cx="120" cy="209" r="2" fill={`url(#${goldId})`} />
        <text x="120" y="220" textAnchor="middle" fontFamily="'Manrope', sans-serif" fontWeight="700" fontSize="7.5" letterSpacing="0.4" fill="#a3761f">MAIS AMIGOS. MAIS BENEFÍCIOS.</text>
        <text x="120" y="229" textAnchor="middle" fontFamily="'Manrope', sans-serif" fontWeight="700" fontSize="7.5" letterSpacing="0.4" fill="#a3761f">MAIS MOTIVOS PARA BRINDAR!</text>
      </svg>
    </div>
  )
}
