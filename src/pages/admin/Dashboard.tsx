import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import {
  Users, UserPlus, Wallet, Store, Landmark, PackageCheck, Warehouse, Banknote,
  Receipt, Headset, ArrowDownLeft, ArrowUpRight, AlertTriangle,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatBRL, formatDateTime } from '../../lib/format'
import { useDashboardTheme } from '../../contexts/DashboardThemeContext'

const DAY_MS = 86_400_000
const LOW_STOCK_THRESHOLD = 5

function pctChange(current: number, previous: number): number {
  if (previous === 0) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

function monthKey(iso: string) {
  return iso.slice(0, 7)
}
function monthLabel(iso: string) {
  return new Date(iso).toLocaleDateString('pt-BR', { month: 'short' })
}

interface FeedItem { id: string; label: string; sublabel: string; amount: number; direction: 'in' | 'out'; created_at: string }

const RENEWAL_COLORS = { renewed: '#d4941e', dueSoon: '#f4da8c', expired: '#37373f' }

export default function AdminDashboard() {
  const { profile } = useAuth()
  const { theme } = useDashboardTheme()
  const chartColors = theme === 'light'
    ? { grid: '#e8e4db', axis: '#8a8578', tooltipBg: '#ffffff', tooltipBorder: '#e8e4db' }
    : { grid: '#26262d', axis: '#666666', tooltipBg: '#151519', tooltipBorder: '#26262d' }

  const [monthsBack, setMonthsBack] = useState(6)
  const [kpi, setKpi] = useState({
    subsActive: 0, subsActiveTrend: 0, subsTotal: 0,
    newSubsThisMonth: 0, newSubsTrend: 0,
    revenueGross: 0, revenueTrend: 0,
    partnersActive: 0, partnersTrend: 0, pendingPartners: 0,
    pendingPayments: 0,
    pendingWithdrawalsCount: 0, pendingWithdrawalsAmount: 0,
    pendingPickups: 0,
    matrixStockTotal: 0, lowStockAlerts: 0,
    withdrawnTotal: 0,
    activationRate: 0, avgTicket: 0, mrr: 0,
  })
  const [subsGrowthAll, setSubsGrowthAll] = useState<{ key: string; label: string; count: number }[]>([])
  const [partnerGrowthAll, setPartnerGrowthAll] = useState<{ key: string; label: string; novos: number; ativos: number }[]>([])
  const [renewalBuckets, setRenewalBuckets] = useState({ renewed: 0, dueSoon: 0, expired: 0 })
  const [feed, setFeed] = useState<FeedItem[]>([])
  const [pendingWithdrawalsNamed, setPendingWithdrawalsNamed] = useState<any[]>([])
  const [tickets, setTickets] = useState<any[]>([])
  const [stockAlertsList, setStockAlertsList] = useState<any[]>([])

  useEffect(() => {
    async function load() {
      const now = new Date()
      const monthAgo = new Date(now.getTime() - 30 * DAY_MS).toISOString()
      const twelveMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 11, 1).toISOString()
      const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
      const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString()

      const [
        { count: subsActive }, { count: subsActive30dAgo }, { count: subsTotal },
        { data: activeSubs }, { data: everActivated },
        { count: partnersActive }, { count: partnersActive30dAgo }, { count: pendingPartners },
        { count: pendingPayments },
        { data: pendingWithdrawals }, { count: pendingPickups },
        { data: lowStockRows }, { data: matrixStock },
        { data: paidWithdrawals },
        { count: newSubsThisMonth }, { count: newSubsLastMonth },
        { data: allSubs }, { data: allPartners },
        { data: payments }, { data: withdrawalsForFeed }, { data: bonusesForFeed },
        { data: ticketRows }, { data: lowStockDetail },
      ] = await Promise.all([
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).eq('status', 'active').lte('activated_at', monthAgo),
        supabase.from('profiles').select('id', { count: 'exact', head: true }).eq('role', 'subscriber'),
        supabase.from('subscriptions').select('amount, plan, status, expires_at').eq('status', 'active'),
        supabase.from('subscriptions').select('status, activated_at, expires_at').not('activated_at', 'is', null),
        supabase.from('partners').select('id', { count: 'exact', head: true }).eq('status', 'active'),
        supabase.from('partners').select('id', { count: 'exact', head: true }).eq('status', 'active').lte('approved_at', monthAgo),
        supabase.from('partners').select('id', { count: 'exact', head: true }).in('status', ['interested', 'pending_docs', 'analyzing']),
        supabase.from('payments').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('withdrawals').select('id, amount, requested_at, status, user:user_id(full_name)').eq('status', 'requested').order('requested_at', { ascending: false }),
        supabase.from('pickups').select('id', { count: 'exact', head: true }).eq('status', 'ready'),
        supabase.from('stock_partner').select('quantity').lte('quantity', LOW_STOCK_THRESHOLD),
        supabase.from('stock_matrix').select('quantity'),
        supabase.from('withdrawals').select('amount').eq('status', 'paid'),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).gte('activated_at', startOfThisMonth),
        supabase.from('subscriptions').select('id', { count: 'exact', head: true }).gte('activated_at', startOfLastMonth).lt('activated_at', startOfThisMonth),
        supabase.from('subscriptions').select('created_at').gte('created_at', twelveMonthsAgo),
        supabase.from('partners').select('approved_at, status').not('approved_at', 'is', null).gte('approved_at', twelveMonthsAgo),
        supabase.from('payments').select('amount, created_at, subscriber:subscriber_id(full_name)').eq('type', 'subscription').eq('status', 'confirmed').order('created_at', { ascending: false }).limit(8),
        supabase.from('withdrawals').select('amount, processed_at, user:user_id(full_name)').eq('status', 'paid').order('processed_at', { ascending: false }).limit(8),
        supabase.from('bonuses').select('amount, created_at, beneficiary:beneficiary_id(full_name)').eq('status', 'confirmed').order('created_at', { ascending: false }).limit(8),
        supabase.from('support_tickets').select('*, user:user_id(full_name)').order('created_at', { ascending: false }).limit(5),
        supabase.from('stock_partner').select('quantity, product:product_id(name), partner:partner_id(trade_name)').lte('quantity', LOW_STOCK_THRESHOLD).order('quantity', { ascending: true }).limit(3),
      ])

      // Financial KPIs — Receita bruta + a rough "vs. 30 dias atrás" trend using
      // the same proxy as subs/partners below (no historical snapshot table to
      // compare against, so we approximate with "already active a month ago").
      const revenueGross = (activeSubs ?? []).reduce((s, r: any) => s + Number(r.amount), 0)
      const mrr = (activeSubs ?? []).reduce((s, r: any) => s + (r.plan === 'annual' ? Number(r.amount) / 12 : Number(r.amount)), 0)
      const withdrawnTotal = (paidWithdrawals ?? []).reduce((s, r: any) => s + Number(r.amount), 0)
      const pendingWithdrawalsAmount = (pendingWithdrawals ?? []).reduce((s, r: any) => s + Number(r.amount), 0)
      const matrixStockTotal = (matrixStock ?? []).reduce((s, r: any) => s + Number(r.quantity), 0)

      // Renovações: de tudo que já foi ativado alguma vez, 3 baldes — saudável,
      // vencendo em até 7 dias, ou vencida/inativa. Mesma regra de "vencida"
      // usada no resto do app (status ainda active mas expires_at já passou).
      let renewed = 0, dueSoon = 0, expired = 0
      for (const s of (everActivated ?? []) as any[]) {
        if (s.status !== 'active') { expired++; continue }
        if (!s.expires_at) { renewed++; continue }
        const daysLeft = Math.ceil((new Date(s.expires_at).getTime() - now.getTime()) / DAY_MS)
        if (daysLeft < 0) expired++
        else if (daysLeft <= 7) dueSoon++
        else renewed++
      }
      setRenewalBuckets({ renewed, dueSoon, expired })

      // Crescimento de assinantes — novas assinaturas por mês, últimos 12
      // meses (o seletor de período só recorta esse array, sem refetch).
      const subsMonthly = new Map<string, { key: string; label: string; count: number }>()
      for (const s of (allSubs ?? []) as any[]) {
        const key = monthKey(s.created_at)
        const row = subsMonthly.get(key) ?? { key, label: monthLabel(s.created_at), count: 0 }
        row.count++
        subsMonthly.set(key, row)
      }
      setSubsGrowthAll(Array.from(subsMonthly.values()).sort((a, b) => a.key.localeCompare(b.key)))

      // Desempenho da rede — novos parceiros aprovados por mês + contagem
      // acumulada de quantos seguiam ativos até o fim de cada mês.
      const partnerRows = ((allPartners ?? []) as any[]).sort((a, b) => a.approved_at.localeCompare(b.approved_at))
      const partnerMonthly = new Map<string, { key: string; label: string; novos: number; ativos: number }>()
      let cumulativeActive = 0
      for (const p of partnerRows) {
        const key = monthKey(p.approved_at)
        const row = partnerMonthly.get(key) ?? { key, label: monthLabel(p.approved_at), novos: 0, ativos: 0 }
        row.novos++
        if (p.status === 'active') cumulativeActive++
        row.ativos = cumulativeActive
        partnerMonthly.set(key, row)
      }
      setPartnerGrowthAll(Array.from(partnerMonthly.values()).sort((a, b) => a.key.localeCompare(b.key)))

      // Últimos lançamentos financeiros — mistura pagamentos, saques pagos e
      // bonificações de indicação confirmadas num único extrato, mais parecido
      // com um livro-caixa do que só a tabela de payments.
      const feedItems: FeedItem[] = [
        ...((payments ?? []) as any[]).map((p) => ({
          id: `pay-${p.created_at}-${p.subscriber?.full_name}`, label: 'Receita - Assinatura',
          sublabel: p.subscriber?.full_name ?? '-', amount: Number(p.amount), direction: 'in' as const, created_at: p.created_at,
        })),
        ...((withdrawalsForFeed ?? []) as any[]).map((w) => ({
          id: `wd-${w.processed_at}-${w.user?.full_name}`, label: 'Saque',
          sublabel: w.user?.full_name ?? '-', amount: Number(w.amount), direction: 'out' as const, created_at: w.processed_at,
        })),
        ...((bonusesForFeed ?? []) as any[]).map((b) => ({
          id: `bon-${b.created_at}-${b.beneficiary?.full_name}`, label: 'Indicação',
          sublabel: b.beneficiary?.full_name ?? '-', amount: Number(b.amount), direction: 'in' as const, created_at: b.created_at,
        })),
      ].sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 6)
      setFeed(feedItems)

      setKpi({
        subsActive: subsActive ?? 0,
        subsActiveTrend: pctChange(subsActive ?? 0, subsActive30dAgo ?? 0),
        subsTotal: subsTotal ?? 0,
        newSubsThisMonth: newSubsThisMonth ?? 0,
        newSubsTrend: pctChange(newSubsThisMonth ?? 0, newSubsLastMonth ?? 0),
        revenueGross,
        revenueTrend: pctChange(subsActive ?? 0, subsActive30dAgo ?? 0), // proxy: receita segue o crescimento de ativos
        partnersActive: partnersActive ?? 0,
        partnersTrend: pctChange(partnersActive ?? 0, partnersActive30dAgo ?? 0),
        pendingPartners: pendingPartners ?? 0,
        pendingPayments: pendingPayments ?? 0,
        pendingWithdrawalsCount: (pendingWithdrawals ?? []).length,
        pendingWithdrawalsAmount,
        pendingPickups: pendingPickups ?? 0,
        matrixStockTotal,
        lowStockAlerts: (lowStockRows ?? []).length,
        withdrawnTotal,
        activationRate: (partnersActive ?? 0) + (pendingPartners ?? 0) > 0 ? Math.round(((partnersActive ?? 0) / ((partnersActive ?? 0) + (pendingPartners ?? 0))) * 100) : 0,
        avgTicket: (subsActive ?? 0) > 0 ? revenueGross / (subsActive ?? 1) : 0,
        mrr,
      })
      setPendingWithdrawalsNamed((pendingWithdrawals ?? []).slice(0, 5))
      setTickets(ticketRows ?? [])
      setStockAlertsList(lowStockDetail ?? [])
    }
    load()
  }, [])

  const subsGrowth = useMemo(() => subsGrowthAll.slice(-monthsBack), [subsGrowthAll, monthsBack])
  const partnerGrowth = useMemo(() => partnerGrowthAll.slice(-monthsBack), [partnerGrowthAll, monthsBack])

  const renewalTotal = renewalBuckets.renewed + renewalBuckets.dueSoon + renewalBuckets.expired
  const renewalRate = renewalTotal ? Math.round((renewalBuckets.renewed / renewalTotal) * 100) : 0
  const renewalData = [
    { name: 'Renovadas', value: renewalBuckets.renewed, color: RENEWAL_COLORS.renewed },
    { name: 'A vencer (7 dias)', value: renewalBuckets.dueSoon, color: RENEWAL_COLORS.dueSoon },
    { name: 'Vencidas', value: renewalBuckets.expired, color: RENEWAL_COLORS.expired },
  ]

  const firstName = profile?.full_name?.split(' ')[0] ?? ''

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Olá, {firstName || 'admin'}! 👋</h1>
        <p className="text-white/50 text-sm">Bem-vindo(a) ao painel administrativo da Brinde Mais.</p>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Assinantes ativos" value={kpi.subsActive.toLocaleString('pt-BR')} icon={<Users size={18} />} trend={{ pct: kpi.subsActiveTrend, label: 'vs. 30 dias atrás' }} />
        <StatCard label="Novas assinaturas" value={kpi.newSubsThisMonth.toLocaleString('pt-BR')} icon={<UserPlus size={18} />} trend={{ pct: kpi.newSubsTrend, label: 'vs. mês anterior' }} />
        <StatCard label="Receita bruta" value={formatBRL(kpi.revenueGross)} icon={<Wallet size={18} />} tone="gold" trend={{ pct: kpi.revenueTrend, label: 'vs. 30 dias atrás' }} />
        <StatCard label="Saques pendentes" value={formatBRL(kpi.pendingWithdrawalsAmount)} hint={`${kpi.pendingWithdrawalsCount} solicitação${kpi.pendingWithdrawalsCount === 1 ? '' : 'ões'}`} icon={<Landmark size={18} />} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Retiradas pendentes" value={kpi.pendingPickups.toLocaleString('pt-BR')} hint="Aguardando confirmação do parceiro" icon={<PackageCheck size={18} />} />
        <StatCard label="Parceiros ativos" value={kpi.partnersActive.toLocaleString('pt-BR')} icon={<Store size={18} />} trend={{ pct: kpi.partnersTrend, label: 'vs. 30 dias atrás' }} />
        <Link to="/admin/estoque" className="block">
          <StatCard label="Estoque da matriz" value={`${kpi.matrixStockTotal.toLocaleString('pt-BR')} itens`} hint={`${kpi.lowStockAlerts} alerta${kpi.lowStockAlerts === 1 ? '' : 's'}`} icon={<Warehouse size={18} />} />
        </Link>
        <StatCard label="Valores sacados" value={formatBRL(kpi.withdrawnTotal)} hint="Total pago em saques" icon={<Banknote size={18} />} />
      </div>

      <div className="grid xl:grid-cols-4 gap-6">
        <div className="card xl:col-span-1">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold">Crescimento de assinantes</p>
            <select value={monthsBack} onChange={(e) => setMonthsBack(Number(e.target.value))} className="input !w-auto !py-1 !px-2 !text-xs">
              <option value={3}>Últimos 3 meses</option>
              <option value={6}>Últimos 6 meses</option>
              <option value={12}>Últimos 12 meses</option>
            </select>
          </div>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={subsGrowth}>
                <defs>
                  <linearGradient id="gold" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#d4941e" stopOpacity={0.5} />
                    <stop offset="100%" stopColor="#d4941e" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="label" stroke={chartColors.axis} fontSize={11} />
                <YAxis stroke={chartColors.axis} fontSize={11} allowDecimals={false} width={30} />
                <Tooltip contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} labelFormatter={(l) => `Novas assinaturas · ${l}`} />
                <Area type="monotone" dataKey="count" name="Novas assinaturas" stroke="#d4941e" fill="url(#gold)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="card xl:col-span-1">
          <p className="font-semibold mb-2">Renovações</p>
          <div className="relative h-36">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={renewalData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={65} paddingAngle={2} strokeWidth={0}>
                  {renewalData.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                </Pie>
                <Tooltip contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
              <p className="text-xl font-bold">{renewalRate}%</p>
              <p className="text-[10px] text-white/40">renovação</p>
            </div>
          </div>
          <div className="space-y-1.5 mt-2">
            {renewalData.map((r) => (
              <div key={r.name} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-white/60"><span className="w-2 h-2 rounded-full" style={{ background: r.color }} />{r.name}</span>
                <span className="font-medium">{r.value} ({renewalTotal ? Math.round((r.value / renewalTotal) * 100) : 0}%)</span>
              </div>
            ))}
          </div>
          <div className="border-t border-ink-800 mt-3 pt-2 flex items-center justify-between">
            <span className="text-xs text-white/40">MRR</span>
            <span className="text-sm font-semibold text-gold-400">{formatBRL(kpi.mrr)}</span>
          </div>
        </div>

        <div className="card xl:col-span-1">
          <p className="font-semibold mb-4">Desempenho da rede</p>
          <div className="h-36">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={partnerGrowth}>
                <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
                <XAxis dataKey="label" stroke={chartColors.axis} fontSize={11} />
                <YAxis stroke={chartColors.axis} fontSize={11} allowDecimals={false} width={24} />
                <Tooltip contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="novos" name="Novos" fill="#d4941e" radius={[3, 3, 0, 0]} />
                <Bar dataKey="ativos" name="Ativos" fill="#666666" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-3 mt-3 pt-3 border-t border-ink-800">
            <div>
              <p className="text-[10px] text-white/40">Taxa de ativação</p>
              <p className="text-sm font-semibold">{kpi.activationRate}%</p>
            </div>
            <div>
              <p className="text-[10px] text-white/40">Ticket médio</p>
              <p className="text-sm font-semibold">{formatBRL(kpi.avgTicket)}</p>
            </div>
          </div>
        </div>

        <div className="card xl:col-span-1 space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm">Aprovações pendentes</p>
              <Link to="/admin/parceiros" className="text-[11px] text-gold-400 font-medium">Ver todas</Link>
            </div>
            <div className="space-y-1.5">
              <Link to="/admin/parceiros" className="flex items-center justify-between text-xs py-1.5 border-b border-ink-800">
                <span className="text-white/60">Novos parceiros</span>
                <span className="font-semibold text-gold-400">{kpi.pendingPartners}</span>
              </Link>
              <Link to="/admin/pagamentos" className="flex items-center justify-between text-xs py-1.5 border-b border-ink-800">
                <span className="text-white/60">Pagamentos Pix pendentes</span>
                <span className="font-semibold text-gold-400">{kpi.pendingPayments}</span>
              </Link>
              <Link to="/admin/saques" className="flex items-center justify-between text-xs py-1.5">
                <span className="text-white/60">Solicitações de saque</span>
                <span className="font-semibold text-gold-400">{kpi.pendingWithdrawalsCount}</span>
              </Link>
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold text-sm">Alertas de estoque</p>
              <Link to="/admin/estoque" className="text-[11px] text-gold-400 font-medium">Ver todos</Link>
            </div>
            <div className="space-y-2">
              {stockAlertsList.map((s: any, i: number) => (
                <div key={i} className="flex items-center gap-2 text-xs">
                  <AlertTriangle size={13} className="text-red-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate">{s.product?.name}</p>
                    <p className="text-white/40 text-[10px] truncate">{s.partner?.trade_name} · {s.quantity === 0 ? 'Sem estoque' : `Estoque baixo (${s.quantity} un.)`}</p>
                  </div>
                </div>
              ))}
              {!stockAlertsList.length && <p className="text-xs text-white/30">Nenhum alerta no momento.</p>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold">Solicitações de saque</p>
            <Link to="/admin/saques" className="text-xs text-gold-400 font-medium">Ver todas</Link>
          </div>
          <div className="space-y-2">
            {pendingWithdrawalsNamed.map((w) => (
              <div key={w.id} className="flex items-center justify-between border-b border-ink-800 last:border-0 pb-2 last:pb-0">
                <div className="min-w-0">
                  <p className="text-sm truncate">{w.user?.full_name}</p>
                  <p className="text-xs text-white/40">{formatDateTime(w.requested_at)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold">{formatBRL(w.amount)}</p>
                  <StatusBadge status={w.status} />
                </div>
              </div>
            ))}
            {!pendingWithdrawalsNamed.length && <EmptyState dark icon={Landmark} title="Nenhum saque pendente" className="py-6" />}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold">Tickets de suporte recentes</p>
            <Link to="/admin/suporte" className="text-xs text-gold-400 font-medium">Ver todos</Link>
          </div>
          <div className="space-y-2">
            {tickets.map((t) => (
              <div key={t.id} className="border-b border-ink-800 last:border-0 pb-2 last:pb-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm truncate">{t.subject}</p>
                  <StatusBadge status={t.status} />
                </div>
                <p className="text-xs text-white/40">{t.user?.full_name} · {formatDateTime(t.created_at)}</p>
              </div>
            ))}
            {!tickets.length && <EmptyState dark icon={Headset} title="Nenhum chamado aberto" className="py-6" />}
          </div>
        </div>

        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <p className="font-semibold">Últimos lançamentos financeiros</p>
            <Link to="/admin/financeiro" className="text-xs text-gold-400 font-medium">Ver financeiro</Link>
          </div>
          <div className="space-y-2">
            {feed.map((f) => (
              <div key={f.id} className="flex items-center gap-2.5 border-b border-ink-800 last:border-0 pb-2 last:pb-0">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${f.direction === 'in' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {f.direction === 'in' ? <ArrowDownLeft size={13} /> : <ArrowUpRight size={13} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm truncate">{f.label} - {f.sublabel}</p>
                  <p className="text-xs text-white/40">{formatDateTime(f.created_at)}</p>
                </div>
                <p className={`text-sm font-semibold shrink-0 ${f.direction === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {f.direction === 'in' ? '+' : '-'} {formatBRL(f.amount)}
                </p>
              </div>
            ))}
            {!feed.length && <EmptyState dark icon={Receipt} title="Nenhum lançamento registrado" className="py-6" />}
          </div>
        </div>
      </div>
    </div>
  )
}
