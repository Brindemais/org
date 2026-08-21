import { Link } from 'react-router-dom'
import { ArrowDownLeft, ArrowUpRight, Eye, EyeOff, History, RefreshCw, Users2 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { useWallet } from '../../hooks/useWallet'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDateTime } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { LogoMark } from '../../components/layout/Logo'

const TYPE_LABELS: Record<string, string> = {
  bonus_subscription: 'Bonificação de assinatura',
  bonus_consumption: 'Bonificação de consumo',
  cashback: 'Cashback',
  withdrawal: 'Saque',
  adjustment: 'Ajuste administrativo',
  reversal: 'Estorno',
  purchase: 'Compra',
}

const PREVIEW_COUNT = 6

export default function SubscriberWallet() {
  const { profile } = useAuth()
  const { balance, available, transactions, loading } = useWallet()
  const [hide, setHide] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const [referralEarned, setReferralEarned] = useState(0)

  useEffect(() => {
    if (!profile) return
    supabase.from('bonuses').select('amount').eq('beneficiary_id', profile.id)
      .then(({ data }) => setReferralEarned((data ?? []).reduce((s, b: any) => s + Number(b.amount), 0)))
  }, [profile])

  const pending = Math.max(0, balance - available)
  const cashbackTotal = transactions.filter((t) => t.type === 'cashback').reduce((s, t) => s + Number(t.amount), 0)
  const visibleTransactions = showAll ? transactions : transactions.slice(0, PREVIEW_COUNT)

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-semibold">Carteira e ganhos</h1>

      <div className="relative rounded-xl2 bg-ink-950 border border-ink-800 p-5 overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold uppercase tracking-wide text-gold-400">Saldo disponível</p>
            <button onClick={() => setHide(!hide)} className="text-white/40 hover:text-white/70" aria-label={hide ? 'Mostrar saldo' : 'Ocultar saldo'}>
              {hide ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-3xl font-bold text-white">{hide ? '••••••' : formatBRL(balance)}</p>
        </div>
        <div className="absolute -right-3 -bottom-3 opacity-90">
          <LogoMark size={68} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="card">
          <p className="text-xs text-white/40 mb-1 flex items-center gap-1"><RefreshCw size={11} /> Saldo pendente</p>
          <p className="font-semibold">{formatBRL(pending)}</p>
          <p className="text-[10px] text-white/30 mt-0.5">Em processamento</p>
        </div>
        <div className="card">
          <p className="text-xs text-white/40 mb-1">Cashback gerado</p>
          <p className="font-semibold">{formatBRL(cashbackTotal)}</p>
          <p className="text-[10px] text-white/30 mt-0.5">Total acumulado</p>
        </div>
      </div>

      <Link to="/app/indique" className="card flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Users2 size={16} className="text-gold-400" />
          <div>
            <p className="text-xs text-white/40">Bônus por indicações</p>
            <p className="font-semibold">{formatBRL(referralEarned)}</p>
          </div>
        </div>
        <p className="text-[10px] text-white/30">Total acumulado</p>
      </Link>

      <Link to="/app/carteira/saque" className="btn-gold w-full">Saque · Transferir para minha conta</Link>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold">Extrato</p>
          {transactions.length > PREVIEW_COUNT && (
            <button onClick={() => setShowAll(!showAll)} className="text-xs text-gold-400 font-medium">
              {showAll ? 'Ver menos' : 'Ver todos'}
            </button>
          )}
        </div>
        {loading && <LoadingState dark label="Carregando extrato..." />}
        <div className="space-y-2">
          {visibleTransactions.map((t) => (
            <div key={t.id} className="card !py-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.direction === 'in' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                {t.direction === 'in' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{TYPE_LABELS[t.type] ?? t.description}</p>
                <p className="text-xs text-white/40">{formatDateTime(t.created_at)}</p>
              </div>
              <div className="text-right shrink-0">
                <p className={`text-sm font-semibold ${t.direction === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.direction === 'in' ? '+' : '-'} {formatBRL(t.amount)}
                </p>
                <p className="text-[10px] text-white/30">{t.direction === 'in' ? 'Aprovado' : 'Transferido'}</p>
              </div>
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
