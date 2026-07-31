let uid = 0
function nextId(prefix: string) {
  uid += 1
  return `${prefix}-${uid}`
}

export function BeerGlassArt({ width = 220 }: { width?: number }) {
  const liquidId = nextId('liquid')
  const glassId = nextId('glass')
  const height = width * 1.35

  return (
    <svg width={width} height={height} viewBox="0 0 220 297" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={liquidId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f6c453" />
          <stop offset="100%" stopColor="#c9861a" />
        </linearGradient>
        <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.5" />
          <stop offset="50%" stopColor="#ffffff" stopOpacity="0.05" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.25" />
        </linearGradient>
      </defs>

      {/* base + stem */}
      <ellipse cx="110" cy="282" rx="34" ry="7" fill="#d9d9d9" opacity="0.5" />
      <rect x="103" y="220" width="14" height="58" rx="6" fill="#e9e9e9" opacity="0.6" />

      {/* goblet bowl */}
      <path
        d="M42 40 C42 40 50 150 62 190 C74 226 92 226 110 226 C128 226 146 226 158 190 C170 150 178 40 178 40 Z"
        fill="white"
        fillOpacity="0.10"
        stroke="white"
        strokeOpacity="0.5"
        strokeWidth="2.5"
      />

      {/* liquid */}
      <path
        d="M50 95 C50 95 56 155 66 187 C77 220 93 220 110 220 C127 220 143 220 154 187 C164 155 170 95 170 95 Z"
        fill={`url(#${liquidId})`}
      />

      {/* foam */}
      <path
        d="M46 70 C46 70 44 92 60 96 C64 84 78 84 82 94 C88 80 104 80 108 92 C114 78 132 80 136 92 C142 82 158 84 160 96 C172 92 174 72 174 72 C174 72 168 40 110 40 C52 40 46 70 46 70 Z"
        fill="white"
      />
      <circle cx="70" cy="60" r="3.5" fill="white" />
      <circle cx="150" cy="58" r="3" fill="white" />
      <circle cx="110" cy="52" r="4" fill="white" />

      {/* glass highlight */}
      <path d="M54 55 C50 100 58 170 74 210" stroke={`url(#${glassId})`} strokeWidth="6" strokeLinecap="round" fill="none" />

      {/* bubbles inside liquid */}
      <circle cx="95" cy="140" r="2" fill="#fde9b0" opacity="0.8" />
      <circle cx="120" cy="170" r="1.6" fill="#fde9b0" opacity="0.8" />
      <circle cx="105" cy="190" r="1.4" fill="#fde9b0" opacity="0.8" />
      <circle cx="130" cy="130" r="1.8" fill="#fde9b0" opacity="0.8" />
    </svg>
  )
}

export function BeerBottleArt({ width = 140 }: { width?: number }) {
  const glassId = nextId('bottleglass')
  const labelGrad = nextId('label')
  const height = width * 2.05

  return (
    <svg width={width} height={height} viewBox="0 0 140 287" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3a2a10" />
          <stop offset="50%" stopColor="#6b4a16" />
          <stop offset="100%" stopColor="#2c2009" />
        </linearGradient>
        <linearGradient id={labelGrad} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f7e2a4" />
          <stop offset="100%" stopColor="#d4941e" />
        </linearGradient>
      </defs>

      {/* shadow */}
      <ellipse cx="70" cy="278" rx="38" ry="7" fill="black" opacity="0.15" />

      {/* neck */}
      <rect x="58" y="8" width="24" height="46" rx="4" fill={`url(#${glassId})`} />
      {/* cap */}
      <rect x="55" y="0" width="30" height="14" rx="3" fill="#8a5c12" />

      {/* body */}
      <path
        d="M58 50 C40 66 28 92 28 130 L28 250 C28 264 40 274 58 274 L82 274 C100 274 112 264 112 250 L112 130 C112 92 100 66 82 50 Z"
        fill={`url(#${glassId})`}
      />

      {/* label */}
      <rect x="34" y="150" width="72" height="66" rx="6" fill={`url(#${labelGrad})`} />
      <circle cx="70" cy="172" r="13" fill="#08080a" />
      <text x="70" y="177" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="15" fill="#d4941e">b</text>
      <text x="70" y="200" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="9" fill="#08080a">BRINDE MAIS</text>

      {/* highlight */}
      <path d="M40 70 C34 100 32 150 32 200" stroke="white" strokeOpacity="0.15" strokeWidth="6" strokeLinecap="round" fill="none" />
    </svg>
  )
}
