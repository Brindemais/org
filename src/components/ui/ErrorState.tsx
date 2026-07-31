import { AlertTriangle } from 'lucide-react'
import type { ReactNode } from 'react'

interface ErrorStateProps {
  title?: string
  description?: string
  onRetry?: () => void
  action?: ReactNode
  dark?: boolean
  className?: string
}

export function ErrorState({
  title = 'Não foi possível carregar',
  description = 'Verifique sua conexão e tente novamente.',
  onRetry,
  action,
  dark = false,
  className = '',
}: ErrorStateProps) {
  return (
    <div className={`flex flex-col items-center text-center gap-2 py-12 px-4 ${className}`} role="alert">
      <div className="w-12 h-12 rounded-full flex items-center justify-center mb-1 bg-danger-50">
        <AlertTriangle size={20} className="text-danger-500" />
      </div>
      <p className={`text-sm font-semibold ${dark ? 'text-white/80' : 'text-ink-950'}`}>{title}</p>
      {description && (
        <p className={`text-xs max-w-xs leading-relaxed ${dark ? 'text-white/45' : 'text-black/50'}`}>{description}</p>
      )}
      {(onRetry || action) && (
        <div className="mt-3">
          {action ?? (
            <button onClick={onRetry} className={dark ? 'btn-ghost !py-2 !px-4 text-sm' : 'btn-outline-light !py-2 !px-4 text-sm'}>
              Tentar novamente
            </button>
          )}
        </div>
      )}
    </div>
  )
}
