import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowDownLeft, ArrowUpRight, History, PackageCheck, ScanLine, Search, ShoppingBag, Wallet, Gift } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useWallet } from '../../hooks/useWallet'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDateTime } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { QrScannerModal } from '../../components/ui/QrScannerModal'

// Mesmos tipos de wallet_transactions do extrato do assinante
// (src/pages/subscriber/Wallet.tsx), só que com rótulo no contexto do
// parceiro — 'purchase' aqui é venda de produto recebida, não compra.
const TYPE_LABELS: Record<string, string> = {
  purchase: 'Venda de produto',
  bonus_subscription: 'Bonificação de indicação de assinante',
  bonus_partner_fee: 'Bonificação de indicação de parceiro',
  bonus_consumption: 'Bonificação de produtos',
  cashback: 'Cashback',
  withdrawal: 'Saque',
  adjustment: 'Ajuste administrativo',
  reversal: 'Estorno',
}

const EXTRATO_PREVIEW_COUNT = 8

interface OrderRow {
  order_id: string; status: string; code: string; quantity: number; unit_price: number
  total_amount: number; net_amount: number; promotion_title: string
  subscriber_name: string; subscriber_phone: string; deadline: string | null
  accepted_at: string | null; confirmed_at: string | null; created_at: string
}

// Acompanhamento estilo "iFood": pedido pago chega como 'ready' (precisa
// o parceiro confirmar que recebeu), só depois de 'accepted' é que entra
// o código/QR pra finalizar a entrega.
export default function PartnerProductOrders() {
  const { partner, profile, refreshProfile } = useAuth()
  const { balance, transactions, loading: walletLoading, reload: reloadWallet } = useWallet()
  const [bonusAvailable, setBonusAvailable] = useState(0)
  const [showAllExtrato, setShowAllExtrato] = useState(false)
  const [orders, setOrders] = useState<OrderRow[]>([])
  const [loading, setLoading] = useState(true)
  const [codeInput, setCodeInput] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [scanningFor, setScanningFor] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [dateFilter, setDateFilter] = useState('')

  const [withdrawAmount, setWithdrawAmount] = useState('')
  const [withdrawPixKey, setWithdrawPixKey] = useState(profile?.pix_key ?? '')
  const [withdrawError, setWithdrawError] = useState<string | null>(null)
  const [withdrawDone, setWithdrawDone] = useState(false)
  const [withdrawBusy, setWithdrawBusy] = useState(false)

  function loadBonusAvailable() {
    if (!profile) return
    supabase.rpc('available_bonus_balance', { p_user_id: profile.id }).then(({ data }) => {
      setBonusAvailable(Number(data ?? 0))
    })
  }

  useEffect(() => { loadBonusAvailable() }, [profile])

  async function submitWithdraw(e: FormEvent) {
    e.preventDefault()
    setWithdrawError(null)
    const amount = Number(withdrawAmount.replace(',', '.'))
    if (amount > bonusAvailable) return setWithdrawError('Saldo de bônus disponível insuficiente para este saque.')
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
    loadBonusAvailable()
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

  async function accept(orderId: string) {
    setBusy(orderId)
    setErrors((e) => ({ ...e, [orderId]: '' }))
    const { error } = await supabase.rpc('accept_product_order', { p_order_id: orderId })
    setBusy(null)
    if (error) {
      setErrors((e) => ({ ...e, [orderId]: 'Não foi possível confirmar o pedido.' }))
      return
    }
    load()
  }

  async function confirmDelivery(orderId: string) {
    const code = codeInput[orderId]
    if (!code) return
    setBusy(orderId)
    setErrors((e) => ({ ...e, [orderId]: '' }))
    const { error } = await supabase.rpc('confirm_product_order_delivery', { p_order_id: orderId, p_code: code })
    setBusy(null)
    if (error) {
      const map: Record<string, string> = {
        CODE_MISMATCH: 'Código não confere com o do pedido.',
        ORDER_NOT_ACCEPTED: 'Confirme o pedido antes de finalizar a entrega.',
      }
      setErrors((e) => ({ ...e, [orderId]: map[error.message] ?? 'Não foi possível confirmar.' }))
      return
    }
    load()
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return orders.filter((o) => {
      const matchesSearch = !q || o.subscriber_name.toLowerCase().includes(q) || o.promotion_title.toLowerCase().includes(q)
      const matchesDate = !dateFilter || o.created_at.slice(0, 10) === dateFilter
      return matchesSearch && matchesDate
    })
  }, [orders, search, dateFilter])

  const incoming = filtered.filter((o) => o.status === 'ready')
  const awaitingPickup = filtered.filter((o) => o.status === 'accepted')
  const history = filtered.filter((o) => o.status !== 'ready' && o.status !== 'accepted')

  if (loading) return <LoadingState dark label="Carregando pedidos..." />

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Vendas de produtos</h1>
        <p className="text-white/50 text-sm">Confirme que recebeu o pedido e, na retirada, confira o código do assinante.</p>
      </div>

      <section className="card space-y-3">
        <p className="font-semibold flex items-center gap-1.5"><Wallet size={16} className="text-gold-400" /> Repasse de vendas</p>
        {partner?.asaas_wallet_id ? (
          <p className="text-sm text-white/60">
            Repasse automático ativo — o valor líquido de cada venda já cai direto na sua conta Asaas, sem passar pela
            Brinde Mais. Pra sacar, acesse sua conta Asaas diretamente.
          </p>
        ) : (
          <p className="text-sm text-white/60">
            O repasse das vendas é feito direto na sua conta Asaas (split automático), não pela Brinde Mais. Vincule e
            aguarde a aprovação da sua subconta em "Produtos e descontos" pra poder vender produtos com preço — depois
            disso, o dinheiro de cada venda já cai direto na sua Asaas.
          </p>
        )}
      </section>

      <section className="card space-y-4">
        <p className="font-semibold flex items-center gap-1.5"><Gift size={16} className="text-gold-400" /> Bônus de indicação</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="text-xs text-white/40">Saldo total</p>
            <p className="text-xl font-bold">{formatBRL(balance)}</p>
          </div>
          <div>
            <p className="text-xs text-white/40">Disponível para saque</p>
            <p className="text-xl font-bold text-emerald-400">{formatBRL(bonusAvailable)}</p>
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
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold flex items-center gap-1.5"><History size={16} className="text-gold-400" /> Extrato</p>
          {transactions.length > EXTRATO_PREVIEW_COUNT && (
            <button onClick={() => setShowAllExtrato(!showAllExtrato)} className="text-xs text-gold-400 font-medium">
              {showAllExtrato ? 'Ver menos' : 'Ver todos'}
            </button>
          )}
        </div>
        {walletLoading && <LoadingState dark label="Carregando extrato..." />}
        <div className="space-y-2">
          {(showAllExtrato ? transactions : transactions.slice(0, EXTRATO_PREVIEW_COUNT)).map((t) => (
            <div key={t.id} className="card !py-3 flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.direction === 'in' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                {t.direction === 'in' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{t.description || TYPE_LABELS[t.type] || t.type}</p>
                <p className="text-xs text-white/40">{formatDateTime(t.created_at)}</p>
              </div>
              <p className={`text-sm font-semibold shrink-0 ${t.direction === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                {t.direction === 'in' ? '+' : '-'} {formatBRL(t.amount)}
              </p>
            </div>
          ))}
          {!walletLoading && !transactions.length && (
            <EmptyState dark icon={History} title="Nenhuma movimentação ainda" description="Vendas de produtos e bonificações aparecem aqui." className="py-8" />
          )}
        </div>
      </section>

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input className="input !pl-9" placeholder="Buscar por assinante ou produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <input className="input !w-auto" type="date" value={dateFilter} onChange={(e) => setDateFilter(e.target.value)} />
      </div>

      <section>
        <p className="font-semibold mb-3">Novos pedidos ({incoming.length})</p>
        {!incoming.length && <EmptyState dark icon={ShoppingBag} title="Nenhum pedido novo" className="py-8" />}
        <div className="space-y-3">
          {incoming.map((o) => (
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
              <button onClick={() => accept(o.order_id)} disabled={busy === o.order_id} className="btn-gold w-full !py-2 text-sm">
                {busy === o.order_id ? 'Confirmando...' : 'Confirmar pedido recebido'}
              </button>
              {errors[o.order_id] && <p className="text-xs text-red-400">{errors[o.order_id]}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="font-semibold mb-3">Pedidos em andamento ({awaitingPickup.length})</p>
        {!awaitingPickup.length && <EmptyState dark icon={PackageCheck} title="Nenhum pedido em andamento" className="py-8" />}
        <div className="space-y-3">
          {awaitingPickup.map((o) => (
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
                <button onClick={() => confirmDelivery(o.order_id)} disabled={busy === o.order_id} className="btn-gold !px-4 text-sm">
                  {busy === o.order_id ? '...' : 'Confirmar'}
                </button>
              </div>
              {errors[o.order_id] && <p className="text-xs text-red-400">{errors[o.order_id]}</p>}
            </div>
          ))}
        </div>
      </section>

      <section>
        <p className="font-semibold mb-3">Pedidos finalizados</p>
        {!history.length && <EmptyState dark icon={ShoppingBag} title="Nenhuma venda concluída ainda" className="py-8" />}
        <div className="card !p-0 overflow-x-auto">
          {!!history.length && (
            <table className="w-full text-sm min-w-[800px]">
              <thead>
                <tr className="text-left text-white/40 text-xs uppercase">
                  <th className="p-3">Assinante</th><th className="p-3">Produto</th><th className="p-3">Valor</th><th className="p-3">Líquido</th><th className="p-3">Status</th><th className="p-3">Pedido em</th><th className="p-3">Finalizado em</th>
                </tr>
              </thead>
              <tbody>
                {history.map((o) => (
                  <tr key={o.order_id} className="border-t border-ink-800">
                    <td className="p-3">{o.subscriber_name}</td>
                    <td className="p-3 text-white/50">{o.promotion_title}{o.quantity > 1 && ` ×${o.quantity}`}</td>
                    <td className="p-3">{formatBRL(o.total_amount)}</td>
                    <td className="p-3 text-emerald-400">{formatBRL(o.net_amount)}</td>
                    <td className="p-3 text-white/50">{o.status === 'delivered' ? 'Concluído' : o.status === 'cancelled' ? 'Cancelado' : o.status}</td>
                    <td className="p-3 text-white/40">{formatDateTime(o.created_at)}</td>
                    <td className="p-3 text-white/40">{o.confirmed_at ? formatDateTime(o.confirmed_at) : '—'}</td>
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
