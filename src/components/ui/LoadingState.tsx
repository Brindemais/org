import { Loader2 } from 'lucide-react'

interface LoadingStateProps {
  label?: string
  dark?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
  /** Renders inline instead of a full centered block, for small areas like a button */
  inline?: boolean
}

const SIZE_PX: Record<NonNullable<LoadingStateProps['size']>, number> = { sm: 16, md: 22, lg: 30 }

export function LoadingState({ label = 'Carregando...', dark = false, size = 'md', className = '', inline = false }: LoadingStateProps) {
  const spinner = (
    <Loader2
      size={SIZE_PX[size]}
      className={`animate-spin ${dark ? 'text-gold-300' : 'text-gold-500'}`}
      aria-hidden="true"
    />
  )

  if (inline) {
    return (
      <span className={`inline-flex items-center gap-2 ${className}`} role="status" aria-live="polite">
        {spinner}
        {label && <span className={`text-sm ${dark ? 'text-white/60' : 'text-black/55'}`}>{label}</span>}
      </span>
    )
  }

  return (
    <div className={`flex flex-col items-center justify-center gap-3 py-12 ${className}`} role="status" aria-live="polite">
      {spinner}
      {label && <p className={`text-sm ${dark ? 'text-white/50' : 'text-black/50'}`}>{label}</p>}
    </div>
  )
}
