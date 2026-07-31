import { MapPin, Clock, Gift } from 'lucide-react'
import { formatBRL } from '../../lib/format'
import { PARTNER_CATEGORIES } from '../../lib/types'
import { ImagePlaceholder } from './ImagePlaceholder'

interface PartnerCardProps {
  name: string
  category: string
  neighborhood?: string | null
  logoUrl?: string | null
  distanceLabel?: string | null
  openingHours?: string | null
  hasStock?: boolean
  discountLabel?: string | null
  normalPrice?: number | null
  subscriberPrice?: number | null
  onView?: () => void
}

export function PartnerCard({
  name,
  category,
  neighborhood,
  logoUrl,
  distanceLabel,
  openingHours,
  hasStock,
  discountLabel,
  normalPrice,
  subscriberPrice,
  onView,
}: PartnerCardProps) {
  const categoryLabel = PARTNER_CATEGORIES.find((c) => c.value === category)?.label ?? category

  return (
    <div className="card-light flex flex-col gap-3 transition hover:shadow-soft">
      <div className="flex items-center gap-3">
        <ImagePlaceholder
          src={logoUrl}
          alt={`Logotipo de ${name}`}
          aspect="aspect-square"
          rounded="rounded-full"
          className="w-12 h-12 shrink-0"
        />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-ink-950 truncate">{name}</p>
          <p className="text-xs text-black/45">{categoryLabel}</p>
        </div>
        {hasStock && (
          <span className="badge-success shrink-0">
            <Gift size={11} /> Brinde
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-black/50">
        {neighborhood && (
          <span className="inline-flex items-center gap-1">
            <MapPin size={12} /> {neighborhood}
            {distanceLabel ? ` · ${distanceLabel}` : ''}
          </span>
        )}
        {openingHours && (
          <span className="inline-flex items-center gap-1">
            <Clock size={12} /> {openingHours}
          </span>
        )}
      </div>

      {(discountLabel || (normalPrice && subscriberPrice)) && (
        <div className="flex items-center justify-between rounded-lg bg-gold-400/5 border border-gold-400/15 px-3 py-2">
          {discountLabel && <span className="text-xs font-semibold text-gold-600">{discountLabel}</span>}
          {normalPrice != null && subscriberPrice != null && (
            <span className="text-xs text-black/50">
              <span className="line-through mr-1.5">{formatBRL(normalPrice)}</span>
              <span className="font-semibold text-ink-950">{formatBRL(subscriberPrice)}</span>
            </span>
          )}
        </div>
      )}

      {onView && (
        <button onClick={onView} className="btn-outline-light !py-2 text-sm mt-1">
          Ver parceiro
        </button>
      )}
    </div>
  )
}
