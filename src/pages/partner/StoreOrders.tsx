import { useEffect, useState } from 'react'
import { Receipt } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDateTime } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

interface OrderItem { id: string; quantity: number; unit_price: number; partner_id: string | null; product: { name: string } | null }
interface Order { id: string; status: string; total: number; created_at: string; subscriber: { full_name: string } | null; items: OrderItem[] }

export default function PartnerStoreOrders() {
  const { partner } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  function load() {
    if (!partner) return
    supabase
      .from('store_orders')
      .select('id, status, total, created_at, subscriber:subscriber_id(full_name), items:store_order_items(id, quantity, unit_price, partner_id, product:product_id(name))')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data as any) ?? [])
        setLoading(false)
      })
  }

  useEffect(load, [partner])

  async function confirmDelivery(id: string) {
    setBusy(id)
    setErrors((e) => ({ ...e, [id]: '' }))
    const { error } = await supabase.rpc('confirm_store_order_delivery', { p_order_id: id })
    setBusy(null)
    if (error) {
      const map: Record<string, string> = { NO_STOCK: 'Sem estoque suficiente para este pedido.' }
      setErrors((e) => ({ ...e, [id]: map[error.message] ?? 'Não foi possível confirmar.' }))
      return
    }
    load()
  }

  const pending = orders.filter((o) => o.status === 'paid')
  const others = orders.filter((o) => o.status !== 'paid')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Pedidos da loja</h1>
        <p className="text-white/50 text-sm">Pedidos pagos com itens do seu estabelecimento, aguardando retirada.</p>
      </div>

      {loading && <LoadingState dark label="Carregando pedidos..." />}

      {!loading && (
        <div className="space-y-4">
          {pending.map((o) => (
            <div key={o.id} className="card">
              <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
                <div>
                  <p className="font-medium">{o.subscriber?.full_name ?? 'Assinante'}</p>
                  <p className="text-xs text-white/40 font-mono">#{o.id.slice(0, 8)} · {formatDateTime(o.created_at)}</p>
                </div>
                <StatusBadge status={o.status} />
              </div>
              <div className="space-y-1 mb-3">
                {o.items.map((it) => (
                  <div key={it.id} className="flex items-center justify-between gap-3 text-sm text-white/70">
                    <span>{it.quantity}x {it.product?.name ?? 'Produto'}</span>
                    <span className="shrink-0">{formatBRL(it.unit_price * it.quantity)}</span>
                  </div>
                ))}
              </div>
              <button onClick={() => confirmDelivery(o.id)} disabled={busy === o.id} className="btn-gold !py-2 !px-3 text-xs w-full">
                {busy === o.id ? '...' : 'Confirmar entrega'}
              </button>
              {errors[o.id] && <p className="text-xs text-red-400 mt-2">{errors[o.id]}</p>}
            </div>
          ))}
          {!pending.length && (
            <div className="card"><EmptyState dark icon={Receipt} title="Nenhum pedido aguardando retirada" /></div>
          )}
        </div>
      )}

      {!loading && (
        <div>
          <p className="font-semibold mb-3">Histórico</p>
          <div className="card overflow-x-auto">
            <table className="w-full text-sm min-w-[600px]">
              <thead>
                <tr className="text-left text-white/40 text-xs uppercase">
                  <th className="pb-3">Assinante</th><th className="pb-3">Total</th><th className="pb-3">Status</th><th className="pb-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {others.map((o) => (
                  <tr key={o.id} className="border-t border-ink-800">
                    <td className="py-3">{o.subscriber?.full_name ?? 'Assinante'}</td>
                    <td className="py-3">{formatBRL(o.total)}</td>
                    <td className="py-3"><StatusBadge status={o.status} /></td>
                    <td className="py-3 text-white/50">{formatDateTime(o.created_at)}</td>
                  </tr>
                ))}
                {!others.length && <tr><td colSpan={4}><EmptyState dark icon={Receipt} title="Sem histórico ainda" className="py-6" /></td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
