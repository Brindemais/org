import type { ReactNode } from 'react'

interface SectionTitleProps {
  eyebrow?: string
  title: string
  description?: string
  align?: 'left' | 'center'
  dark?: boolean
  action?: ReactNode
}

export function SectionTitle({ eyebrow, title, description, align = 'left', dark = false, action }: SectionTitleProps) {
  const isCenter = align === 'center'
  return (
    <div className={`flex flex-col gap-3 mb-8 ${isCenter ? 'items-center text-center' : ''} ${action ? 'sm:flex-row sm:items-end sm:justify-between' : ''}`}>
      <div className={isCenter ? 'max-w-2xl' : 'max-w-xl'}>
        {eyebrow && (
          <span className={`pill mb-3 ${dark ? 'bg-gold-400/15 text-gold-300' : 'bg-gold-400/15 text-gold-600'}`}>{eyebrow}</span>
        )}
        <h2 className={`font-display text-2xl sm:text-3xl font-semibold leading-tight ${dark ? 'text-white' : 'text-ink-950'}`}>
          {title}
        </h2>
        {description && (
          <p className={`mt-2 text-sm sm:text-base leading-relaxed ${dark ? 'text-white/55' : 'text-black/55'}`}>
            {description}
          </p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}
