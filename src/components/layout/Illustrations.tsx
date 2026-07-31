let uid = 0
function nextId(prefix: string) {
  uid += 1
  return `${prefix}-${uid}`
}

export function BeerGlassArt({ width = 220 }: { width?: number }) {
  const liquidId = nextId('liquid')
  const glassId = nextId('glass')
  const coasterId = nextId('coaster')
  const foamId = nextId('foam')
  const height = width * 1.18

  return (
    <svg width={width} height={height} viewBox="0 0 240 283" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id={liquidId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#f8d372" />
          <stop offset="55%" stopColor="#e2a53a" />
          <stop offset="100%" stopColor="#b87a1a" />
        </linearGradient>
        <linearGradient id={glassId} x1="0" y1="0" x2="1" y2="0.3">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.65" />
          <stop offset="35%" stopColor="#ffffff" stopOpacity="0.08" />
          <stop offset="70%" stopColor="#ffffff" stopOpacity="0.02" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0.3" />
        </linearGradient>
        <radialGradient id={coasterId} cx="0.35" cy="0.3" r="0.8">
          <stop offset="0%" stopColor="#f7e2a4" />
          <stop offset="55%" stopColor="#d4941e" />
          <stop offset="100%" stopColor="#8a5c12" />
        </radialGradient>
        <linearGradient id={foamId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="100%" stopColor="#fbf3de" />
        </linearGradient>
      </defs>

      {/* soft ground shadow */}
      <ellipse cx="120" cy="270" rx="72" ry="10" fill="#000000" opacity="0.08" />

      {/* gold coaster */}
      <ellipse cx="120" cy="262" rx="58" ry="13" fill={`url(#${coasterId})`} />
      <ellipse cx="120" cy="259" rx="58" ry="12" fill="none" stroke="#fff6de" strokeOpacity="0.5" strokeWidth="1" />

      {/* short stem */}
      <rect x="110" y="238" width="20" height="20" rx="4" fill="#e7e7ea" opacity="0.55" />

      {/* tulip glass body */}
      <path
        d="M46 44
           C40 100 44 150 66 190
           C82 218 96 236 120 236
           C144 236 158 218 174 190
           C196 150 200 100 194 44
           C194 44 210 34 210 26
           C210 20 204 18 198 22
           C190 27 184 34 184 34
           C170 26 148 22 120 22
           C92 22 70 26 56 34
           C56 34 50 27 42 22
           C36 18 30 20 30 26
           C30 34 46 44 46 44 Z"
        fill="white"
        fillOpacity="0.08"
        stroke="white"
        strokeOpacity="0.55"
        strokeWidth="2.5"
      />

      {/* liquid */}
      <path
        d="M53 92 C53 92 55 148 72 184 C86 212 98 228 120 228 C142 228 154 212 168 184 C185 148 187 92 187 92 Z"
        fill={`url(#${liquidId})`}
      />

      {/* foam */}
      <path
        d="M48 60 C46 74 48 90 53 92 L187 92 C192 90 194 74 192 60
           C192 60 200 46 190 40 C184 52 172 48 170 40
           C160 50 148 46 146 38
           C136 48 122 46 120 38
           C118 46 104 48 94 38
           C92 46 80 50 70 40
           C68 48 56 52 50 40
           C40 46 48 60 48 60 Z"
        fill={`url(#${foamId})`}
      />
      <circle cx="80" cy="48" r="3.2" fill="white" />
      <circle cx="160" cy="46" r="2.8" fill="white" />
      <circle cx="120" cy="42" r="3.6" fill="white" />
      <circle cx="100" cy="52" r="2" fill="white" />
      <circle cx="140" cy="50" r="2.2" fill="white" />

      {/* glass highlight streak */}
      <path d="M62 50 C56 100 62 165 84 202" stroke={`url(#${glassId})`} strokeWidth="9" strokeLinecap="round" fill="none" />
      <path d="M182 55 C186 95 180 150 166 190" stroke="white" strokeOpacity="0.12" strokeWidth="5" strokeLinecap="round" fill="none" />

      {/* condensation droplets */}
      <circle cx="70" cy="130" r="1.6" fill="white" opacity="0.5" />
      <circle cx="176" cy="150" r="1.4" fill="white" opacity="0.45" />
      <circle cx="66" cy="170" r="1.2" fill="white" opacity="0.4" />
      <circle cx="182" cy="110" r="1.3" fill="white" opacity="0.4" />

      {/* bubbles rising in liquid */}
      <circle cx="105" cy="150" r="2" fill="#fde9b0" opacity="0.85" />
      <circle cx="132" cy="180" r="1.6" fill="#fde9b0" opacity="0.85" />
      <circle cx="115" cy="200" r="1.4" fill="#fde9b0" opacity="0.85" />
      <circle cx="140" cy="140" r="1.8" fill="#fde9b0" opacity="0.85" />

      {/* printed logo on the glass */}
      <g transform="translate(103,96) scale(0.62)">
        <rect x="17" y="9" width="8" height="30" rx="4" fill="white" />
        <path d="M23 27c9-6 24-2.5 24 10.5S36 52 23 46.5" stroke="white" strokeWidth="6.2" strokeLinecap="round" fill="none" />
      </g>
      <text x="120" y="150" textAnchor="middle" fontFamily="'Manrope', sans-serif" fontWeight="800" fontSize="15" fill="white">brinde</text>
      <text x="120" y="164" textAnchor="middle" fontFamily="'Manrope', sans-serif" fontWeight="800" fontSize="15" fill="#fff3d6">mais</text>
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
      <g transform="translate(58,158) scale(0.5)">
        <rect x="17" y="9" width="8" height="30" rx="4" fill="#0f0f10" />
        <path d="M23 27c9-6 24-2.5 24 10.5S36 52 23 46.5" stroke="#0f0f10" strokeWidth="6.2" strokeLinecap="round" fill="none" />
      </g>
      <text x="70" y="200" textAnchor="middle" fontFamily="Georgia, serif" fontWeight="700" fontSize="9" fill="#08080a">BRINDE MAIS</text>

      {/* highlight */}
      <path d="M40 70 C34 100 32 150 32 200" stroke="white" strokeOpacity="0.15" strokeWidth="6" strokeLinecap="round" fill="none" />
    </svg>
  )
}
