import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Box, Package, Percent, PackageCheck, ShoppingBag, History } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDateTime } from '../../lib/format'

interface PickupRow { pickup_id: string; status: string; code: string; subscriber_name: string; created_at: string }
interface StockRow { id: string; quantity: number; product: { id: string; name: string } }

export default function PartnerDashboard() {
  const { partner } = useAuth()
  const [pending, setPending] = useState<PickupRow[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [promoCount, setPromoCount] = useState(0)
  const [movements, setMovements] = useState<any[]>([])

  useEffect(() => {
    if (!partner) return
    supabase
      .from('partner_pickup_view')
      .select('*')
      .eq('partner_id', partner.id)
      .eq('status', 'ready')
      .order('created_at', { ascending: false })
      .then(({ data }) => setPending((data as PickupRow[]) ?? []))

    supabase
      .from('stock_partner')
      .select('id, quantity, product:product_id(id, name)')
      .eq('partner_id', partner.id)
      .then(({ data }) => setStock((data as any[]) ?? []))

    supabase.from('promotions').select('id', { count: 'exact', head: true }).eq('partner_id', partner.id).eq('status', 'approved')
      .then(({ count }) => setPromoCount(count ?? 0))

    supabase.from('stock_movements').select('*, product:product_id(name)').eq('partner_id', partner.id).order('created_at', { ascending: false }).limit(6)
      .then(({ data }) => setMovements(data ?? []))
  }, [partner])

  const totalStock = stock.reduce((s, r) => s + r.quantity, 0)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <p className="text-white/50 text-sm">Visão geral do seu parceiro</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Retiradas pendentes" value={pending.length} hint="Aguardando confirmação" icon={<ShoppingBag size={18} />} />
        <StatCard label="Estoque disponível" value={totalStock} hint="Brindes em estoque" icon={<Package size={18} />} />
        <StatCard label="Itens cadastrados" value={stock.length} hint="Variedades de brinde" icon={<Box size={18} />} />
        <StatCard label="Promoções ativas" value={promoCount} hint="Em andamento" icon={<Percent size={18} />} tone="gold" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold">Retiradas pendentes</p>
            <Link to="/parceiro/retiradas" className="text-xs text-gold-400 font-medium">Ver todas</Link>
          </div>
          <div className="space-y-2">
            {pending.slice(0, 5).map((p) => (
              <div key={p.pickup_id} className="flex items-center justify-between border-b border-ink-800 last:border-0 pb-2 last:pb-0">
                <div>
                  <p className="text-sm font-medium">{p.subscriber_name}</p>
                  <p className="text-xs text-white/40">{p.code}</p>
                </div>
                <StatusBadge status={p.status} />
              </div>
            ))}
            {!pending.length && <EmptyState dark icon={PackageCheck} title="Nenhuma retirada pendente" className="py-6" />}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold">Estoque disponível</p>
            <Link to="/parceiro/estoque" className="text-xs text-gold-400 font-medium">Ver estoque completo</Link>
          </div>
          <div className="space-y-2">
            {stock.map((s) => (
              <div key={s.id} className="flex items-center justify-between border-b border-ink-800 last:border-0 pb-2 last:pb-0">
                <p className="text-sm">{s.product?.name}</p>
                <span className={`text-xs font-medium ${s.quantity <= 5 ? 'text-red-400' : 'text-emerald-400'}`}>
                  {s.quantity} unidades {s.quantity <= 5 && '· Estoque baixo'}
                </span>
              </div>
            ))}
            {!stock.length && <EmptyState dark icon={Package} title="Nenhum brinde em estoque" className="py-6" />}
          </div>
        </div>
      </div>

      <div className="card">
        <p className="font-semibold mb-4">Histórico recente</p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase">
                <th className="pb-2">Data</th><th className="pb-2">Produto</th><th className="pb-2">Tipo</th><th className="pb-2">Qtd.</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-ink-800">
                  <td className="py-2 text-white/60">{formatDateTime(m.created_at)}</td>
                  <td className="py-2">{m.product?.name}</td>
                  <td className="py-2 text-white/60">{m.type}</td>
                  <td className="py-2">{m.quantity}</td>
                </tr>
              ))}
              {!movements.length && (
                <tr><td colSpan={4}><EmptyState dark icon={History} title="Nenhuma movimentação registrada" className="py-6" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
