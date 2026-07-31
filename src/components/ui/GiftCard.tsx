import type { ReactNode } from 'react'
import { Sparkles } from 'lucide-react'

interface GiftCardProps {
  name: string
  description?: string
  deadlineLabel?: string
  stockNote?: string
  image: ReactNode
  onView?: () => void
}

export function GiftCard({ name, description, deadlineLabel, stockNote, image, onView }: GiftCardProps) {
  return (
    <div className="card-light flex flex-col">
      <span className="pill bg-gold-400/15 text-gold-600 w-fit mb-3 inline-flex items-center gap-1">
        <Sparkles size={11} /> Exclusivo para assinantes ativos
      </span>
      <h3 className="font-display text-lg font-semibold mb-1 text-ink-950">{name}</h3>
      {description && <p className="text-sm text-black/50 mb-4">{description}</p>}
      <div className="w-full aspect-video rounded-lg bg-gold-gradient-soft border border-gold-400/20 flex items-center justify-center mb-4 overflow-hidden">
        {image}
      </div>
      <div className="space-y-1 mb-4">
        <p className="text-xs text-black/45">O modelo do brinde pode variar de acordo com o parceiro escolhido.</p>
        {deadlineLabel && <p className="text-xs text-black/45">Prazo para retirada: {deadlineLabel}</p>}
        {stockNote && <p className="text-xs text-black/45">{stockNote}</p>}
      </div>
      {onView && (
        <button onClick={onView} className="btn-gold w-full !py-2.5 text-sm">
          Ver brinde do mês
        </button>
      )}
    </div>
  )
}
