import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
  /** 'sheet' slides up from the bottom (mobile-friendly drawer), 'center' is a classic centered dialog */
  variant?: 'center' | 'sheet'
  className?: string
}

export function Modal({ open, onClose, title, children, variant = 'center', className = '' }: ModalProps) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
    }
  }, [open, onClose])

  if (!open) return null

  const isSheet = variant === 'sheet'

  return (
    <div className="fixed inset-0 z-[90] flex" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-toast-in" onClick={onClose} />
      <div
        className={
          isSheet
            ? `relative mt-auto w-full bg-white rounded-t-3xl safe-bottom max-h-[88vh] overflow-y-auto animate-toast-in ${className}`
            : `relative m-auto w-full max-w-md bg-white rounded-2xl shadow-popover max-h-[88vh] overflow-y-auto mx-4 animate-toast-in ${className}`
        }
      >
        {isSheet && <div className="w-10 h-1.5 rounded-full bg-black/10 mx-auto mt-3" />}
        {title && (
          <div className="flex items-center justify-between px-5 pt-4 pb-2">
            <h3 className="font-display text-lg font-semibold text-ink-950">{title}</h3>
            <button onClick={onClose} className="text-black/40 hover:text-black/70 focus-ring rounded-full p-1" aria-label="Fechar">
              <X size={20} />
            </button>
          </div>
        )}
        {!title && (
          <button onClick={onClose} className="absolute top-3 right-3 text-black/40 hover:text-black/70 focus-ring rounded-full p-1.5 bg-black/5" aria-label="Fechar">
            <X size={18} />
          </button>
        )}
        <div className={title ? 'px-5 pb-5' : 'p-5'}>{children}</div>
      </div>
    </div>
  )
}

/** Convenience alias — a bottom-sheet Modal, the pattern used for cart/filters on mobile */
export function Drawer(props: Omit<ModalProps, 'variant'>) {
  return <Modal {...props} variant="sheet" />
}
