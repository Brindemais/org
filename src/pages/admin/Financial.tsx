import { useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { TrendingDown, TrendingUp, Users2, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { StatCard } from '../../components/ui/StatCard'
import { formatBRL } from '../../lib/format'

const PLATFORM_COST_PCT = 0.15

interface MonthRow { key: string; label: string; gross: number; referralCost: number }

export default function AdminFinancial() {
  const [payments, setPayments] = useState<{ amount: number; confirmed_at: string }[]>([])
  const [bonuses, setBonuses] = useState<{ amount: number; created_at: string }[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      supabase.from('payments').select('amount, confirmed_at').eq('type', 'subscription').eq('status', 'confirmed').not('confirmed_at', 'is', null),
      supabase.from('bonuses').select('amount, created_at').eq('status', 'confirmed'),
    ]).then(([{ data: p }, { data: b }]) => {
      setPayments((p as any[]) ?? [])
      setBonuses((b as any[]) ?? [])
      setLoading(false)
    })
  }, [])

  const monthly = useMemo(() => {
    const map = new Map<string, MonthRow>()
    const monthKey = (iso: string) => iso.slice(0, 7)
    const monthLabel = (iso: string) => new Date(iso).toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })

    for (const p of payments) {
      const key = monthKey(p.confirmed_at)
      const row = map.get(key) ?? { key, label: monthLabel(p.confirmed_at), gross: 0, referralCost: 0 }
      row.gross += Number(p.amount)
      map.set(key, row)
    }
    for (const b of bonuses) {
      const key = monthKey(b.created_at)
      const row = map.get(key) ?? { key, label: monthLabel(b.created_at), gross: 0, referralCost: 0 }
      row.referralCost += Number(b.amount)
      map.set(key, row)
    }
    return Array.from(map.values()).sort((a, b) => a.key.localeCompare(b.key)).slice(-12)
  }, [payments, bonuses])

  const totals = useMemo(() => {
    const gross = payments.reduce((s, p) => s + Number(p.amount), 0)
    const referralCost = bonuses.reduce((s, b) => s + Number(b.amount), 0)
    const platformCost = gross * PLATFORM_COST_PCT
    const net = gross - platformCost - referralCost
    return { gross, platformCost, referralCost, net }
  }, [payments, bonuses])

  const thisMonth = useMemo(() => {
    const key = new Date().toISOString().slice(0, 7)
    const row = monthly.find((m) => m.key === key) ?? { gross: 0, referralCost: 0 }
    const platformCost = row.gross * PLATFORM_COST_PCT
    return { gross: row.gross, platformCost, referralCost: row.referralCost, net: row.gross - platformCost - row.referralCost }
  }, [monthly])

  const chartData = monthly.map((m) => ({
    month: m.label,
    liquido: m.gross - m.gross * PLATFORM_COST_PCT - m.referralCost,
  }))

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Financeiro</h1>
        <p className="text-white/50 text-sm">Entradas de assinantes, custos e valor líquido (assinaturas confirmadas).</p>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-3">Mês atual</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Entradas de assinantes" value={formatBRL(thisMonth.gross)} icon={<TrendingUp size={18} />} tone="gold" />
          <StatCard label={`Custo (${(PLATFORM_COST_PCT * 100).toFixed(0)}%)`} value={formatBRL(thisMonth.platformCost)} icon={<TrendingDown size={18} />} />
          <StatCard label="Custo de indicações" value={formatBRL(thisMonth.referralCost)} icon={<Users2 size={18} />} />
          <StatCard label="Valor líquido" value={formatBRL(thisMonth.net)} icon={<Wallet size={18} />} />
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-3">Acumulado (todo o período)</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard label="Entradas de assinantes" value={formatBRL(totals.gross)} icon={<TrendingUp size={18} />} tone="gold" />
          <StatCard label={`Custo (${(PLATFORM_COST_PCT * 100).toFixed(0)}%)`} value={formatBRL(totals.platformCost)} icon={<TrendingDown size={18} />} />
          <StatCard label="Custo de indicações" value={formatBRL(totals.referralCost)} icon={<Users2 size={18} />} />
          <StatCard label="Valor líquido" value={formatBRL(totals.net)} icon={<Wallet size={18} />} />
        </div>
      </div>

      <div className="card">
        <p className="font-semibold mb-4">Valor líquido por mês</p>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="gold2" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#d4941e" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="#d4941e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#26262d" vertical={false} />
              <XAxis dataKey="month" stroke="#666" fontSize={12} />
              <YAxis stroke="#666" fontSize={12} tickFormatter={(v) => formatBRL(v)} width={80} />
              <Tooltip contentStyle={{ background: '#151519', border: '1px solid #26262d', borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatBRL(v)} />
              <Area type="monotone" dataKey="liquido" stroke="#d4941e" fill="url(#gold2)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase">
              <th className="pb-3">Mês</th>
              <th className="pb-3">Entradas de assinantes</th>
              <th className="pb-3">Custo ({(PLATFORM_COST_PCT * 100).toFixed(0)}%)</th>
              <th className="pb-3">Custo de indicações</th>
              <th className="pb-3">Valor líquido</th>
            </tr>
          </thead>
          <tbody>
            {[...monthly].reverse().map((m) => {
              const platformCost = m.gross * PLATFORM_COST_PCT
              const net = m.gross - platformCost - m.referralCost
              return (
                <tr key={m.key} className="border-t border-ink-800">
                  <td className="py-3 capitalize">{m.label}</td>
                  <td className="py-3">{formatBRL(m.gross)}</td>
                  <td className="py-3 text-white/50">-{formatBRL(platformCost)}</td>
                  <td className="py-3 text-white/50">-{formatBRL(m.referralCost)}</td>
                  <td className="py-3 font-semibold text-gold-400">{formatBRL(net)}</td>
                </tr>
              )
            })}
            {!loading && !monthly.length && (
              <tr><td colSpan={5} className="py-8 text-center text-white/40">Nenhuma assinatura confirmada ainda.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
