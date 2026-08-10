import { useEffect, useMemo, useState } from 'react'
import { History, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

interface LogRow {
  id: string
  action: string
  entity: string
  entity_id: string
  before: Record<string, unknown> | null
  after: Record<string, unknown> | null
  created_at: string
  actor: { full_name: string } | null
}

const ACTION_LABELS: Record<string, string> = {
  confirm_payment: 'Confirmou pagamento',
  process_withdrawal: 'Processou saque',
  set_partner_status: 'Alterou status do parceiro',
  set_promotion_status: 'Alterou status da promoção',
  set_subscriber_active: 'Suspendeu/reativou assinante',
}

function summarize(row: Pick<LogRow, 'before' | 'after'>) {
  const parts: string[] = []
  if (row.after) {
    for (const [k, v] of Object.entries(row.after)) parts.push(`${k}: ${JSON.stringify(v)}`)
  }
  return parts.join(' · ') || '—'
}

export default function AdminAuditLog() {
  const [logs, setLogs] = useState<LogRow[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [actionFilter, setActionFilter] = useState('')

  useEffect(() => {
    supabase.from('audit_logs').select('*, actor:actor_id(full_name)').order('created_at', { ascending: false }).limit(300)
      .then(({ data }) => { setLogs((data as LogRow[]) ?? []); setLoading(false) })
  }, [])

  const actions = useMemo(() => Array.from(new Set(logs.map((l) => l.action))), [logs])

  const filtered = useMemo(() => logs.filter((l) => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || l.actor?.full_name?.toLowerCase().includes(q) || l.entity.toLowerCase().includes(q) || l.entity_id.toLowerCase().includes(q)
    const matchesAction = !actionFilter || l.action === actionFilter
    return matchesSearch && matchesAction
  }), [logs, search, actionFilter])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Auditoria</h1>
        <p className="text-white/50 text-sm">Registro de ações administrativas sensíveis — pagamentos, saques, status de parceiros/promoções/assinantes.</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input className="input !pl-9" placeholder="Buscar por responsável, entidade ou ID..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input !w-auto" value={actionFilter} onChange={(e) => setActionFilter(e.target.value)}>
          <option value="">Todas as ações</option>
          {actions.map((a) => <option key={a} value={a}>{ACTION_LABELS[a] ?? a}</option>)}
        </select>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[760px]">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase">
              <th className="pb-3">Quando</th><th className="pb-3">Responsável</th><th className="pb-3">Ação</th><th className="pb-3">Entidade</th><th className="pb-3">Detalhe</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((l) => (
              <tr key={l.id} className="border-t border-ink-800 align-top">
                <td className="py-3 text-white/50 whitespace-nowrap">{formatDateTime(l.created_at)}</td>
                <td className="py-3">{l.actor?.full_name ?? '—'}</td>
                <td className="py-3"><span className="pill bg-gold-400/15 text-gold-300">{ACTION_LABELS[l.action] ?? l.action}</span></td>
                <td className="py-3 text-white/50">
                  {l.entity}
                  <span className="block text-[11px] text-white/25 font-mono">{l.entity_id.slice(0, 8)}</span>
                </td>
                <td className="py-3 text-white/40 text-xs max-w-xs truncate" title={summarize(l)}>{summarize(l)}</td>
              </tr>
            ))}
            {loading && <tr><td colSpan={5}><LoadingState dark label="Carregando auditoria..." className="py-8" /></td></tr>}
            {!loading && !filtered.length && <tr><td colSpan={5}><EmptyState dark icon={History} title="Nenhum registro encontrado" className="py-8" /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
