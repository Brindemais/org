import { useState } from 'react'
import { Eye, EyeOff, ArrowRight } from 'lucide-react'
import { formatBRL } from '../../lib/format'
import { LogoMark } from '../layout/Logo'

interface WalletCardProps {
  balance: number
  pendingBalance?: number
  cashback?: number
  referralEarnings?: number
  variant?: 'compact' | 'full'
  onViewWallet?: () => void
  onViewStatement?: () => void
}

export function WalletCard({
  balance,
  pendingBalance,
  cashback,
  referralEarnings,
  variant = 'full',
  onViewWallet,
  onViewStatement,
}: WalletCardProps) {
  const [hidden, setHidden] = useState(false)
  const display = (v: number) => (hidden ? '••••••' : formatBRL(v))

  if (variant === 'compact') {
    return (
      <div className="bg-ink-950 rounded-xl2 px-5 py-4 shadow-gold min-w-[168px]">
        <div className="flex items-center justify-between mb-1">
          <p className="text-[11px] text-white/40">Saldo disponível</p>
          <button onClick={() => setHidden((h) => !h)} className="text-white/30 hover:text-white/60" aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}>
            {hidden ? <EyeOff size={12} /> : <Eye size={12} />}
          </button>
        </div>
        <p className="text-xl font-bold text-gold-300 mb-1.5">{display(balance)}</p>
        <div className="flex items-center justify-between">
          {onViewWallet ? (
            <button onClick={onViewWallet} className="text-xs text-gold-400 font-medium">Ver carteira →</button>
          ) : <span />}
          <LogoMark size={20} />
        </div>
      </div>
    )
  }

  return (
    <div className="card-light !bg-ink-950 !border-transparent text-white">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-white/50">Saldo disponível</p>
        <button onClick={() => setHidden((h) => !h)} className="text-white/40 hover:text-white/70" aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'}>
          {hidden ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      <p className="font-display text-3xl font-semibold text-gold-300 mb-5">{display(balance)}</p>

      <div className="grid grid-cols-3 gap-3 mb-5 text-center">
        <div>
          <p className="text-[11px] text-white/40 mb-0.5">Pendente</p>
          <p className="text-sm font-semibold">{display(pendingBalance ?? 0)}</p>
        </div>
        <div>
          <p className="text-[11px] text-white/40 mb-0.5">Cashback</p>
          <p className="text-sm font-semibold">{display(cashback ?? 0)}</p>
        </div>
        <div>
          <p className="text-[11px] text-white/40 mb-0.5">Indicações</p>
          <p className="text-sm font-semibold">{display(referralEarnings ?? 0)}</p>
        </div>
      </div>

      <div className="flex gap-2">
        {onViewWallet && (
          <button onClick={onViewWallet} className="btn-gold flex-1 !py-2.5 text-sm">
            Ver carteira
          </button>
        )}
        {onViewStatement && (
          <button onClick={onViewStatement} className="btn-ghost flex-1 !py-2.5 text-sm">
            Ver extrato <ArrowRight size={14} />
          </button>
        )}
      </div>
    </div>
  )
}
