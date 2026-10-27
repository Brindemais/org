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

interface PickupCodeRow { payment_id: string; code: string; promotion_title: string }

export default function SubscriberPayments() {
  const { user } = useAuth()
  const [payments, setPayments] = useState<Payment[]>([])
  const [codesByPayment, setCodesByPayment] = useState<Record<string, PickupCodeRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [copiedKey, setCopiedKey] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('payments').select('*').eq('subscriber_id', user.id).order('created_at', { ascending: false })
      .then(async ({ data }) => {
        const rows = (data as Payment[]) ?? []
        setPayments(rows)
        setLoading(false)

        // Pedidos de produto podem compartilhar um pagamento (compra de
        // vários itens do mesmo parceiro no carrinho) — busca por
        // payment_id, não payments.product_order_id, que fica null nesse
        // caso.
        const paymentIds = rows.filter((p) => p.type === 'product_purchase').map((p) => p.id)
        if (!paymentIds.length) return
        const { data: orders } = await supabase
          .from('product_orders')
          .select('payment_id, code, promotion:promotion_id(title)')
          .in('payment_id', paymentIds)
        const grouped: Record<string, PickupCodeRow[]> = {}
        for (const o of (orders as any[]) ?? []) {
          if (!o.payment_id) continue
          const row: PickupCodeRow = { payment_id: o.payment_id, code: o.code, promotion_title: o.promotion?.title ?? 'Produto' }
          grouped[o.payment_id] = [...(grouped[o.payment_id] ?? []), row]
        }
        setCodesByPayment(grouped)
      })
  }, [user])

  function copyCode(key: string, code: string) {
    navigator.clipboard.writeText(code)
    setCopiedKey(key)
    setTimeout(() => setCopiedKey(null), 1500)
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
          {payments.map((p) => {
            const codes = codesByPayment[p.id] ?? []
            return (
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
                {!!codes.length && (
                  <div className="pt-2 mt-2 border-t border-ink-800 space-y-1.5">
                    {codes.map((c) => (
                      <div key={c.payment_id + c.code} className="flex items-center justify-between gap-2">
                        <p className="text-xs text-white/50 truncate">Código de retirada · {c.promotion_title}: <span className="font-mono font-semibold text-gold-300">{c.code}</span></p>
                        <button onClick={() => copyCode(c.payment_id + c.code, c.code)} className="text-[11px] text-gold-400 font-medium flex items-center gap-1 shrink-0">
                          <Copy size={11} /> {copiedKey === c.payment_id + c.code ? 'Copiado!' : 'Copiar'}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                {p.confirmed_at && (
                  <p className="text-[11px] text-white/30 mt-1">Confirmado em {formatDateTime(p.confirmed_at)}</p>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
