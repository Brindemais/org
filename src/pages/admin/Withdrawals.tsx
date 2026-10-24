import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Landmark, ShieldAlert } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDateTime } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import type { WithdrawalStatus } from '../../lib/types'

interface PayoutRow {
  partner_id: string
  profile_id: string
  trade_name: string
  full_name: string
  pix_key: string | null
  amount: number
}

interface PayoutResult {
  partner_id: string
  trade_name: string
  amount: number
  ok: boolean
  detail?: string
  transfer_id?: string
}

interface AuditRow {
  order_id: string
  created_at: string
  promotion_title: string
  subscriber_name: string
  partner_trade_name: string
  status: string
  total_amount: number
  net_amount: number
  split_applied: boolean
  subscriber_debit: number
  partner_credit: number
  issue: string | null
}

export default function AdminWithdrawals() {
  const [rows, setRows] = useState<any[]>([])
  const [busy, setBusy] = useState<string | null>(null)

  const [preview, setPreview] = useState<{ eligible: PayoutRow[]; skipped: (PayoutRow & { reason: string })[]; total: number } | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [paying, setPaying] = useState(false)
  const [payoutResults, setPayoutResults] = useState<PayoutResult[] | null>(null)
  const [payoutError, setPayoutError] = useState('')

  const [audit, setAudit] = useState<AuditRow[]>([])
  const [auditLoading, setAuditLoading] = useState(true)
  const [onlyIssues, setOnlyIssues] = useState(true)

  async function load() {
    const { data } = await supabase.from('withdrawals').select('*, user:user_id(full_name, cpf)').order('requested_at', { ascending: false })
    setRows(data ?? [])
  }

  async function loadAudit() {
    setAuditLoading(true)
    const { data } = await supabase.rpc('admin_audit_wallet_payments')
    setAudit((data as AuditRow[]) ?? [])
    setAuditLoading(false)
  }

  useEffect(() => { load(); loadAudit() }, [])

  async function process(id: string, status: WithdrawalStatus) {
    setBusy(id)
    await supabase.rpc('process_withdrawal', { p_withdrawal_id: id, p_new_status: status })
    setBusy(null)
    load()
  }

  async function loadPreview() {
    setPreviewing(true)
    setPayoutError('')
    setPayoutResults(null)
    const { data, error } = await supabase.functions.invoke('admin-payout-partners', { body: { confirm: false } })
    setPreviewing(false)
    if (error || data?.error) { setPayoutError('Não foi possível carregar o preview do repasse.'); return }
    setPreview(data)
  }

  async function confirmPayout() {
    if (!preview || !preview.eligible.length) return
    if (!confirm(`Confirma o envio de ${formatBRL(preview.total)} via Pix para ${preview.eligible.length} comerciante(s)? Essa ação transfere dinheiro real e não pode ser desfeita.`)) return
    setPaying(true)
    setPayoutError('')
    const { data, error } = await supabase.functions.invoke('admin-payout-partners', { body: { confirm: true } })
    setPaying(false)
    if (error || data?.error) { setPayoutError('Falha ao executar o repasse. Nenhuma transferência confirmada foi perdida — confira os resultados parciais abaixo, se houver.'); return }
    setPayoutResults(data.results ?? [])
    setPreview(null)
    load()
    loadAudit()
  }

  const visibleAudit = onlyIssues ? audit.filter((a) => a.issue) : audit

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Saques e repasses</h1>
        <p className="text-white/50 text-sm">Análise e pagamento de saques via Pix, repasse semanal para comerciantes e auditoria de pagamentos com saldo.</p>
      </div>

      {/* Repasse semanal para comerciantes */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <p className="font-semibold">Repasse semanal para comerciantes</p>
          <button onClick={loadPreview} disabled={previewing} className="btn-dark !py-2 !px-4 text-xs">
            {previewing ? 'Carregando...' : 'Verificar valores devidos'}
          </button>
        </div>
        <p className="text-xs text-white/40 mb-4">
          Toda segunda-feira, revise e confirme aqui o repasse do saldo disponível de cada comerciante. Ao confirmar, o sistema transfere
          via Pix real (conta Asaas da Brinde Mais) o valor devido para a chave Pix cadastrada de cada um.
        </p>

        {payoutError && (
          <div className="rounded-lg bg-red-500/10 border border-red-500/30 text-red-300 text-xs p-3 mb-4 flex items-start gap-2">
            <AlertTriangle size={14} className="shrink-0 mt-0.5" /> {payoutError}
          </div>
        )}

        {preview && (
          <div className="rounded-lg bg-ink-950 border border-ink-800 p-4 space-y-3 mb-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold">Pronto para pagar: {preview.eligible.length} comerciante(s) · {formatBRL(preview.total)}</p>
              <button onClick={confirmPayout} disabled={paying || !preview.eligible.length} className="btn-gold !py-2 !px-4 text-xs">
                {paying ? 'Enviando Pix...' : 'Confirmar e transferir agora'}
              </button>
            </div>
            <div className="divide-y divide-ink-800">
              {preview.eligible.map((p) => (
                <div key={p.partner_id} className="flex items-center justify-between text-xs py-2">
                  <div>
                    <p className="font-medium text-sm">{p.trade_name}</p>
                    <p className="text-white/40">{p.full_name} · Pix: {p.pix_key}</p>
                  </div>
                  <p className="font-semibold text-gold-400">{formatBRL(p.amount)}</p>
                </div>
              ))}
              {!preview.eligible.length && <p className="text-xs text-white/30 py-2">Nenhum comerciante com saldo disponível e chave Pix cadastrada.</p>}
            </div>
            {preview.skipped.length > 0 && (
              <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs p-3">
                <p className="font-medium mb-1 flex items-center gap-1.5"><ShieldAlert size={13} /> {preview.skipped.length} comerciante(s) com saldo mas sem chave Pix cadastrada — não serão pagos agora:</p>
                <ul className="space-y-0.5">
                  {preview.skipped.map((p) => (
                    <li key={p.partner_id}>{p.trade_name} — {formatBRL(p.amount)}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {payoutResults && (
          <div className="rounded-lg bg-ink-950 border border-ink-800 p-4 space-y-2">
            <p className="text-sm font-semibold mb-1">Resultado do repasse</p>
            {payoutResults.map((r) => (
              <div key={r.partner_id} className="flex items-center justify-between text-xs py-1.5 border-t border-ink-800 first:border-t-0">
                <span className="flex items-center gap-1.5">
                  {r.ok ? <CheckCircle2 size={13} className="text-emerald-400" /> : <AlertTriangle size={13} className="text-red-400" />}
                  {r.trade_name}
                </span>
                <span className={r.ok ? 'text-emerald-400 font-semibold' : 'text-red-400'}>
                  {r.ok ? formatBRL(r.amount) : `Falhou: ${r.detail}`}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auditoria de pagamentos com saldo */}
      <div className="card">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-1">
          <p className="font-semibold">Auditoria de pagamentos com saldo</p>
          <label className="flex items-center gap-2 text-xs text-white/50">
            <input type="checkbox" checked={onlyIssues} onChange={(e) => setOnlyIssues(e.target.checked)} />
            Mostrar só pedidos com inconsistência
          </label>
        </div>
        <p className="text-xs text-white/40 mb-4">
          Confere, pedido a pedido, se o débito do assinante e o crédito do comerciante batem com o valor esperado da compra paga com saldo.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase">
                <th className="pb-3">Data</th><th className="pb-3">Produto</th><th className="pb-3">Assinante</th><th className="pb-3">Comerciante</th>
                <th className="pb-3">Status</th><th className="pb-3">Débito</th><th className="pb-3">Crédito</th><th className="pb-3">Inconsistência</th>
              </tr>
            </thead>
            <tbody>
              {visibleAudit.map((a) => (
                <tr key={a.order_id} className={`border-t border-ink-800 ${a.issue ? 'bg-red-500/5' : ''}`}>
                  <td className="py-3 text-white/50 whitespace-nowrap">{formatDateTime(a.created_at)}</td>
                  <td className="py-3">{a.promotion_title}</td>
                  <td className="py-3">{a.subscriber_name}</td>
                  <td className="py-3">{a.partner_trade_name}</td>
                  <td className="py-3"><StatusBadge status={a.status} /></td>
                  <td className="py-3">{formatBRL(a.subscriber_debit)}</td>
                  <td className="py-3">{formatBRL(a.partner_credit)}</td>
                  <td className="py-3 text-xs">
                    {a.issue ? <span className="text-red-400 flex items-center gap-1"><AlertTriangle size={12} className="shrink-0" /> {a.issue}</span> : <span className="text-emerald-400">OK</span>}
                  </td>
                </tr>
              ))}
              {!auditLoading && !visibleAudit.length && (
                <tr><td colSpan={8}><EmptyState dark icon={CheckCircle2} title={onlyIssues ? 'Nenhuma inconsistência encontrada' : 'Nenhum pagamento com saldo ainda'} className="py-8" /></td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Saques manuais */}
      <div className="card overflow-x-auto">
        <p className="font-semibold mb-4">Solicitações de saque</p>
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
            {!rows.length && <tr><td colSpan={6}><EmptyState dark icon={Landmark} title="Nenhuma solicitação de saque" className="py-8" /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
