import type { LucideIcon } from 'lucide-react'
import { ImageIcon } from 'lucide-react'

interface ImagePlaceholderProps {
  /** Real photo URL. When absent, a branded placeholder is shown so the layout is ready to receive the final asset. */
  src?: string | null
  alt: string
  icon?: LucideIcon
  aspect?: string
  className?: string
  /** Above-the-fold images (e.g. hero) should not be lazy-loaded */
  priority?: boolean
  rounded?: string
}

export function ImagePlaceholder({
  src,
  alt,
  icon: Icon = ImageIcon,
  aspect = 'aspect-square',
  className = '',
  priority = false,
  rounded = 'rounded-xl2',
}: ImagePlaceholderProps) {
  if (src) {
    return (
      <div className={`${aspect} ${rounded} overflow-hidden bg-surface-muted ${className}`}>
        <img
          src={src}
          alt={alt}
          loading={priority ? 'eager' : 'lazy'}
          decoding="async"
          className="w-full h-full object-cover"
        />
      </div>
    )
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={`${aspect} ${rounded} bg-gold-gradient-soft border border-gold-400/20 flex items-center justify-center ${className}`}
    >
      <Icon size={28} className="text-gold-500/60" strokeWidth={1.5} />
    </div>
  )
}
