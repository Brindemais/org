import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Copy, Receipt } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Payment } from '../../lib/types'
import { formatBRL, formatDateTime } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

export default function SubscriberPayments() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading, setLoading] = useState(true)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('payments').select('*').eq('subscriber_id', user.id).order('created_at', { ascending: false })
      .then(({ data }) => { setPayments((data as Payment[]) ?? []); setLoading(false) })
  }, [user])

  function copyReference(p: Payment) {
    navigator.clipboard.writeText(p.external_reference)
    setCopiedId(p.id)
    setTimeout(() => setCopiedId(null), 1500)
  }

  return (
    <div className="space-y-5">
      <Link to="/app/perfil" className="inline-flex items-center gap-1 text-sm text-white/50 hover:text-white">
        <ChevronLeft size={16} /> Perfil
      </Link>

      <div>
        <h1 className="font-display text-xl font-semibold">Meus pagamentos</h1>
        <p className="text-sm text-white/50">Histórico de assinatura e compras na loja.</p>
      </div>

      {loading && <LoadingState dark label="Carregando pagamentos..." />}

      {!loading && !payments.length && (
        <EmptyState dark icon={Receipt} title="Nenhum pagamento ainda" description="Seus comprovantes de assinatura e loja aparecem aqui." />
      )}

      {!loading && payments.length > 0 && (
        <div className="space-y-2">
          {payments.map((p) => (
            <div key={p.id} className="card">
              <div className="flex items-start justify-between gap-3 mb-1">
                <div className="min-w-0">
                  <p className="font-medium text-sm">{p.type === 'subscription' ? 'Assinatura' : 'Loja'}</p>
                  <p className="text-xs text-white/40">{formatDateTime(p.created_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-semibold text-sm">{formatBRL(p.amount)}</p>
                  <StatusBadge status={p.status} />
                </div>
              </div>
              <div className="flex items-center justify-between pt-2 mt-2 border-t border-ink-800">
                <p className="text-[11px] text-white/30 font-mono truncate">{p.external_reference}</p>
                <button onClick={() => copyReference(p)} className="text-[11px] text-gold-400 font-medium flex items-center gap-1 shrink-0">
                  <Copy size={11} /> {copiedId === p.id ? 'Copiado!' : 'Copiar referência'}
                </button>
              </div>
              {p.confirmed_at && (
                <p className="text-[11px] text-white/30 mt-1">Confirmado em {formatDateTime(p.confirmed_at)}</p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
