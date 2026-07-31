import { useEffect, useState } from 'react'
import { Download, Users } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDate, maskCPF } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { downloadCSV } from '../../lib/csv'

interface Row { id: string; full_name: string; cpf: string | null; email: string | null; created_at: string; sub_status: string | null; balance: number; active: boolean }

export default function AdminSubscribers() {
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    const { data: profiles } = await supabase.from('profiles').select('*').eq('role', 'subscriber').order('created_at', { ascending: false }).limit(200)
    const result: Row[] = []
    for (const p of profiles ?? []) {
      const [{ data: sub }, { data: bal }] = await Promise.all([
        supabase.from('subscriptions').select('status').eq('subscriber_id', p.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.rpc('current_wallet_balance', { p_user_id: p.id }),
      ])
      result.push({ id: p.id, full_name: p.full_name, cpf: p.cpf, email: p.email, created_at: p.created_at, sub_status: sub?.status ?? null, balance: Number(bal ?? 0), active: p.active })
    }
    setRows(result)
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function toggleActive(r: Row) {
    setBusy(r.id)
    await supabase.rpc('admin_set_subscriber_active', { p_subscriber_id: r.id, p_active: !r.active })
    setRows((prev) => prev.map((x) => (x.id === r.id ? { ...x, active: !x.active } : x)))
    setBusy(null)
  }

  function exportCSV() {
    downloadCSV(
      `assinantes-brinde-mais-${new Date().toISOString().slice(0, 10)}.csv`,
      filtered.map((r) => ({
        nome: r.full_name, cpf: r.cpf ? maskCPF(r.cpf) : '', email: r.email ?? '',
        assinatura: r.sub_status ?? 'sem_assinatura', saldo: r.balance.toFixed(2),
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
                <td className="py-3">{r.sub_status ? <StatusBadge status={r.sub_status} /> : <span className="text-white/30">Sem assinatura</span>}</td>
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
            {loading && <tr><td colSpan={8}><LoadingState dark label="Carregando assinantes..." className="py-8" /></td></tr>}
            {!loading && !filtered.length && <tr><td colSpan={8}><EmptyState dark icon={Users} title="Nenhum assinante encontrado" className="py-8" /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
