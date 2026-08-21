import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Package, Percent, PackageCheck, ShoppingBag, History, Truck, CalendarCheck, Bell, AlertTriangle } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatBRL, formatDate, formatDateTime } from '../../lib/format'

interface PickupRow { pickup_id: string; status: string; code: string; subscriber_name: string; created_at: string }
interface StockRow { id: string; quantity: number; product: { id: string; name: string } }
interface PromoRow { id: string; title: string; discount_pct: number | null; subscriber_price: number | null; valid_until: string }

export default function PartnerDashboard() {
  const { partner } = useAuth()
  const [pending, setPending] = useState<PickupRow[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [promotions, setPromotions] = useState<PromoRow[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [receivedFromMatrix, setReceivedFromMatrix] = useState(0)
  const [reservationsThisCycle, setReservationsThisCycle] = useState(0)

  useEffect(() => {
    if (!partner) return
    const now = new Date()
    const cycleMonth = now.getMonth() + 1
    const cycleYear = now.getFullYear()
    const since30d = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString()

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

    supabase.from('promotions').select('id, title, discount_pct, subscriber_price, valid_until').eq('partner_id', partner.id).eq('status', 'approved')
      .then(({ data }) => setPromotions((data as PromoRow[]) ?? []))

    supabase.from('stock_movements').select('*, product:product_id(name)').eq('partner_id', partner.id).order('created_at', { ascending: false }).limit(6)
      .then(({ data }) => setMovements(data ?? []))

    // Brindes recebidos da matriz: transferências de estoque do admin para
    // este parceiro (type='transfer_in') nos últimos 30 dias — distinto do
    // estoque atual, que já desconta o que foi entregue/devolvido desde então.
    supabase.from('stock_movements').select('quantity').eq('partner_id', partner.id).eq('type', 'transfer_in').gte('created_at', since30d)
      .then(({ data }) => setReceivedFromMatrix((data ?? []).reduce((s, r: any) => s + Number(r.quantity), 0)))

    // Reservas selecionadas: assinantes que escolheram este parceiro como
    // ponto de retirada no ciclo atual, já retirado ou ainda pendente —
    // diferente de "Retiradas pendentes" acima, que só conta o que falta.
    supabase.from('pickups').select('id', { count: 'exact', head: true }).eq('partner_id', partner.id).eq('cycle_month', cycleMonth).eq('cycle_year', cycleYear).in('status', ['reserved', 'ready', 'withdrawn'])
      .then(({ count }) => setReservationsThisCycle(count ?? 0))
  }, [partner])

  const totalStock = stock.reduce((s, r) => s + r.quantity, 0)
  const lowStockItems = stock.filter((s) => s.quantity <= 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <p className="text-white/50 text-sm">Visão geral do seu parceiro</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Retiradas pendentes" value={pending.length} hint="Aguardando confirmação" icon={<ShoppingBag size={18} />} />
        <StatCard label="Estoque disponível" value={totalStock} hint="Brindes em estoque" icon={<Package size={18} />} />
        <StatCard label="Brindes recebidos da matriz" value={receivedFromMatrix} hint="Últimos 30 dias" icon={<Truck size={18} />} />
        <StatCard label="Promoções ativas" value={promotions.length} hint="Em andamento" icon={<Percent size={18} />} tone="gold" />
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

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold">Promoções ativas</p>
            <Link to="/parceiro/promocoes" className="text-xs text-gold-400 font-medium">Ver todas</Link>
          </div>
          <div className="space-y-2">
            {promotions.slice(0, 4).map((p) => (
              <div key={p.id} className="border-b border-ink-800 last:border-0 pb-2 last:pb-0">
                <p className="text-sm font-medium truncate">{p.title}</p>
                <p className="text-xs text-white/40">
                  {p.discount_pct ? `${p.discount_pct}% OFF` : p.subscriber_price ? formatBRL(p.subscriber_price) : 'Desconto'} · válido até {formatDate(p.valid_until)}
                </p>
              </div>
            ))}
            {!promotions.length && <EmptyState dark icon={Percent} title="Nenhuma promoção ativa" className="py-6" />}
          </div>
        </div>

        <div className="card flex flex-col">
          <p className="font-semibold mb-4">Reservas selecionadas</p>
          <div className="flex-1 flex flex-col items-center justify-center text-center py-2">
            <CalendarCheck size={22} className="text-gold-400 mb-2" />
            <p className="text-3xl font-bold">{reservationsThisCycle}</p>
            <p className="text-xs text-white/40 mt-1">Assinantes que escolheram este parceiro neste ciclo</p>
          </div>
        </div>

        <div className="card">
          <p className="font-semibold mb-4 flex items-center gap-1.5"><Bell size={15} className="text-gold-400" /> Alertas</p>
          <div className="space-y-2">
            {pending.slice(0, 1).map((p) => (
              <div key={p.pickup_id} className="flex items-start gap-2 text-xs border-b border-ink-800 pb-2">
                <PackageCheck size={14} className="text-gold-400 shrink-0 mt-0.5" />
                <span className="text-white/60">Nova retirada pendente de <span className="text-white font-medium">{p.subscriber_name}</span></span>
              </div>
            ))}
            {lowStockItems.slice(0, 2).map((s) => (
              <div key={s.id} className="flex items-start gap-2 text-xs border-b border-ink-800 last:border-0 pb-2 last:pb-0">
                <AlertTriangle size={14} className="text-red-400 shrink-0 mt-0.5" />
                <span className="text-white/60">Estoque baixo: <span className="text-white font-medium">{s.product?.name}</span></span>
              </div>
            ))}
            {!pending.length && !lowStockItems.length && (
              <EmptyState dark icon={Bell} title="Tudo em dia" description="Nenhum alerta no momento." className="py-6" />
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <p className="font-semibold mb-4 flex items-center gap-1.5"><History size={15} className="text-gold-400" /> Histórico recente</p>
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
