import { useState } from 'react'
import type { LucideIcon } from 'lucide-react'
import { ChevronDown } from 'lucide-react'

interface BenefitCardProps {
  icon: LucideIcon
  title: string
  description: string
  /** Longer explanation shown inline when "Saiba mais" is expanded. */
  details?: string
  delay?: number
}

export function BenefitCard({ icon: Icon, title, description, details, delay = 0 }: BenefitCardProps) {
  const [open, setOpen] = useState(false)
  return (
    <div
      className="card-light group flex flex-col gap-3 transition hover:shadow-soft hover:-translate-y-0.5 animate-fade-in-up"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="w-11 h-11 rounded-xl bg-gold-400/10 flex items-center justify-center transition group-hover:bg-gold-400/20">
        <Icon size={20} className="text-gold-500" strokeWidth={2} />
      </div>
      <div className="flex-1">
        <h3 className="font-semibold text-ink-950 mb-1">{title}</h3>
        <p className="text-sm text-black/55 leading-relaxed">{description}</p>
      </div>
      {details && (
        <>
          {open && <p className="text-sm text-black/55 leading-relaxed animate-fade-in-up">{details}</p>}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            className="focus-ring rounded-lg inline-flex items-center gap-1 text-sm font-medium text-gold-600 mt-1 w-fit transition group-hover:gap-1.5"
          >
            {open ? 'Ver menos' : 'Saiba mais'} <ChevronDown size={15} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </>
      )}
    </div>
  )
}
