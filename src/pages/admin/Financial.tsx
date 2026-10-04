import { useEffect, useMemo, useState } from 'react'
import { AreaChart, Area, ResponsiveContainer, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { TrendingDown, TrendingUp, Users2, Wallet, KeyRound, Store, QrCode, Search, Undo2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { StatCard } from '../../components/ui/StatCard'
import { formatBRL, formatDateTime } from '../../lib/format'
import { useDashboardTheme } from '../../contexts/DashboardThemeContext'

const PLATFORM_COST_PCT = 0.15

interface MonthRow { key: string; label: string; gross: number; referralCost: number }
interface ConfirmedPayment { amount: number; confirmed_at: string; type: string; payment_method: string }
interface UserResult { id: string; full_name: string; email: string | null }
interface BonusRow { id: string; type: string; level: number; amount: number; status: string; created_at: string }

export default function AdminFinancial() {
  const { theme } = useDashboardTheme()
  const chartColors = theme === 'light'
    ? { grid: '#e8e4db', axis: '#8a8578', tooltipBg: '#ffffff', tooltipBorder: '#e8e4db' }
    : { grid: '#26262d', axis: '#666666', tooltipBg: '#151519', tooltipBorder: '#26262d' }
  const [payments, setPayments] = useState<{ amount: number; confirmed_at: string }[]>([])
  const [bonuses, setBonuses] = useState<{ amount: number; created_at: string }[]>([])
  const [confirmedByMethod, setConfirmedByMethod] = useState<ConfirmedPayment[]>([])
  const [loading, setLoading] = useState(true)

  const [walletQuery, setWalletQuery] = useState('')
  const [walletResults, setWalletResults] = useState<UserResult[]>([])
  const [searchingWallet, setSearchingWallet] = useState(false)
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null)
  const [selectedBalance, setSelectedBalance] = useState<number | null>(null)
  const [selectedBonuses, setSelectedBonuses] = useState<BonusRow[]>([])
  const [adjustAmount, setAdjustAmount] = useState('')
  const [adjustReason, setAdjustReason] = useState('')
  const [adjusting, setAdjusting] = useState(false)
  const [walletMsg, setWalletMsg] = useState('')
  const [reversingId, setReversingId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('payments').select('amount, confirmed_at').eq('type', 'subscription').eq('status', 'confirmed').not('confirmed_at', 'is', null),
      supabase.from('bonuses').select('amount, created_at').eq('status', 'confirmed'),
      supabase.from('payments').select('amount, confirmed_at, type, payment_method').in('type', ['subscription', 'partner_fee']).eq('status', 'confirmed'),
    ]).then(([{ data: p }, { data: b }, { data: cm }]) => {
      setPayments((p as any[]) ?? [])
      setBonuses((b as any[]) ?? [])
      setConfirmedByMethod((cm as ConfirmedPayment[]) ?? [])
      setLoading(false)
    })
  }, [])

  // "Ativação manual" = pagamento marcado payment_method='manual' (criado
  // em /admin/ativacao-manual), em oposição a pix/credit_card confirmados
  // direto pela Asaas — mesma distinção pedida pro financeiro: quanto
  // entrou de cada jeito, separado por assinante e por parceiro.
  const confirmations = useMemo(() => {
    const isManual = (p: ConfirmedPayment) => p.payment_method === 'manual'
    const subs = confirmedByMethod.filter((p) => p.type === 'subscription')
    const partners = confirmedByMethod.filter((p) => p.type === 'partner_fee')
    const sum = (rows: ConfirmedPayment[]) => rows.reduce((s, p) => s + Number(p.amount), 0)
    const manualRows = confirmedByMethod.filter(isManual)
    return {
      manualTotal: sum(manualRows),
      manualCount: manualRows.length,
      subscriberManual: sum(subs.filter(isManual)),
      subscriberAsaas: sum(subs.filter((p) => !isManual(p))),
      partnerManual: sum(partners.filter(isManual)),
      partnerAsaas: sum(partners.filter((p) => !isManual(p))),
    }
  }, [confirmedByMethod])

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

  async function searchWallet() {
    const q = walletQuery.trim()
    if (!q) return
    setSearchingWallet(true)
    const { data } = await supabase.from('profiles').select('id, full_name, email').or(`full_name.ilike.%${q}%,email.ilike.%${q}%`).limit(8)
    setWalletResults((data as UserResult[]) ?? [])
    setSearchingWallet(false)
  }

  async function selectUser(u: UserResult) {
    setSelectedUser(u)
    setWalletResults([])
    setWalletQuery('')
    setWalletMsg('')
    setAdjustAmount('')
    setAdjustReason('')
    const [{ data: balance }, { data: bonusRows }] = await Promise.all([
      supabase.rpc('current_wallet_balance', { p_user_id: u.id }),
      supabase.from('bonuses').select('id, type, level, amount, status, created_at').eq('beneficiary_id', u.id).order('created_at', { ascending: false }).limit(20),
    ])
    setSelectedBalance(typeof balance === 'number' ? balance : Number(balance ?? 0))
    setSelectedBonuses((bonusRows as BonusRow[]) ?? [])
  }

  async function applyAdjustment() {
    if (!selectedUser) return
    const amount = Number(adjustAmount)
    if (!amount) { setWalletMsg('Informe um valor diferente de zero (use - pra saldo negativo).'); return }
    setAdjusting(true)
    setWalletMsg('')
    const { error } = await supabase.rpc('admin_adjust_wallet', { p_user_id: selectedUser.id, p_amount: amount, p_reason: adjustReason || null })
    setAdjusting(false)
    if (error) { setWalletMsg('Não foi possível aplicar o ajuste.'); return }
    setWalletMsg('Ajuste aplicado com sucesso.')
    setAdjustAmount('')
    setAdjustReason('')
    selectUser(selectedUser)
  }

  async function reverseBonus(bonusId: string) {
    if (!selectedUser) return
    if (!confirm('Estornar este bônus? O valor sai do saldo da pessoa.')) return
    setReversingId(bonusId)
    const { error } = await supabase.rpc('admin_reverse_bonus', { p_bonus_id: bonusId })
    setReversingId(null)
    if (error) { setWalletMsg('Não foi possível estornar este bônus.'); return }
    selectUser(selectedUser)
  }

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
        <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-3">Confirmações por origem</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <StatCard
            label="Ativação manual"
            value={formatBRL(confirmations.manualTotal)}
            icon={<KeyRound size={18} />}
            tone="gold"
          />
          <StatCard
            label="Assinantes (manual)"
            value={formatBRL(confirmations.subscriberManual)}
            icon={<Users2 size={18} />}
          />
          <StatCard
            label="Assinantes (Asaas)"
            value={formatBRL(confirmations.subscriberAsaas)}
            icon={<QrCode size={18} />}
          />
          <StatCard
            label="Parceiros (manual)"
            value={formatBRL(confirmations.partnerManual)}
            icon={<Store size={18} />}
          />
          <StatCard
            label="Parceiros (Asaas)"
            value={formatBRL(confirmations.partnerAsaas)}
            icon={<QrCode size={18} />}
          />
        </div>
        <p className="text-xs text-white/30 mt-2">{confirmations.manualCount} pagamento{confirmations.manualCount === 1 ? '' : 's'} confirmado{confirmations.manualCount === 1 ? '' : 's'} manualmente no total (assinante + parceiro).</p>
      </div>

      <div className="card">
        <p className="font-semibold mb-1">Ajustes manuais de saldo</p>
        <p className="text-xs text-white/40 mb-4">Busque um assinante ou parceiro pra corrigir o saldo dele (positivo ou negativo) ou estornar um bônus específico.</p>

        <div className="flex gap-2 mb-3">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input
              className="input !pl-9"
              placeholder="Buscar por nome ou e-mail..."
              value={walletQuery}
              onChange={(e) => setWalletQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && searchWallet()}
            />
          </div>
          <button onClick={searchWallet} disabled={searchingWallet} className="btn-dark !px-4 text-xs">{searchingWallet ? 'Buscando...' : 'Buscar'}</button>
        </div>

        {walletResults.length > 0 && (
          <div className="rounded-lg border border-ink-800 divide-y divide-ink-800 mb-4">
            {walletResults.map((u) => (
              <button key={u.id} onClick={() => selectUser(u)} className="w-full text-left px-3 py-2 text-sm hover:bg-white/5 flex items-center justify-between">
                <span>{u.full_name}</span>
                <span className="text-xs text-white/40">{u.email}</span>
              </button>
            ))}
          </div>
        )}

        {selectedUser && (
          <div className="rounded-lg bg-ink-950 border border-ink-800 p-4 space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div>
                <p className="font-semibold text-sm">{selectedUser.full_name}</p>
                <p className="text-xs text-white/40">{selectedUser.email}</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-white/40">Saldo atual</p>
                <p className={`font-semibold ${(selectedBalance ?? 0) < 0 ? 'text-red-400' : 'text-gold-400'}`}>{formatBRL(selectedBalance ?? 0)}</p>
              </div>
            </div>

            <div className="grid sm:grid-cols-[1fr_2fr_auto] gap-2">
              <input className="input !text-xs" type="number" step="0.01" placeholder="Valor (-14.90)" value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)} />
              <input className="input !text-xs" placeholder="Motivo (opcional)" value={adjustReason} onChange={(e) => setAdjustReason(e.target.value)} />
              <button onClick={applyAdjustment} disabled={adjusting} className="btn-gold !py-2 text-xs">{adjusting ? 'Aplicando...' : 'Aplicar ajuste'}</button>
            </div>
            {walletMsg && <p className="text-xs text-white/50">{walletMsg}</p>}

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">Bônus recebidos</p>
              {selectedBonuses.length === 0 && <p className="text-xs text-white/30">Nenhum bônus registrado.</p>}
              <div className="space-y-1.5">
                {selectedBonuses.map((b) => (
                  <div key={b.id} className="flex items-center justify-between text-xs py-1.5 border-t border-ink-800">
                    <span className="text-white/60">{formatDateTime(b.created_at)} · nível {b.level} · {b.type}</span>
                    <div className="flex items-center gap-2">
                      <span className={b.status === 'reversed' ? 'text-white/30 line-through' : 'font-semibold'}>{formatBRL(b.amount)}</span>
                      {b.status !== 'reversed' ? (
                        <button onClick={() => reverseBonus(b.id)} disabled={reversingId === b.id} className="text-red-400 flex items-center gap-1">
                          <Undo2 size={12} /> Estornar
                        </button>
                      ) : (
                        <span className="text-white/30">Estornado</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
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
              <CartesianGrid strokeDasharray="3 3" stroke={chartColors.grid} vertical={false} />
              <XAxis dataKey="month" stroke={chartColors.axis} fontSize={12} />
              <YAxis stroke={chartColors.axis} fontSize={12} tickFormatter={(v) => formatBRL(v)} width={80} />
              <Tooltip contentStyle={{ background: chartColors.tooltipBg, border: `1px solid ${chartColors.tooltipBorder}`, borderRadius: 8, fontSize: 12 }} formatter={(v: number) => formatBRL(v)} />
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
