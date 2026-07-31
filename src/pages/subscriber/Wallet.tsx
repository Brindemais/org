import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, History } from 'lucide-react'
import { useState } from 'react'
import { useWallet } from '../../hooks/useWallet'
import { formatBRL, formatDateTime } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

const TYPE_LABELS: Record<string, string> = {
  bonus_subscription: 'Bonificação de assinatura',
  bonus_consumption: 'Bonificação de consumo',
  cashback: 'Cashback',
  withdrawal: 'Saque',
  adjustment: 'Ajuste administrativo',
  reversal: 'Estorno',
  purchase: 'Compra',
}

export default function SubscriberWallet() {
  const { balance, available, transactions, loading } = useWallet()
  const [hide, setHide] = useState(false)

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-semibold">Carteira e ganhos</h1>

      <div className="rounded-xl2 bg-gold-gradient text-ink-950 p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">Saldo disponível</p>
          <button onClick={() => setHide(!hide)}>{hide ? <EyeOff size={16} /> : <Eye size={16} />}</button>
        </div>
        <p className="text-3xl font-bold">{hide ? '••••••' : formatBRL(balance)}</p>
        <Link to="/app/carteira/saque" className="btn-dark !bg-ink-950 !text-white mt-4 w-full">Solicitar saque</Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-xs text-white/40 mb-1">Saldo disponível para saque</p>
          <p className="font-semibold">{formatBRL(available)}</p>
        </div>
        <div className="card">
          <p className="text-xs text-white/40 mb-1">Mínimo para saque</p>
          <p className="font-semibold">R$ 100,00</p>
        </div>
      </div>

      <div>
        <p className="font-semibold mb-3">Extrato</p>
        {loading && <LoadingState dark label="Carregando extrato..." />}
        <div className="space-y-2">
          {transactions.map((t) => (
            <div key={t.id} className="card !py-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.direction === 'in' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                {t.direction === 'in' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{TYPE_LABELS[t.type] ?? t.description}</p>
                <p className="text-xs text-white/40">{formatDateTime(t.created_at)}</p>
              </div>
              <p className={`text-sm font-semibold shrink-0 ${t.direction === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                {t.direction === 'in' ? '+' : '-'} {formatBRL(t.amount)}
              </p>
            </div>
          ))}
          {!loading && !transactions.length && (
            <EmptyState dark icon={History} title="Nenhuma movimentação ainda" description="Seus créditos, saques e cashback aparecem aqui." />
          )}
        </div>
      </div>
    </div>
  )
}
