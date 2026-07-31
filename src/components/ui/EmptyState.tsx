import type { LucideIcon } from 'lucide-react'
import { Inbox } from 'lucide-react'
import type { ReactNode } from 'react'

interface EmptyStateProps {
  icon?: LucideIcon
  title: string
  description?: string
  action?: ReactNode
  dark?: boolean
  className?: string
}

export function EmptyState({ icon: Icon = Inbox, title, description, action, dark = false, className = '' }: EmptyStateProps) {
  return (
    <div className={`flex flex-col items-center text-center gap-2 py-12 px-4 ${className}`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-1 ${dark ? 'bg-white/5' : 'bg-black/5'}`}>
        <Icon size={20} className={dark ? 'text-white/35' : 'text-black/30'} />
      </div>
      <p className={`text-sm font-semibold ${dark ? 'text-white/70' : 'text-ink-950'}`}>{title}</p>
      {description && (
        <p className={`text-xs max-w-xs leading-relaxed ${dark ? 'text-white/40' : 'text-black/45'}`}>{description}</p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  )
}
