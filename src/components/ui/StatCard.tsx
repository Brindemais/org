import type { ReactNode } from 'react'
import { TrendingUp, TrendingDown } from 'lucide-react'

export function StatCard({
  label, value, hint, icon, tone = 'default', trend,
}: {
  label: string; value: ReactNode; hint?: string; icon?: ReactNode; tone?: 'default' | 'gold'
  /** Optional "+8,4% vs mês anterior" chip — color follows the sign automatically. */
  trend?: { pct: number; label?: string }
}) {
  return (
    <div className={`card flex flex-col gap-2 ${tone === 'gold' ? 'bg-gold-gradient text-ink-950 border-transparent' : ''}`}>
      <div className="flex items-center justify-between">
        <span className={`text-[11px] font-semibold uppercase tracking-wide ${tone === 'gold' ? 'text-ink-950/70' : 'text-white/45'}`}>
          {label}
        </span>
        {icon && <span className={tone === 'gold' ? 'text-ink-950/70' : 'text-gold-400'}>{icon}</span>}
      </div>
      <span className={`text-2xl font-bold ${tone === 'gold' ? 'text-ink-950' : 'text-white'}`}>{value}</span>
      {trend && (
        <span className={`text-xs font-semibold flex items-center gap-1 ${trend.pct >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
          {trend.pct >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {trend.pct >= 0 ? '+' : ''}{trend.pct.toFixed(1)}%{trend.label ? ` ${trend.label}` : ''}
        </span>
      )}
      {hint && <span className={`text-xs ${tone === 'gold' ? 'text-ink-950/70' : 'text-white/40'}`}>{hint}</span>}
    </div>
  )
}
