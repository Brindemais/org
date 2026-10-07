import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { QRCodeSVG } from 'qrcode.react'
import { ChevronLeft, Percent, ShoppingBag } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDate } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

interface OrderRow {
  order_id: string; status: string; code: string; quantity: number; unit_price: number
  total_amount: number; promotion_title: string; promotion_image_url: string | null
  partner_id: string; partner_trade_name: string; deadline: string | null; created_at: string
}

const STATUS_LABEL: Record<string, { label: string; className: string }> = {
  pending_payment: { label: 'Aguardando pagamento', className: 'bg-white/10 text-white/50' },
  ready: { label: 'Pronto para retirada', className: 'bg-gold-400/15 text-gold-300' },
  delivered: { label: 'Retirado', className: 'bg-emerald-500/15 text-emerald-400' },
  cancelled: { label: 'Cancelado', className: 'bg-red-500/15 text-red-400' },
  expired: { label: 'Expirado', className: 'bg-red-500/15 text-red-400' },
}

export default function SubscriberProductOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)

  function load() {
    setLoading(true)
    supabase.rpc('get_my_product_orders').then(({ data }) => {
      setOrders((data as OrderRow[]) ?? [])
      setLoading(false)
    })
  }

  useEffect(() => {
    load()
    const t = setInterval(load, 15000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="space-y-4">
      <Link to="/app/produtos" className="text-xs text-white/40 flex items-center gap-1 w-fit"><ChevronLeft size={14} /> Produtos e descontos</Link>
      <h1 className="font-display text-xl font-semibold">Minhas compras</h1>

      {loading && <LoadingState dark label="Carregando compras..." />}
      {!loading && !orders.length && (
        <EmptyState dark icon={ShoppingBag} title="Nenhuma compra ainda" description="Compre produtos com desconto direto na vitrine de um parceiro." />
      )}

      <div className="space-y-3">
        {orders.map((o) => {
          const status = STATUS_LABEL[o.status] ?? { label: o.status, className: 'bg-white/10 text-white/50' }
          return (
            <div key={o.order_id} className="card !p-0 overflow-hidden">
              <div className="flex items-center gap-3 p-4">
                <div className="w-14 h-14 rounded-lg bg-ink-950 border border-ink-800 overflow-hidden flex items-center justify-center shrink-0">
                  {o.promotion_image_url ? <img src={o.promotion_image_url} alt={o.promotion_title} className="w-full h-full object-cover" /> : <Percent size={20} className="text-white/15" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{o.promotion_title}{o.quantity > 1 && ` ×${o.quantity}`}</p>
                  <p className="text-xs text-white/40 truncate">{o.partner_trade_name} · {formatBRL(o.total_amount)}</p>
                  <p className="text-[11px] text-white/30 mt-0.5">{formatDate(o.created_at)}</p>
                </div>
                <span className={`pill shrink-0 ${status.className}`}>{status.label}</span>
              </div>

              {o.status === 'ready' && (
                <div className="border-t border-ink-800 p-4 flex items-center gap-4">
                  <div className="bg-white p-2 rounded-lg shrink-0">
                    <QRCodeSVG value={o.code} size={64} />
                  </div>
                  <div>
                    <p className="text-[11px] text-white/40">Código de retirada</p>
                    <p className="font-display text-lg font-bold tracking-wider text-gold-400">{o.code}</p>
                    {o.deadline && <p className="text-[11px] text-white/30 mt-0.5">Retire até {formatDate(o.deadline)}</p>}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
