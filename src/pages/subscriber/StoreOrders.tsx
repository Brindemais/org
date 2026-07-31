import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, Receipt } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDateTime } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'

interface OrderItem { id: string; quantity: number; unit_price: number; product: { name: string } | null }
interface Order { id: string; status: string; total: number; created_at: string; items: OrderItem[] }

export default function SubscriberStoreOrders() {
  const { user } = useAuth()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    supabase
      .from('store_orders')
      .select('id, status, total, created_at, items:store_order_items(id, quantity, unit_price, product:product_id(name))')
      .eq('subscriber_id', user.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data as any) ?? [])
        setLoading(false)
      })
  }, [user])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Link to="/app/loja" className="text-white/40"><ChevronLeft size={20} /></Link>
        <h1 className="font-display text-xl font-semibold flex items-center gap-2"><Receipt size={18} className="text-gold-400" /> Meus pedidos</h1>
      </div>

      <div className="space-y-3">
        {orders.map((o) => (
          <div key={o.id} className="card">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-white/40 font-mono">#{o.id.slice(0, 8)}</p>
              <StatusBadge status={o.status} />
            </div>
            <div className="space-y-1 mb-2">
              {o.items.map((it) => (
                <p key={it.id} className="text-sm text-white/70">{it.quantity}x {it.product?.name ?? 'Produto'} — {formatBRL(it.unit_price * it.quantity)}</p>
              ))}
            </div>
            <div className="flex items-center justify-between pt-2 border-t border-ink-800">
              <p className="text-xs text-white/40">{formatDateTime(o.created_at)}</p>
              <p className="font-semibold text-gold-400">{formatBRL(o.total)}</p>
            </div>
          </div>
        ))}
        {!loading && !orders.length && <p className="text-sm text-white/40 text-center py-12">Você ainda não fez nenhum pedido na loja.</p>}
      </div>
    </div>
  )
}
