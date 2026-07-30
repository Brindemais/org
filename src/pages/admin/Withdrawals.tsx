import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDateTime } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { WithdrawalStatus } from '../../lib/types'

export default function AdminWithdrawals() {
  const [rows, setRows] = useState<any[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase.from('withdrawals').select('*, user:user_id(full_name, cpf)').order('requested_at', { ascending: false })
    setRows(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function process(id: string, status: WithdrawalStatus) {
    setBusy(id)
    await supabase.rpc('process_withdrawal', { p_withdrawal_id: id, p_new_status: status })
    setBusy(null)
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Saques</h1>
        <p className="text-white/50 text-sm">Análise e pagamento das solicitações de saque via Pix.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase">
              <th className="pb-3">Assinante</th><th className="pb-3">Valor</th><th className="pb-3">Chave Pix</th><th className="pb-3">Status</th><th className="pb-3">Solicitado</th><th className="pb-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((w: any) => (
              <tr key={w.id} className="border-t border-ink-800">
                <td className="py-3">{w.user?.full_name}</td>
                <td className="py-3 font-semibold">{formatBRL(w.amount)}</td>
                <td className="py-3 text-white/50 text-xs">{w.pix_key}</td>
                <td className="py-3"><StatusBadge status={w.status} /></td>
                <td className="py-3 text-white/50">{formatDateTime(w.requested_at)}</td>
                <td className="py-3">
                  {w.status === 'requested' && (
                    <div className="flex gap-1.5">
                      <button onClick={() => process(w.id, 'approved')} disabled={busy === w.id} className="btn-gold !py-1.5 !px-2 text-xs">Aprovar</button>
                      <button onClick={() => process(w.id, 'rejected')} disabled={busy === w.id} className="btn-ghost !py-1.5 !px-2 text-xs">Recusar</button>
                    </div>
                  )}
                  {w.status === 'approved' && (
                    <button onClick={() => process(w.id, 'paid')} disabled={busy === w.id} className="btn-gold !py-1.5 !px-3 text-xs">Marcar como pago</button>
                  )}
                </td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={6} className="py-8 text-center text-white/40">Nenhuma solicitação de saque.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
