import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { Users, Wallet, Store, Landmark, Receipt, Headset, AlertTriangle, RefreshCw, Banknote, ShoppingBag } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatBRL, formatDateTime } from '../../lib/format'
import { useDashboardTheme } from '../../contexts/DashboardThemeContext'

export default function AdminDashboard() {
  const { theme } = useDashboardTheme()
  const chartColors = theme === 'light'
    ? { grid: '#e8e4db', axis: '#8a8578', tooltipBg: '#ffffff', tooltipBorder: '#e8e4db' }
    : { grid: '#26262d', axis: '#666666', tooltipBg: '#151519', tooltipBorder: '#26262d' }

  const [kpi, setKpi] = useState({
    subscribersActive: 0, subscribersTotal: 0, revenueGross: 0, partnersActive: 0,
    pendingPayments: 0, pendingWithdrawals: 0, pendingPartners: 0, lowStock: 0,
    subscribersExpired: 0, renewalRate: 0, withdrawnTotal: 0,
  })
  const [growth, setGrowth] = useState<{ month: string; count: number }[]>([])
  const [recentPayments, setRecentPayments] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const [
        { count: subsActive }, { count: subsTotal }, { data: activeSubs },
        { count: partnersActive }, { count: pendingPayments }, { count: pendingWithdrawals },
        { count: pendingPartners }, { data: lowStockRows }, { data: allSubs },
        { data: payments }, { data: ticketRows },
        { count: subsExpired }, { data: everActivated }, { data: paidWithdrawals },
      ] = await Promise.all([
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'subscriber'),
        supabase.from('subscriptions').select('amount').eq('status', 'active'),
        supabase.from('partners').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('withdrawals').select('id', { count: 'exact', head: true }).eq('status', 'requested'),
        supabase.from('partners').select('id', { count: 'exact', head: true }).in('status', ['interested', 'pending_docs', 'analyzing']),
        supabase.from('stock_partner').select('quantity').lte('quantity', 5),
        supabase.from('subscriptions').select('created_at'),
        supabase.from('payments').select('*, subscriber:subscriber_id(full_name)').order('created_at', { ascending: false }).limit(6),
        supabase.from('support_tickets').select('*, user:user_id(full_name)').order('created_at', { ascending: false }).limit(5),
        // "Vencida": status ainda diz active mas expires_at já passou — mesma
        // regra usada no resto do app (useSubscription/AdminSubscribers).
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active').lt('expires_at', new Date().toISOString()),
        // Taxa de renovação: de tudo que já foi ativado alguma vez, quanto
        // segue ativo hoje (proxy simples — sem histórico de ciclo a ciclo).
        supabase.from('subscriptions').select('status').not('activated_at', 'is', null),
        supabase.from('withdrawals').select('amount').eq('status', 'paid'),
      ])

      const revenueGross = (activeSubs ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
      const withdrawnTotal = (paidWithdrawals ?? []).reduce((s: number, r: any) => s + Number(r.amount), 0)
      const everActivatedRows = everActivated ?? []
      const renewalRate = everActivatedRows.length
        ? Math.round((everActivatedRows.filter((s: any) => s.status === 'active').length / everActivatedRows.length) * 100)
        : 0

      const monthly: Record<string, number> = {}
      for (const s of allSubs ?? []) {
        const d = new Date((s as any).created_at)
        const key = d.toLocaleDateString('pt-BR', { month: 'short' })
        monthly[key] = (monthly[key] ?? 0) + 1
      }
      setGrowth(Object.entries(monthly).map(([month, count]) => ({ month, count })))

      setKpi({
        subscribersActive: subsActive ?? 0,
        subscribersTotal: subsTotal ?? 0,
        revenueGross,
        partnersActive: partnersActive ?? 0,
        pendingPayments: pendingPayments ?? 0,
        pendingWithdrawals: pendingWithdrawals ?? 0,
        pendingPartners: pendingPartners ?? 0,
        lowStock: (lowStockRows ?? []).length,
        subscribersExpired: subsExpired ?? 0,
        renewalRate,
        withdrawnTotal,
      })
      setRecentPayments(payments ?? [])
      setTickets(ticketRows ?? [])
    }
    load()
  }, [])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Dashboard</h1>
        <p className="text-white/50 text-sm">Visão geral da operação Brinde Mais</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Assinantes ativos" value={kpi.subscribersActive} hint={`${kpi.subscribersTotal} cadastrados`} icon={<Users size={18} />} />
        <StatCard label="Receita recorrente" value={formatBRL(kpi.revenueGross)} hint="Assinaturas ativas" icon={<Wallet size={18} />} tone="gold" />
        <StatCard label="Parceiros ativos" value={kpi.partnersActive} hint={`${kpi.pendingPartners} aguardando aprovação`} icon={<Store size={18} />} />
        <StatCard label="Saques pendentes" value={kpi.pendingWithdrawals} hint="Aguardando análise" icon={<Landmark size={18} />} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Assinantes vencidos" value={kpi.subscribersExpired} hint="Aguardando renovação" icon={<AlertTriangle size={18} />} />
        <StatCard label="Taxa de renovação" value={`${kpi.renewalRate}%`} hint="De quem já ativou, segue ativo" icon={<RefreshCw size={18} />} />
        <StatCard label="Valores sacados" value={formatBRL(kpi.withdrawnTotal)} hint="Total pago em saques" icon={<Banknote size={18} />} />
        <StatCard label="Estoque baixo" value={kpi.lowStock} hint="Parceiros com ≤5 unidades" icon={<ShoppingBag size={18} />} />
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card lg:col-span-2">
          <p className="font-semibold mb-4">Crescimento de assinantes</p>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growth}>
                <defs>
                  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d4941e" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#d4941e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="month" stroke={chartColors.axis} fontSize={12} />
                <YAxis stroke={chartColors.axis} fontSize={12} allowDecimals={false} />
                <Tooltip contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                <Area type="monotone" dataKey="count" stroke="#d4941e" fill="url(#gold)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card space-y-3">
          <p className="font-semibold mb-1">Aprovações pendentes</p>
          <Link to="/admin/parceiros" className="flex items-center justify-between text-sm py-2 border-b border-ink-800">
            <span className="text-white/60">Novos parceiros</span>
            <span className="font-semibold text-gold-400">{kpi.pendingPartners}</span>
          </Link>
          <Link to="/admin/pagamentos" className="flex items-center justify-between text-sm py-2 border-b border-ink-800">
            <span className="text-white/60">Pagamentos Pix pendentes</span>
            <span className="font-semibold text-gold-400">{kpi.pendingPayments}</span>
          </Link>
          <Link to="/admin/saques" className="flex items-center justify-between text-sm py-2 border-b border-ink-800">
            <span className="text-white/60">Solicitações de saque</span>
            <span className="font-semibold text-gold-400">{kpi.pendingWithdrawals}</span>
          </Link>
          <Link to="/admin/estoque" className="flex items-center justify-between text-sm py-2">
            <span className="text-white/60">Alertas de estoque baixo</span>
            <span className="font-semibold text-red-400">{kpi.lowStock}</span>
          </Link>
        </div>
      </div>

      <div className="card">
        <p className="font-semibold mb-4">Últimos lançamentos financeiros</p>
        <div className="space-y-2">
          {recentPayments.map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-ink-800 last:border-0 pb-2 last:pb-0">
              <div>
                <p className="text-sm">{p.subscriber?.full_name ?? '-'}</p>
                <p className="text-xs text-white/40">{p.type === 'subscription' ? 'Assinatura' : 'Loja'} · {formatDateTime(p.created_at)}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-semibold">{formatBRL(p.amount)}</p>
                <StatusBadge status={p.status} />
              </div>
            </div>
          ))}
          {!recentPayments.length && <EmptyState dark icon={Receipt} title="Nenhum pagamento registrado" className="py-6" />}
        </div>
      </div>

      <div className="card">
        <p className="font-semibold mb-4">Tickets de suporte recentes</p>
        <div className="grid sm:grid-cols-2 gap-x-6">
          {tickets.map((t) => (
            <div key={t.id} className="flex items-center justify-between border-b border-ink-800 last:border-0 py-2">
              <div className="min-w-0">
                <p className="text-sm truncate">{t.subject}</p>
                <p className="text-xs text-white/40">{t.user?.full_name} · {t.category}</p>
              </div>
              <StatusBadge status={t.status} />
            </div>
          ))}
        </div>
        {!tickets.length && <EmptyState dark icon={Headset} title="Nenhum chamado aberto" className="py-6" />}
      </div>
    </div>
  )
}
