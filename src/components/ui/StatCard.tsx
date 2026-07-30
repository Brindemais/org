import type { ReactNode } from 'react'

export function StatCard({
  label, value, hint, icon, tone = 'default',
}: { label: string; value: ReactNode; hint?: string; icon?: ReactNode; tone?: 'default' | 'gold' }) {
  return (
    <div className={`card flex flex-col gap-2 ${tone === 'gold' ? 'bg-gold-gradient text-ink-950 border-transparent' : ''}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${tone === 'gold' ? 'text-ink-950/70' : 'text-white/45'}`}>
          {label}
        </span>
        {icon && <span className={tone === 'gold' ? 'text-ink-950/70' : 'text-gold-400'}>{icon}</span>}
      </div>
      <span className={`text-2xl font-bold ${tone === 'gold' ? 'text-ink-950' : 'text-white'}`}>{value}</span>
      {hint && <span className={`text-xs ${tone === 'gold' ? 'text-ink-950/70' : 'text-white/40'}`}>{hint}</span>}
    </div>
  )
}
