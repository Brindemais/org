import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Copy, CreditCard, MapPin, Minus, Percent, Plus, QrCode, ShoppingBag, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner, Promotion } from '../../lib/types'
import { formatBRL, formatDate, maskCardNumber, maskCardExpiry } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'
import { useWallet } from '../../hooks/useWallet'

type CatalogPartner = Pick<Partner, 'id' | 'trade_name' | 'neighborhood' | 'city' | 'logo_url'>
type Method = 'pix' | 'credit_card' | 'wallet'
type CheckoutStep = 'form' | 'pix' | 'done'

export default function SubscriberPartnerProducts() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [partner, setPartner] = useState<CatalogPartner | null>(null)
  const [products, setProducts] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [zoomed, setZoomed] = useState<Promotion | null>(null)

  const [buying, setBuying] = useState<Promotion | null>(null)
  const [qty, setQty] = useState(1)
  const [method, setMethod] = useState<Method>('pix')
  const [step, setStep] = useState<CheckoutStep>('form')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pixCode, setPixCode] = useState('')
  const [pixQrCode, setPixQrCode] = useState('')
  const [copied, setCopied] = useState(false)
  const [cardName, setCardName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardAddressNumber, setCardAddressNumber] = useState('')
  const { available: walletAvailable, reload: reloadWallet } = useWallet()

  function load() {
    if (!id) return
    setLoading(true)
    Promise.all([
      supabase.rpc('list_public_partners').select('id, trade_name, neighborhood, city, logo_url').eq('id', id).maybeSingle(),
      supabase.from('promotions').select('*').eq('partner_id', id).eq('status', 'approved').order('created_at', { ascending: false }),
    ]).then(([{ data: p }, { data: promos }]) => {
      setPartner(p as CatalogPartner | null)
      setProducts((promos as Promotion[]) ?? [])
      setLoading(false)
    })
  }

  useEffect(() => { load() }, [id])

  function startBuy(p: Promotion) {
    setBuying(p)
    setQty(1)
    setMethod('pix')
    setStep('form')
    setError(null)
    setPixCode('')
    setPixQrCode('')
  }

  function closeBuy() {
    setBuying(null)
  }

  async function submitPix() {
    if (!buying) return
    setBusy(true)
    setError(null)
    const { data: payment, error: orderError } = await supabase.rpc('create_product_order', {
      p_promotion_id: buying.id, p_quantity: qty, p_payment_method: 'pix',
    })
    if (orderError || !payment) {
      setBusy(false)
      setError(orderErrorMessage(orderError?.message))
      return
    }
    const { data: charge, error: chargeError } = await supabase.functions.invoke('asaas-create-pix-charge', { body: { payment_id: (payment as any).id } })
    setBusy(false)
    if (chargeError || !charge?.pix_code) {
      setError('Não foi possível gerar o Pix. Tente novamente em instantes.')
      return
    }
    setPixCode(charge.pix_code)
    setPixQrCode(charge.pix_qr_code ?? '')
    setStep('pix')
  }

  async function submitCard() {
    if (!buying) return
    setBusy(true)
    setError(null)
    const { data: payment, error: orderError } = await supabase.rpc('create_product_order', {
      p_promotion_id: buying.id, p_quantity: qty, p_payment_method: 'credit_card',
    })
    if (orderError || !payment) {
      setBusy(false)
      setError(orderErrorMessage(orderError?.message))
      return
    }
    const [expMonth, expYearShort] = cardExpiry.split('/')
    const { data: charge, error: chargeError } = await supabase.functions.invoke('asaas-charge-card', {
      body: {
        payment_id: (payment as any).id,
        holder_name: cardName,
        card_number: cardNumber,
        expiry_month: expMonth,
        expiry_year: expYearShort ? `20${expYearShort}` : '',
        ccv: cardCvv,
        holder_address_number: cardAddressNumber,
      },
    })
    setBusy(false)
    if (chargeError || charge?.error) {
      setError('Cartão recusado. Confira os dados, tente outro cartão ou pague via Pix.')
      return
    }
    setStep('done')
    load()
  }

  async function submitWallet() {
    if (!buying) return
    setBusy(true)
    setError(null)
    const { data: payment, error: orderError } = await supabase.rpc('create_product_order', {
      p_promotion_id: buying.id, p_quantity: qty, p_payment_method: 'wallet',
    })
    setBusy(false)
    if (orderError || !payment) {
      setError(orderErrorMessage(orderError?.message))
      return
    }
    reloadWallet()
    setStep('done')
    load()
  }

  function copyPix() {
    navigator.clipboard.writeText(pixCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function orderErrorMessage(message?: string): string {
    const map: Record<string, string> = {
      OUT_OF_STOCK: 'Sem estoque suficiente para essa quantidade.',
      PRODUCT_HAS_NO_PRICE: 'Esse produto não tem preço configurado.',
      PRODUCT_NOT_FOUND: 'Esse produto não está mais disponível.',
      ACCOUNT_SUSPENDED: 'Sua assinatura precisa estar ativa para comprar.',
      INSUFFICIENT_BALANCE: 'Saldo insuficiente para pagar essa compra. Escolha Pix ou cartão, ou reduza a quantidade.',
    }
    return map[message ?? ''] ?? 'Não foi possível iniciar a compra. Tente novamente.'
  }

  if (loading) return <LoadingState dark label="Carregando catálogo..." />
  if (!partner) return <EmptyState dark icon={Percent} title="Parceiro não encontrado" />

  const total = buying ? (buying.subscriber_price ?? 0) * qty : 0

  return (
    <div className="space-y-4">
      <Link to="/app/produtos" className="text-xs text-white/40 flex items-center gap-1 w-fit"><ChevronLeft size={14} /> Produtos e descontos</Link>

      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-14 h-14 rounded-full bg-gold-gradient p-[1.5px] shrink-0">
            <div className="w-full h-full rounded-full bg-ink-800 flex items-center justify-center font-display text-gold-400 font-semibold overflow-hidden">
              {partner.logo_url ? <img src={partner.logo_url} alt="" className="w-full h-full object-cover" /> : partner.trade_name.slice(0, 2).toUpperCase()}
            </div>
          </div>
          <div className="min-w-0">
            <h1 className="font-display text-lg font-semibold truncate">{partner.trade_name}</h1>
            <p className="text-xs text-white/40 flex items-center gap-1"><MapPin size={11} /> {partner.neighborhood ?? partner.city}</p>
          </div>
        </div>
        <Link to="/app/produtos/compras" className="btn-dark !px-3 !py-2 text-xs gap-1.5 shrink-0"><ShoppingBag size={14} /> Minhas compras</Link>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <div key={p.id} className="card !p-3 text-left">
            <button type="button" onClick={() => p.image_url && setZoomed(p)} className="block w-full">
              <div className="aspect-[4/3] rounded-lg bg-ink-950 border border-ink-800 mb-2 overflow-hidden flex items-center justify-center">
                {p.image_url ? <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" /> : <Percent size={22} className="text-white/15" />}
              </div>
            </button>
            <p className="text-sm font-medium truncate">{p.title}</p>
            <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
              {!!p.normal_price && <span className="text-xs line-through text-white/30">{formatBRL(p.normal_price)}</span>}
              {!!p.subscriber_price && <span className="text-sm text-gold-400 font-bold">{formatBRL(p.subscriber_price)}</span>}
              {!p.normal_price && !p.subscriber_price && !!p.discount_pct && <span className="text-sm text-gold-400 font-bold">{p.discount_pct}% OFF</span>}
            </div>
            <p className="text-[11px] mt-1">
              <span className={`font-semibold ${!p.quantity ? 'text-red-400' : p.quantity <= 5 ? 'text-gold-300' : 'text-emerald-400'}`}>
                {!p.quantity ? 'Sem estoque' : p.quantity <= 5 ? `Só ${p.quantity} em estoque` : `${p.quantity} em estoque`}
              </span>
            </p>
            <p className="text-[10px] text-white/30 mt-0.5">Válido até {formatDate(p.valid_until)}</p>
            {!!p.subscriber_price && (
              <button
                type="button"
                disabled={!p.quantity}
                onClick={() => startBuy(p)}
                className="btn-gold w-full !py-1.5 text-xs mt-2 disabled:opacity-40"
              >
                Comprar
              </button>
            )}
          </div>
        ))}
        {!products.length && (
          <div className="col-span-2">
            <EmptyState dark icon={Percent} title="Sem produtos no momento" description="Esse parceiro ainda não publicou produtos com desconto." />
          </div>
        )}
      </div>

      <Modal open={!!zoomed} onClose={() => setZoomed(null)} className="!max-w-sm">
        {zoomed?.image_url && (
          <div className="space-y-3">
            <img src={zoomed.image_url} alt={zoomed.title} className="w-full rounded-xl object-cover" />
            <p className="font-semibold text-center text-ink-950">{zoomed.title}</p>
          </div>
        )}
      </Modal>

      <Modal open={!!buying} onClose={closeBuy} className="!max-w-sm">
        {buying && step === 'form' && (
          <div className="space-y-4 text-ink-950">
            <p className="font-semibold">{buying.title}</p>
            <div className="flex items-center justify-between">
              <span className="text-sm text-black/50">Quantidade</span>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="w-8 h-8 rounded-full border border-black/15 flex items-center justify-center"><Minus size={14} /></button>
                <span className="w-6 text-center font-semibold">{qty}</span>
                <button type="button" onClick={() => setQty((q) => Math.min(buying.quantity, q + 1))} className="w-8 h-8 rounded-full border border-black/15 flex items-center justify-center"><Plus size={14} /></button>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-black/10 pt-3">
              <span className="text-sm text-black/50">Total</span>
              <span className="font-bold text-lg">{formatBRL(total)}</span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button type="button" onClick={() => setMethod('pix')} className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium border transition ${method === 'pix' ? 'border-gold-400 bg-gold-400/10 text-gold-700' : 'border-black/10 text-black/50'}`}>
                <QrCode size={15} /> Pix
              </button>
              <button type="button" onClick={() => setMethod('credit_card')} className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium border transition ${method === 'credit_card' ? 'border-gold-400 bg-gold-400/10 text-gold-700' : 'border-black/10 text-black/50'}`}>
                <CreditCard size={15} /> Cartão
              </button>
              <button type="button" onClick={() => setMethod('wallet')} className={`flex flex-col items-center justify-center gap-1 rounded-lg py-2 text-xs font-medium border transition ${method === 'wallet' ? 'border-gold-400 bg-gold-400/10 text-gold-700' : 'border-black/10 text-black/50'}`}>
                <Wallet size={15} /> Saldo
              </button>
            </div>

            {method === 'pix' && (
              <>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button onClick={submitPix} disabled={busy} className="btn-gold w-full">{busy ? 'Gerando Pix...' : 'Pagar via Pix'}</button>
              </>
            )}

            {method === 'credit_card' && (
              <div className="space-y-3">
                <input className="input-light" placeholder="Nome no cartão" value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} />
                <input className="input-light" placeholder="Número do cartão" inputMode="numeric" value={maskCardNumber(cardNumber)} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))} />
                <div className="grid grid-cols-3 gap-2">
                  <input className="input-light" placeholder="MM/AA" inputMode="numeric" value={cardExpiry} onChange={(e) => setCardExpiry(maskCardExpiry(e.target.value))} />
                  <input className="input-light" placeholder="CVV" inputMode="numeric" maxLength={4} value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} />
                  <input className="input-light" placeholder="Nº endereço" inputMode="numeric" value={cardAddressNumber} onChange={(e) => setCardAddressNumber(e.target.value.replace(/\D/g, ''))} />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button onClick={submitCard} disabled={busy} className="btn-gold w-full">{busy ? 'Processando...' : `Pagar ${formatBRL(total)} no cartão`}</button>
              </div>
            )}

            {method === 'wallet' && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm border-t border-black/10 pt-3">
                  <span className="text-black/50">Saldo disponível</span>
                  <span className="font-semibold">{formatBRL(walletAvailable)}</span>
                </div>
                {walletAvailable < total && (
                  <p className="text-sm text-red-500">Saldo insuficiente para essa compra. Escolha Pix ou cartão, ou reduza a quantidade.</p>
                )}
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button onClick={submitWallet} disabled={busy || walletAvailable < total} className="btn-gold w-full disabled:opacity-40">
                  {busy ? 'Processando...' : `Pagar ${formatBRL(total)} com saldo`}
                </button>
              </div>
            )}
          </div>
        )}

        {buying && step === 'pix' && (
          <div className="space-y-4 text-center text-ink-950">
            <p className="font-semibold">Pagamento via Pix</p>
            <div className="w-40 h-40 mx-auto rounded-xl bg-white border border-black/10 p-3 flex items-center justify-center overflow-hidden">
              {pixQrCode ? <img src={`data:image/png;base64,${pixQrCode}`} alt="QR Code Pix" className="w-full h-full object-contain" /> : null}
            </div>
            <p className="text-sm text-black/50">Escaneie ou copie o código Pix para pagar {formatBRL(total)}.</p>
            <button onClick={copyPix} className="btn-dark-light w-full !py-2.5 text-sm gap-2"><Copy size={14} /> {copied ? 'Copiado!' : 'Copiar código Pix'}</button>
            <p className="text-xs text-black/40">A confirmação é automática. Acompanhe o andamento do pedido em "Minhas compras" — o código de retirada aparece depois que o parceiro confirmar o pedido.</p>
            <button onClick={() => { closeBuy(); navigate('/app/produtos/compras') }} className="btn-gold w-full">Ver minhas compras</button>
          </div>
        )}

        {buying && step === 'done' && (
          <div className="space-y-4 text-center text-ink-950">
            <p className="font-semibold">Pagamento aprovado!</p>
            <p className="text-sm text-black/50">Acompanhe o andamento em "Minhas compras" — o código de retirada aparece depois que o parceiro confirmar o pedido.</p>
            <button onClick={() => { closeBuy(); navigate('/app/produtos/compras') }} className="btn-gold w-full">Ver minhas compras</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
