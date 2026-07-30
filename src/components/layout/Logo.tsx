export function Logo({ size = 'md', dark = false }: { size?: 'sm' | 'md' | 'lg'; dark?: boolean }) {
  const dims = size === 'sm' ? 28 : size === 'lg' ? 48 : 36
  const textSize = size === 'sm' ? 'text-base' : size === 'lg' ? 'text-2xl' : 'text-lg'
  return (
    <div className="flex items-center gap-2 select-none">
      <div
        className="rounded-full flex items-center justify-center font-display font-bold"
        style={{
          width: dims, height: dims,
          background: 'linear-gradient(135deg,#f4da8c,#d4941e 55%,#8a5c12)',
          color: '#08080a',
          fontSize: dims * 0.55,
        }}
      >
        b
      </div>
      <span className={`font-display font-semibold leading-none ${textSize} ${dark ? 'text-ink-950' : 'text-white'}`}>
        brinde<br className="hidden" /> mais
      </span>
    </div>
  )
}
