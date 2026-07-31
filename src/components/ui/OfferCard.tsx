import { Tag } from 'lucide-react'
import { formatBRL, formatDate } from '../../lib/format'
import { ImagePlaceholder } from './ImagePlaceholder'

interface OfferCardProps {
  title: string
  partnerName?: string | null
  imageUrl?: string | null
  normalPrice?: number | null
  subscriberPrice?: number | null
  discountPct?: number | null
  validUntil?: string | null
  rulesSummary?: string | null
  onClaim?: () => void
}

export function OfferCard({
  title,
  partnerName,
  imageUrl,
  normalPrice,
  subscriberPrice,
  discountPct,
  validUntil,
  rulesSummary,
  onClaim,
}: OfferCardProps) {
  return (
    <div className="card-light flex flex-col gap-3 transition hover:shadow-soft">
      <div className="relative">
        <ImagePlaceholder src={imageUrl} alt={title} aspect="aspect-video" icon={Tag} />
        {discountPct != null && (
          <span className="absolute top-2 left-2 pill bg-ink-950 text-gold-300 font-bold">-{discountPct}%</span>
        )}
      </div>
      <div>
        <h3 className="font-semibold text-ink-950 leading-snug">{title}</h3>
        {partnerName && <p className="text-xs text-black/45 mt-0.5">{partnerName}</p>}
      </div>
      {normalPrice != null && subscriberPrice != null && (
        <div className="flex items-baseline gap-2">
          <span className="text-xs text-black/40 line-through">{formatBRL(normalPrice)}</span>
          <span className="font-semibold text-ink-950">{formatBRL(subscriberPrice)}</span>
        </div>
      )}
      {rulesSummary && <p className="text-xs text-black/45 leading-relaxed">{rulesSummary}</p>}
      {validUntil && <p className="text-[11px] text-black/35">Válido até {formatDate(validUntil)}</p>}
      {onClaim && (
        <button onClick={onClaim} className="btn-gold !py-2 text-sm mt-1">
          Aproveitar
        </button>
      )}
    </div>
  )
}
