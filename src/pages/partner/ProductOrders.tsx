import { useEffect, useState, type FormEvent } from 'react'
import { ScanLine, ShoppingBag, Wallet } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useWallet } from '../../hooks/useWallet'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDateTime } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { QrScannerModal } from '../../components/ui/QrScannerModal'

interface OrderRow {
  order_id: string; status: string; code: string; quantity: number; unit_price: number
  total_amount: number; net_amount: number; promotion_title: string
  subscriber_name: string; subscriber_phone: string; deadline: string | null; confirmed_at: string | null; created_at: string
}

export default function PartnerProductOrders() {
  const { partner, profile, refreshProfile } = useAuth()
  const { balance, available, reload: reloadWallet } = useWallet()
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [codeInput, setCodeInput] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [scanningFor, setScanningFor] = useState<string | null>(null)

  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawPixKey, setWithdrawPixKey] = useState(profile?.pix_key ?? '')
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawDone, setWithdrawDone] = useState(false)
  const [withdrawBusy, setWithdrawBusy] = useState(false)

  async function submitWithdraw(e: FormEvent) {
    e.preventDefault()
    setWithdrawError(null)
    const amount = Number(withdrawAmount.replace(',', '.'))
    if (amount > available) return setWithdrawError('Saldo disponível insuficiente para este saque.')
    if (!withdrawPixKey.trim()) return setWithdrawError('Informe uma chave Pix válida.')

    setWithdrawBusy(true)
    if (withdrawPixKey !== profile?.pix_key) {
      await supabase.from('profiles').update({ pix_key: withdrawPixKey }).eq('id', profile!.id)
      await refreshProfile()
    }
    const { error } = await supabase.rpc('request_withdrawal', { p_amount: amount, p_pix_key: withdrawPixKey })
    setWithdrawBusy(false)
    if (error) {
      const map: Record<string, string> = {
        INSUFFICIENT_BALANCE: 'Saldo insuficiente.',
        MONTHLY_LIMIT_EXCEEDED: 'Limite de saques por 30 dias atingido. Tente novamente mais adiante.',
        MINIMUM_WITHDRAWAL_50: 'O valor mínimo para saque é R$ 50,00.',
        ACCOUNT_SUSPENDED: 'Sua conta está suspensa. Fale com o suporte.',
      }
      const code = Object.keys(map).find((k) => error.message.includes(k))
      setWithdrawError(code ? map[code] : 'Não foi possível solicitar o saque.')
      return
    }
    setWithdrawAmount('')
    setWithdrawDone(true)
    await reloadWallet()
    setTimeout(() => setWithdrawDone(false), 4000)
  }

  function load() {
    if (!partner) return
    setLoading(true)
    supabase.rpc('get_partner_product_orders', { p_partner_id: partner.id }).then(({ data }) => {
      setOrders((data as OrderRow[]) ?? [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [partner])

  async function confirm(orderId: string) {
    const code = codeInput[orderId]
    if (!code) return
    setBusy(orderId)
    setErrors((e) => ({ ...e, [orderId]: '' }))
    const { error } = await supabase.rpc('confirm_product_order_delivery', { p_order_id: orderId, p_code: code })
    setBusy(null)
    if (error) {
      const map: Record<string, string> = {
        CODE_MISMATCH: 'Código não confere com o do pedido.',
        OUT_OF_STOCK: 'Sem estoque suficiente para confirmar.',
        ORDER_NOT_READY: 'Esse pedido não está pronto para retirada.',
      }
      setErrors((e) => ({ ...e, [orderId]: map[error.message] ?? 'Não foi possível confirmar.' }))
      return
    }
    load()
  }

  const pending = orders.filter((o) => o.status === 'ready')
  const history = orders.filter((o) => o.status !== 'ready')

  if (loading) return <LoadingState dark label="Carregando pedidos..." />

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Vendas de produtos</h1>
        <p className="text-white/50 text-sm">Confirme a entrega com o código que o assinante apresenta no balcão.</p>
      </div>

      <section className="card space-y-4">
        <p className="font-semibold flex items-center gap-1.5"><Wallet size={16} className="text-gold-400" /> Saldo de vendas</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-white/40">Saldo total</p>
            <p className="text-xl font-bold">{formatBRL(balance)}</p>
          </div>
          <div>
            <p className="text-xs text-white/40">Disponível para saque</p>
            <p className="text-xl font-bold text-emerald-400">{formatBRL(available)}</p>
          </div>
        </div>
        <form onSubmit={submitWithdraw} className="flex flex-wrap gap-2 items-end">
          <div className="flex-1 min-w-[120px]">
            <label className="text-xs text-white/40 block mb-1">Valor</label>
            <input className="input !py-2 text-sm" inputMode="decimal" placeholder="0,00" value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-xs text-white/40 block mb-1">Chave Pix</label>
            <input className="input !py-2 text-sm" value={withdrawPixKey} onChange={(e) => setWithdrawPixKey(e.target.value)} />
          </div>
          <button type="submit" disabled={withdrawBusy || !withdrawAmount} className="btn-gold !py-2 !px-4 text-sm">
            {withdrawBusy ? 'Solicitando...' : 'Solicitar saque'}
          </button>
        </form>
        {withdrawError && <p className="text-xs text-red-400">{withdrawError}</p>}
        {withdrawDone && <p className="text-xs text-emerald-400">Saque solicitado! Fica em análise até ser aprovado e pago.</p>}
      </section>

      <section>
        <p className="font-semibold mb-3">Aguardando retirada ({pending.length})</p>
        {!pending.length && <EmptyState dark icon={ShoppingBag} title="Nenhum pedido aguardando retirada" className="py-8" />}
        <div className="space-y-3">
          {pending.map((o) => (
            <div key={o.order_id} className="card space-y-3">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div>
                  <p className="font-medium text-sm">{o.promotion_title}{o.quantity > 1 && ` ×${o.quantity}`}</p>
                  <p className="text-xs text-white/40">{o.subscriber_name} · {o.subscriber_phone}</p>
                </div>
                <div className="text-right">
                  <p className="font-semibold">{formatBRL(o.total_amount)}</p>
                  <p className="text-[11px] text-white/40">líquido: {formatBRL(o.net_amount)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <input
                  className="input !py-2 text-sm flex-1"
                  placeholder="Código de retirada"
                  value={codeInput[o.order_id] ?? ''}
                  onChange={(e) => setCodeInput((c) => ({ ...c, [o.order_id]: e.target.value.toUpperCase() }))}
                />
                <button onClick={() => setScanningFor(o.order_id)} className="btn-dark !px-3" aria-label="Escanear QR Code"><ScanLine size={16} /></button>
                <button onClick={() => confirm(o.order_id)} disabled={busy === o.order_id} className="btn-gold !px-4 text-sm">
                  {busy === o.order_id ? '...' : 'Confirmar'}
                </button>
              </div>
              {errors[o.order_id] && <p className="text-xs text-red-400">{errors[o.order_id]}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="font-semibold mb-3">Histórico</p>
        {!history.length && <EmptyState dark icon={ShoppingBag} title="Nenhuma venda concluída ainda" className="py-8" />}
        <div className="card !p-0 overflow-x-auto">
          {!!history.length && (
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="text-left text-white/40 text-xs uppercase">
                  <th className="p-3">Assinante</th><th className="p-3">Produto</th><th className="p-3">Valor</th><th className="p-3">Líquido</th><th className="p-3">Status</th><th className="p-3">Data</th>
                </tr>
              </thead>
              <tbody>
                {history.map((o) => (
                  <tr key={o.order_id} className="border-t border-ink-800">
                    <td className="p-3">{o.subscriber_name}</td>
                    <td className="p-3 text-white/50">{o.promotion_title}{o.quantity > 1 && ` ×${o.quantity}`}</td>
                    <td className="p-3">{formatBRL(o.total_amount)}</td>
                    <td className="p-3 text-emerald-400">{formatBRL(o.net_amount)}</td>
                    <td className="p-3 text-white/50">{o.status === 'delivered' ? 'Retirado' : o.status === 'cancelled' ? 'Cancelado' : o.status}</td>
                    <td className="p-3 text-white/40">{formatDateTime(o.confirmed_at ?? o.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </section>

      <QrScannerModal
        open={!!scanningFor}
        onClose={() => setScanningFor(null)}
        onScan={(value) => {
          if (scanningFor) setCodeInput((c) => ({ ...c, [scanningFor]: value.toUpperCase() }))
          setScanningFor(null)
        }}
      />
    </div>
  )
}
