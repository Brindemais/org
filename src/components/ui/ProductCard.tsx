import { Package, PackageX } from 'lucide-react'
import { formatBRL } from '../../lib/format'
import { ImagePlaceholder } from './ImagePlaceholder'

interface ProductCardProps {
  name: string
  imageUrl?: string | null
  normalPrice: number
  subscriberPrice: number
  stock?: number | null
  partnerName?: string | null
  onView?: () => void
}

export function ProductCard({ name, imageUrl, normalPrice, subscriberPrice, stock, partnerName, onView }: ProductCardProps) {
  const savings = Math.max(0, Math.round(((normalPrice - subscriberPrice) / (normalPrice || 1)) * 100))
  const outOfStock = stock != null && stock <= 0

  return (
    <div className="card-light flex flex-col gap-2.5 transition hover:shadow-soft">
      <div className="relative">
        <ImagePlaceholder src={imageUrl} alt={name} aspect="aspect-square" icon={Package} />
        {savings > 0 && <span className="absolute top-2 left-2 pill bg-ink-950 text-gold-300 font-bold">-{savings}%</span>}
        {outOfStock && (
          <div className="absolute inset-0 bg-white/70 rounded-xl2 flex items-center justify-center">
            <span className="pill bg-black/70 text-white inline-flex items-center gap-1">
              <PackageX size={12} /> Sem estoque
            </span>
          </div>
        )}
      </div>
      <h3 className="font-semibold text-ink-950 text-sm leading-snug line-clamp-2">{name}</h3>
      {partnerName && <p className="text-[11px] text-black/40">{partnerName}</p>}
      <div className="flex items-baseline gap-2">
        <span className="text-xs text-black/40 line-through">{formatBRL(normalPrice)}</span>
        <span className="font-semibold text-ink-950">{formatBRL(subscriberPrice)}</span>
      </div>
      {onView && (
        <button onClick={onView} disabled={outOfStock} className="btn-outline-light !py-2 text-sm mt-1 disabled:opacity-40 disabled:pointer-events-none">
          Ver produto
        </button>
      )}
    </div>
  )
}
