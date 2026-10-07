import { useEffect, useState } from 'react'
import { Download, Users, AlertTriangle } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDate, formatDateTime, maskCPF } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { downloadCSV } from '../../lib/csv'

interface Row { id: string; full_name: string; cpf: string | null; email: string | null; username: string | null; created_at: string; sub_status: string | null; sub_expires_at: string | null; balance: number; active: boolean }
interface PendingRow { id: string; email: string; created_at: string }

export default function AdminSubscribers() {
  const [rows, setRows] = useState<Row[]>([])
  const [pending, setPending] = useState<PendingRow[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)
  const [deletingPendingId, setDeletingPendingId] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: profiles } = await supabase.from('profiles').select('*').eq('role', 'subscriber').order('created_at', { ascending: false }).limit(200)
    const result: Row[] = []
    for (const p of profiles ?? []) {
      const [{ data: sub }, { data: bal }] = await Promise.all([
        supabase.from('subscriptions').select('status, expires_at').eq('subscriber_id', p.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.rpc('current_wallet_balance', { p_user_id: p.id }),
      ])
      result.push({ id: p.id, full_name: p.full_name, cpf: p.cpf, email: p.email, username: p.referral_code, created_at: p.created_at, sub_status: sub?.status ?? null, sub_expires_at: sub?.expires_at ?? null, balance: Number(bal ?? 0), active: p.active })
    }
    setRows(result)
    setLoading(false)
  }

  async function loadPending() {
    const { data } = await supabase.rpc('admin_list_pending_signups')
    setPending((data as PendingRow[]) ?? [])
  }

  useEffect(() => { load(); loadPending() }, [])

  // Cadastro que ficou travado no meio: código de confirmação nunca
  // chegou ou nunca foi digitado. Fica em auth.users sem profile — some
  // de qualquer listagem normal (que sempre parte de profiles), e sem
  // isso aqui não tinha jeito de localizar nem liberar o e-mail travado.
  async function deletePending(p: PendingRow) {
    if (!window.confirm(`Remover o cadastro pendente de ${p.email}? O e-mail fica livre para tentar de novo.`)) return
    setDeletingPendingId(p.id)
    const { data: sessionData } = await supabase.auth.getSession()
    const { error } = await supabase.functions.invoke('admin-delete-pending-signup', {
      body: { user_id: p.id },
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    })
    setDeletingPendingId(null)
    if (!error) setPending((prev) => prev.filter((x) => x.id !== p.id))
  }

  async function toggleActive(r: Row) {
    setBusy(r.id)
    const { error } = await supabase.rpc('admin_set_subscriber_active', { p_subscriber_id: r.id, p_active: !r.active })
    setBusy(null)
    if (error) return
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)))
  }

  function isExpired(r: Row) {
    return r.sub_status === 'active' && !!r.sub_expires_at && new Date(r.sub_expires_at) < new Date()
  }

  function exportCSV() {
    downloadCSV(
      `assinantes-brinde-mais-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        nome: r.full_name, nome_de_usuario: r.username ?? '', cpf: r.cpf ? maskCPF(r.cpf) : '', email: r.email ?? '',
        assinatura: r.sub_status ? (isExpired(r) ? 'vencida' : r.sub_status) : 'sem_assinatura',
        vence_em: r.sub_expires_at ?? '', saldo: r.balance.toFixed(2),
        status_conta: r.active ? 'ativo' : 'suspenso', cadastrado_em: r.created_at,
      })),
    )
  }

  const filtered = rows.filter((r) =>
    r.full_name.toLowerCase().includes(search.toLowerCase()) ||
    (r.username ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (r.cpf ?? '').includes(search.replace(/\D/g, '')),
  )

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Assinantes</h1>
          <p className="text-white/50 text-sm">{rows.length} cadastrados</p>
        </div>
        <div className="flex gap-2">
          <input className="input !w-64" placeholder="Buscar por nome, usuário ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} />
          <button onClick={exportCSV} className="btn-dark !px-3 !py-2 text-xs gap-1.5 shrink-0"><Download size={14} /> Exportar CSV</button>
        </div>
      </div>

      {pending.length > 0 && (
        <details className="card border-amber-500/30 bg-amber-500/5">
          <summary className="font-semibold cursor-pointer flex items-center gap-2 text-amber-400">
            <AlertTriangle size={16} /> {pending.length} cadastro{pending.length === 1 ? '' : 's'} pendente{pending.length === 1 ? '' : 's'} (código de confirmação nunca foi digitado)
          </summary>
          <div className="mt-3 divide-y divide-ink-800">
            {pending.map((p) => (
              <div key={p.id} className="py-2.5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-sm">{p.email}</p>
                  <p className="text-xs text-white/40">cadastrado em {formatDateTime(p.created_at)}</p>
                </div>
                <button
                  onClick={() => deletePending(p)}
                  disabled={deletingPendingId === p.id}
                  className="btn-ghost !py-1.5 !px-3 text-xs !border-red-500/40 text-red-400 shrink-0"
                >
                  {deletingPendingId === p.id ? 'Removendo...' : 'Remover e liberar e-mail'}
                </button>
              </div>
            ))}
          </div>
        </details>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase">
              <th className="pb-3">Nome</th><th className="pb-3">Nome de usuário</th><th className="pb-3">CPF</th><th className="pb-3">E-mail</th><th className="pb-3">Assinatura</th><th className="pb-3">Saldo</th><th className="pb-3">Desde</th><th className="pb-3">Conta</th><th className="pb-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-ink-800">
                <td className="py-3">{r.full_name}</td>
                <td className="py-3 text-white/50 font-mono">{r.username ?? '-'}</td>
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
                <td className="py-3">
                  <button onClick={() => toggleActive(r)} disabled={busy === r.id} className="btn-ghost !py-1.5 !px-3 text-xs">
                    {busy === r.id ? '...' : r.active ? 'Suspender' : 'Reativar'}
                  </button>
                </td>
              </tr>
            ))}
            {loading && <tr><td colSpan={9}><LoadingState dark label="Carregando assinantes..." className="py-8" /></td></tr>}
            {!loading && !filtered.length && <tr><td colSpan={9}><EmptyState dark icon={Users} title="Nenhum assinante encontrado" className="py-8" /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
