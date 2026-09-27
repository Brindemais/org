import { useEffect, useState } from 'react'
import { Download, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDate, maskCPF } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { downloadCSV } from '../../lib/csv'
import type { SubscriptionPlan } from '../../lib/types'

interface Row { id: string; full_name: string; cpf: string | null; email: string | null; created_at: string; sub_status: string | null; sub_expires_at: string | null; balance: number; active: boolean }

export default function AdminSubscribers() {
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [activating, setActivating] = useState<string | null>(null)
  const [activatePlan, setActivatePlan] = useState<SubscriptionPlan>('monthly')
  const [activateNote, setActivateNote] = useState('')
  const [activateError, setActivateError] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: profiles } = await supabase.from('profiles').select('*').eq('role', 'subscriber').order('created_at', { ascending: false }).limit(200)
    const result: Row[] = []
    for (const p of profiles ?? []) {
      const [{ data: sub }, { data: bal }] = await Promise.all([
        supabase.from('subscriptions').select('status, expires_at').eq('subscriber_id', p.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.rpc('current_wallet_balance', { p_user_id: p.id }),
      ])
      result.push({ id: p.id, full_name: p.full_name, cpf: p.cpf, email: p.email, created_at: p.created_at, sub_status: sub?.status ?? null, sub_expires_at: sub?.expires_at ?? null, balance: Number(bal ?? 0), active: p.active })
    }
    setRows(result)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleActive(r: Row) {
    setBusy(r.id)
    const { error } = await supabase.rpc('admin_set_subscriber_active', { p_subscriber_id: r.id, p_active: !r.active })
    setBusy(null)
    if (error) return
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)))
  }

  function openActivate(id: string) {
    setActivating(id)
    setActivatePlan('monthly')
    setActivateNote('')
    setActivateError(null)
  }

  async function confirmActivate(id: string) {
    if (!activateNote.trim()) {
      setActivateError('Descreva o motivo (ex.: pagamento combinado por WhatsApp, cortesia, migração).')
      return
    }
    setBusy(id)
    setActivateError(null)
    const { error } = await supabase.rpc('admin_activate_subscription_manually', {
      p_subscriber_id: id, p_plan: activatePlan, p_note: activateNote.trim(),
    })
    setBusy(null)
    if (error) {
      setActivateError('Não foi possível ativar. Tente novamente.')
      return
    }
    setActivating(null)
    load()
  }

  function isExpired(r: Row) {
    return r.sub_status === 'active' && !!r.sub_expires_at && new Date(r.sub_expires_at) < new Date()
  }

  function exportCSV() {
    downloadCSV(
      `assinantes-brinde-mais-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        nome: r.full_name, cpf: r.cpf ? maskCPF(r.cpf) : '', email: r.email ?? '',
        assinatura: r.sub_status ? (isExpired(r) ? 'vencida' : r.sub_status) : 'sem_assinatura',
        vence_em: r.sub_expires_at ?? '', saldo: r.balance.toFixed(2),
        status_conta: r.active ? 'ativo' : 'suspenso', cadastrado_em: r.created_at,
      })),
    )
  }

  const filtered = rows.filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase()) || (r.cpf ?? '').includes(search.replace(/\D/g, '')))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Assinantes</h1>
          <p className="text-white/50 text-sm">{rows.length} cadastrados</p>
        </div>
        <div className="flex gap-2">
          <input className="input !w-64" placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={exportCSV} className="btn-dark !px-3 !py-2 text-xs gap-1.5 shrink-0"><Download size={14} /> Exportar CSV</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[800px]">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase">
              <th className="pb-3">Nome</th><th className="pb-3">CPF</th><th className="pb-3">E-mail</th><th className="pb-3">Assinatura</th><th className="pb-3">Saldo</th><th className="pb-3">Desde</th><th className="pb-3">Conta</th><th className="pb-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-ink-800">
                <td className="py-3">{r.full_name}</td>
                <td className="py-3 text-white/50">{r.cpf ? maskCPF(r.cpf) : '-'}</td>
                <td className="py-3 text-white/50">{r.email}</td>
                <td className="py-3">
                  {r.sub_status ? (
                    isExpired(r) ? (
                      <span className="pill bg-red-500/15 text-red-400">Vencida</span>
                    ) : (
                      <StatusBadge status={r.sub_status} />
                    )
                  ) : (
                    <span className="text-white/30">Sem assinatura</span>
                  )}
                  {r.sub_expires_at && <p className="text-[11px] text-white/30 mt-1">até {formatDate(r.sub_expires_at)}</p>}
                </td>
                <td className="py-3">{formatBRL(r.balance)}</td>
                <td className="py-3 text-white/50">{formatDate(r.created_at)}</td>
                <td className="py-3">
                  <span className={`pill ${r.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{r.active ? 'Ativa' : 'Suspensa'}</span>
                </td>
                <td className="py-3 flex gap-2">
                  <button onClick={() => toggleActive(r)} disabled={busy === r.id} className="btn-ghost !py-1.5 !px-3 text-xs">
                    {busy === r.id ? '...' : r.active ? 'Suspender' : 'Reativar'}
                  </button>
                  <button onClick={() => openActivate(r.id)} className="btn-ghost !py-1.5 !px-3 text-xs">
                    Ativar assinatura
                  </button>
                </td>
              </tr>
            ))}
            {activating && filtered.some((r) => r.id === activating) && (
              <tr className="border-t border-ink-800 bg-ink-900/50">
                <td colSpan={8} className="py-4">
                  <div className="flex flex-wrap items-start gap-3 max-w-2xl">
                    <div>
                      <label className="text-xs text-white/40 block mb-1">Plano</label>
                      <select className="input !py-2 !w-32" value={activatePlan} onChange={(e) => setActivatePlan(e.target.value as SubscriptionPlan)}>
                        <option value="monthly">Mensal</option>
                        <option value="annual">Anual</option>
                      </select>
                    </div>
                    <div className="flex-1 min-w-[220px]">
                      <label className="text-xs text-white/40 block mb-1">Motivo (aparece marcado como manual nos pagamentos)</label>
                      <input
                        className="input !py-2 w-full"
                        placeholder="Ex.: pagamento combinado por WhatsApp"
                        value={activateNote}
                        onChange={(e) => setActivateNote(e.target.value)}
                      />
                    </div>
                    <div className="flex gap-2 pt-5">
                      <button onClick={() => confirmActivate(activating)} disabled={busy === activating} className="btn-gold !py-2 !px-3 text-xs">
                        {busy === activating ? 'Ativando...' : 'Confirmar ativação'}
                      </button>
                      <button onClick={() => setActivating(null)} className="btn-ghost !py-2 !px-3 text-xs">Cancelar</button>
                    </div>
                  </div>
                  {activateError && <p className="text-xs text-red-400 mt-2">{activateError}</p>}
                </td>
              </tr>
            )}
            {loading && <tr><td colSpan={8}><LoadingState dark label="Carregando assinantes..." className="py-8" /></td></tr>}
            {!loading && !filtered.length && <tr><td colSpan={8}><EmptyState dark icon={Users} title="Nenhum assinante encontrado" className="py-8" /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
