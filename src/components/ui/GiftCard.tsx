import type { ReactNode } from 'react'
import { Lock, Wine, Gift, ShieldCheck } from 'lucide-react'

interface GiftCardProps {
  name: string
  description?: string
  deadlineLabel?: string
  stockNote?: string
  image: ReactNode
  onView?: () => void
}

export function GiftCard({ name, description, deadlineLabel, stockNote, image, onView }: GiftCardProps) {
  const features = [
    { icon: Wine, title: name, desc: description },
    { icon: Gift, title: 'O modelo do brinde pode variar de acordo com o parceiro escolhido.' },
    { icon: ShieldCheck, title: `Prazo para retirada: ${deadlineLabel ?? 'até o fim do ciclo mensal'}`, desc: stockNote },
  ]

  return (
    <div className="card-light flex flex-col">
      <div className="relative w-full aspect-video rounded-lg bg-gold-gradient-soft border border-gold-400/20 flex items-center justify-center mb-5 overflow-hidden">
        {image}
        <span className="absolute top-3 left-3 pill bg-ink-950/85 text-white backdrop-blur-sm inline-flex items-center gap-1.5">
          <Lock size={11} /> Exclusivo para assinantes ativos
        </span>
      </div>
      <div className="space-y-4 mb-5">
        {features.map((f, i) => (
          <div key={i} className="flex gap-3">
            <div className="w-9 h-9 rounded-full border border-gold-400/30 bg-white flex items-center justify-center shrink-0">
              <f.icon size={16} className="text-gold-500" />
            </div>
            <div>
              <p className="text-sm font-semibold text-ink-950 leading-snug">{f.title}</p>
              {f.desc && <p className="text-xs text-black/45 mt-0.5">{f.desc}</p>}
            </div>
          </div>
        ))}
      </div>
      {onView && (
        <button onClick={onView} className="btn-gold w-full !py-2.5 text-sm">
          Ver brinde do mês
        </button>
      )}
    </div>
  )
}
