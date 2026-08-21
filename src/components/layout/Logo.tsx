import logoMarkUrl from '../../assets/brand/logo-mark.webp'
import logoWordmarkUrl from '../../assets/brand/logo-wordmark.webp'
import logoLockupUrl from '../../assets/brand/logo-lockup.webp'

// Brand assets: black + gold 3D artwork supplied by the client (Aug/2026),
// background-removed and cropped. They already read well on both light and
// dark surfaces, so unlike the old hand-drawn SVG mark these no longer need
// a `dark` prop to swap colors — it's kept on `Logo` only so existing call
// sites (`<Logo dark />` on light-background pages) don't need touching.

export function LogoMark({ size = 40 }: { size?: number }) {
  return (
    <img
      src={logoMarkUrl}
      alt=""
      draggable={false}
      className="select-none"
      style={{ height: size, width: 'auto' }}
    />
  )
}

export function Logo({ size = 'md', stacked = false }: { size?: 'sm' | 'md' | 'lg'; dark?: boolean; stacked?: boolean }) {
  const dims = size === 'sm' ? 26 : size === 'lg' ? 46 : 34

  if (stacked) {
    return (
      <img
        src={logoLockupUrl}
        alt="Brinde Mais"
        draggable={false}
        className="select-none"
        style={{ height: dims * 2.6, width: 'auto' }}
      />
    )
  }

  return (
    <div role="img" aria-label="Brinde Mais" className="flex items-center gap-2 select-none">
      <img src={logoMarkUrl} alt="" draggable={false} style={{ height: dims, width: 'auto' }} />
      <img src={logoWordmarkUrl} alt="" draggable={false} style={{ height: dims * 0.62, width: 'auto' }} />
    </div>
  )
}

export function LogoBadge({ size = 180 }: { size?: number }) {
  return (
    <img
      src={logoLockupUrl}
      alt="Brinde Mais"
      draggable={false}
      className="select-none"
      style={{ height: size, width: 'auto' }}
    />
  )
}
