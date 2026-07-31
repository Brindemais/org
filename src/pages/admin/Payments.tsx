import { useEffect, useState } from 'react'
import { Download, Receipt } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDateTime } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { downloadCSV } from '../../lib/csv'

export default function AdminPayments() {
  const [payments, setPayments] = useState<any[]>([])
  const [filter, setFilter] = useState<'pending' | 'all'>('pending')
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    let query = supabase.from('payments').select('*, subscriber:subscriber_id(full_name, cpf)').order('created_at', { ascending: false }).limit(100)
    if (filter === 'pending') query = query.eq('status', 'pending')
    const { data } = await query
    setPayments(data ?? [])
  }

  useEffect(() => { load() }, [filter])

  async function confirm(id: string) {
    setBusy(id)
    await supabase.rpc('confirm_payment', { p_payment_id: id })
    setBusy(null)
    load()
  }

  function exportCSV() {
    downloadCSV(
      `pagamentos-brinde-mais-${new Date().toISOString().slice(0, 10)}.csv`,
      payments.map((p) => ({
        assinante: p.subscriber?.full_name ?? '', referencia: p.external_reference,
        tipo: p.type === 'subscription' ? 'assinatura' : 'loja', valor: Number(p.amount).toFixed(2),
        status: p.status, criado_em: p.created_at, confirmado_em: p.confirmed_at ?? '',
      })),
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Pagamentos Pix</h1>
          <p className="text-white/50 text-sm">Confirmação manual da plataforma de pagamentos (MVP piloto).</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setFilter('pending')} className={`pill ${filter === 'pending' ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-900 text-white/50'}`}>Pendentes</button>
          <button onClick={() => setFilter('all')} className={`pill ${filter === 'all' ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-900 text-white/50'}`}>Todos</button>
          <button onClick={exportCSV} className="btn-dark !px-3 !py-2 text-xs gap-1.5 shrink-0"><Download size={14} /> Exportar CSV</button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase">
              <th className="pb-3">Assinante</th><th className="pb-3">Tipo</th><th className="pb-3">Valor</th><th className="pb-3">Status</th><th className="pb-3">Data</th><th className="pb-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {payments.map((p) => (
              <tr key={p.id} className="border-t border-ink-800">
                <td className="py-3">
                  <p>{p.subscriber?.full_name}</p>
                  <p className="text-xs text-white/30 font-mono">{p.external_reference.slice(0, 12)}</p>
                </td>
                <td className="py-3 text-white/50">{p.type === 'subscription' ? 'Assinatura' : 'Loja'}</td>
                <td className="py-3 font-semibold">{formatBRL(p.amount)}</td>
                <td className="py-3"><StatusBadge status={p.status} /></td>
                <td className="py-3 text-white/50">{formatDateTime(p.created_at)}</td>
                <td className="py-3">
                  {p.status === 'pending' ? (
                    <button onClick={() => confirm(p.id)} disabled={busy === p.id} className="btn-gold !py-1.5 !px-3 text-xs">
                      {busy === p.id ? '...' : 'Confirmar pagamento'}
                    </button>
                  ) : (
                    <span className="text-white/30 text-xs">-</span>
                  )}
                </td>
              </tr>
            ))}
            {!payments.length && <tr><td colSpan={6}><EmptyState dark icon={Receipt} title="Nenhum pagamento encontrado" className="py-8" /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
