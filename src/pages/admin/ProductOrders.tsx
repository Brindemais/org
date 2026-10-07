import { useEffect, useMemo, useState } from 'react'
import { Download, ShoppingBag } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDateTime } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { downloadCSV } from '../../lib/csv'

interface OrderRow {
  order_id: string; status: string; code: string; quantity: number; unit_price: number
  total_amount: number; commission_amount: number; net_amount: number; promotion_title: string
  partner_id: string; partner_trade_name: string; subscriber_id: string; subscriber_name: string
  deadline: string | null; confirmed_at: string | null; created_at: string
}

const STATUS_LABEL: Record<string, string> = {
  pending_payment: 'Aguardando pagamento', ready: 'Pronto para retirada', delivered: 'Retirado',
  cancelled: 'Cancelado', expired: 'Expirado',
}

export default function AdminProductOrders() {
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    setLoading(true)
    supabase.rpc('admin_list_product_orders').then(({ data }) => {
      setOrders((data as OrderRow[]) ?? [])
      setLoading(false)
    })
  }, [])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return orders
    return orders.filter((o) => o.partner_trade_name.toLowerCase().includes(q) || o.subscriber_name.toLowerCase().includes(q) || o.promotion_title.toLowerCase().includes(q))
  }, [orders, search])

  const byPartner = useMemo(() => {
    const map = new Map<string, { partner: string; rows: OrderRow[] }>()
    for (const o of filtered) {
      if (!map.has(o.partner_id)) map.set(o.partner_id, { partner: o.partner_trade_name, rows: [] })
      map.get(o.partner_id)!.rows.push(o)
    }
    return Array.from(map.values())
  }, [filtered])

  const totals = useMemo(() => {
    const delivered = orders.filter((o) => o.status === 'delivered')
    return {
      count: delivered.length,
      gross: delivered.reduce((s, o) => s + Number(o.total_amount), 0),
      commission: delivered.reduce((s, o) => s + Number(o.commission_amount), 0),
    }
  }, [orders])

  function exportCSV() {
    downloadCSV(
      `vendas-produtos-brinde-mais-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((o) => ({
        parceiro: o.partner_trade_name, assinante: o.subscriber_name, produto: o.promotion_title,
        quantidade: o.quantity, valor_total: Number(o.total_amount).toFixed(2),
        comissao: Number(o.commission_amount).toFixed(2), liquido: Number(o.net_amount).toFixed(2),
        status: STATUS_LABEL[o.status] ?? o.status, criado_em: o.created_at,
      })),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Vendas de produtos</h1>
          <p className="text-white/50 text-sm">
            {totals.count} venda{totals.count === 1 ? '' : 's'} concluída{totals.count === 1 ? '' : 's'} · {formatBRL(totals.gross)} em vendas · {formatBRL(totals.commission)} de comissão
          </p>
        </div>
        <div className="flex gap-2">
          <input className="input !w-64" placeholder="Buscar por parceiro, assinante ou produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={exportCSV} className="btn-dark !px-3 !py-2 text-xs gap-1.5 shrink-0"><Download size={14} /> Exportar CSV</button>
        </div>
      </div>

      {loading && <LoadingState dark label="Carregando vendas..." />}
      {!loading && !byPartner.length && <EmptyState dark icon={ShoppingBag} title="Nenhuma venda encontrada" />}

      <div className="space-y-6">
        {byPartner.map(({ partner, rows }) => (
          <div key={partner} className="card !p-0 overflow-hidden">
            <div className="px-4 py-3 border-b border-ink-800 flex items-center justify-between">
              <p className="font-semibold">{partner}</p>
              <p className="text-xs text-white/40">{rows.length} pedido{rows.length === 1 ? '' : 's'}</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead>
                  <tr className="text-left text-white/40 text-xs uppercase">
                    <th className="p-3">Assinante</th><th className="p-3">Produto</th><th className="p-3">Valor</th><th className="p-3">Comissão</th><th className="p-3">Líquido</th><th className="p-3">Status</th><th className="p-3">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((o) => (
                    <tr key={o.order_id} className="border-t border-ink-800">
                      <td className="p-3">{o.subscriber_name}</td>
                      <td className="p-3 text-white/50">{o.promotion_title}{o.quantity > 1 && ` ×${o.quantity}`}</td>
                      <td className="p-3">{formatBRL(o.total_amount)}</td>
                      <td className="p-3 text-white/40">{formatBRL(o.commission_amount)}</td>
                      <td className="p-3 text-emerald-400">{formatBRL(o.net_amount)}</td>
                      <td className="p-3 text-white/50">{STATUS_LABEL[o.status] ?? o.status}</td>
                      <td className="p-3 text-white/40">{formatDateTime(o.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
