import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Copy, CreditCard, MapPin, Minus, Percent, Plus, QrCode, ShoppingBag, ShoppingCart, Trash2, Wallet } from 'lucide-react'
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
interface CartItem { promotion: Promotion; qty: number }

export default function SubscriberPartnerProducts() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [partner, setPartner] = useState<CatalogPartner | null>(null)
  const [products, setProducts] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [zoomed, setZoomed] = useState<Promotion | null>(null)

  // Carrinho: vários produtos do mesmo parceiro, pagos juntos num único
  // checkout (um product_orders por item, um payments compartilhado).
  const [cart, setCart] = useState<CartItem[]>([])
  const [cartOpen, setCartOpen] = useState(false)
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

  function addToCart(p: Promotion) {
    setCart((c) => {
      const existing = c.find((i) => i.promotion.id === p.id)
      if (existing) {
        if (existing.qty >= p.quantity) return c
        return c.map((i) => (i.promotion.id === p.id ? { ...i, qty: i.qty + 1 } : i))
      }
      return [...c, { promotion: p, qty: 1 }]
    })
  }

  function incItem(promoId: string) {
    setCart((c) => c.map((i) => (i.promotion.id === promoId && i.qty < i.promotion.quantity ? { ...i, qty: i.qty + 1 } : i)))
  }

  function decItem(promoId: string) {
    setCart((c) => c.flatMap((i) => {
      if (i.promotion.id !== promoId) return [i]
      if (i.qty <= 1) return []
      return [{ ...i, qty: i.qty - 1 }]
    }))
  }

  function removeItem(promoId: string) {
    setCart((c) => c.filter((i) => i.promotion.id !== promoId))
  }

  function openCart() {
    setMethod('pix')
    setStep('form')
    setError(null)
    setPixCode('')
    setPixQrCode('')
    setCartOpen(true)
  }

  function closeCart() {
    setCartOpen(false)
  }

  async function submitPix() {
    if (!cart.length) return
    setBusy(true)
    setError(null)
    const items = cart.map((i) => ({ promotion_id: i.promotion.id, quantity: i.qty }))
    const { data: payment, error: orderError } = await supabase.rpc('create_product_order_cart', {
      p_items: items, p_payment_method: 'pix',
    })
    if (orderError || !payment) {
      setBusy(false)
      setError(orderErrorMessage(orderError?.message))
      return
    }
    setCart([])
    const { data: charge, error: chargeError } = await supabase.functions.invoke('asaas-create-pix-charge', { body: { payment_id: (payment as any).id } })
    setBusy(false)
    if (chargeError || !charge?.pix_code) {
      setError(charge?.error === 'MISSING_CPF' ? 'Complete seu CPF em Perfil antes de continuar o pagamento.' : 'Não foi possível gerar o Pix. Tente novamente em instantes.')
      return
    }
    setPixCode(charge.pix_code)
    setPixQrCode(charge.pix_qr_code ?? '')
    setStep('pix')
    load()
  }

  async function submitCard() {
    if (!cart.length) return
    setBusy(true)
    setError(null)
    const items = cart.map((i) => ({ promotion_id: i.promotion.id, quantity: i.qty }))
    const { data: payment, error: orderError } = await supabase.rpc('create_product_order_cart', {
      p_items: items, p_payment_method: 'credit_card',
    })
    if (orderError || !payment) {
      setBusy(false)
      setError(orderErrorMessage(orderError?.message))
      return
    }
    setCart([])
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
      setError(charge?.error === 'MISSING_CPF' ? 'Complete seu CPF em Perfil antes de continuar o pagamento.' : 'Cartão recusado. Confira os dados, tente outro cartão ou pague via Pix.')
      return
    }
    setStep('done')
    load()
  }

  async function submitWallet() {
    if (!cart.length) return
    setBusy(true)
    setError(null)
    const items = cart.map((i) => ({ promotion_id: i.promotion.id, quantity: i.qty }))
    const { data: payment, error: orderError } = await supabase.rpc('create_product_order_cart', {
      p_items: items, p_payment_method: 'wallet',
    })
    setBusy(false)
    if (orderError || !payment) {
      setError(orderErrorMessage(orderError?.message))
      return
    }
    setCart([])
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
      PRODUCT_NOT_FOUND: 'Um dos produtos do carrinho não está mais disponível.',
      ACCOUNT_SUSPENDED: 'Sua assinatura precisa estar ativa para comprar.',
      INSUFFICIENT_BALANCE: 'Saldo insuficiente para pagar essa compra. Escolha Pix ou cartão, ou reduza a quantidade.',
      PARTNER_MISMATCH: 'O carrinho só pode ter produtos do mesmo parceiro.',
      EMPTY_CART: 'Adicione pelo menos um produto ao carrinho.',
    }
    return map[message ?? ''] ?? 'Não foi possível iniciar a compra. Tente novamente.'
  }

  if (loading) return <LoadingState dark label="Carregando catálogo..." />
  if (!partner) return <EmptyState dark icon={Percent} title="Parceiro não encontrado" />

  const cartTotal = cart.reduce((s, i) => s + (i.promotion.subscriber_price ?? 0) * i.qty, 0)
  const cartCount = cart.reduce((s, i) => s + i.qty, 0)

  return (
    <div className="space-y-4 pb-20">
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
        {products.map((p) => {
          const inCart = cart.find((i) => i.promotion.id === p.id)
          return (
            <div key={p.id} className="card !p-3 text-left">
              <button type="button" onClick={() => (p.subscriber_price ? undefined : p.image_url && setZoomed(p))} className="block w-full">
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
                inCart ? (
                  <div className="flex items-center justify-between mt-2 gap-1">
                    <button type="button" onClick={() => decItem(p.id)} className="w-7 h-7 rounded-full border border-ink-700 flex items-center justify-center shrink-0"><Minus size={13} /></button>
                    <span className="text-xs font-semibold">{inCart.qty} no carrinho</span>
                    <button type="button" disabled={inCart.qty >= p.quantity} onClick={() => incItem(p.id)} className="w-7 h-7 rounded-full border border-ink-700 flex items-center justify-center shrink-0 disabled:opacity-30"><Plus size={13} /></button>
                  </div>
                ) : (
                  <button
                    type="button"
                    disabled={!p.quantity}
                    onClick={() => addToCart(p)}
                    className="btn-gold w-full !py-1.5 text-xs mt-2 disabled:opacity-40"
                  >
                    Adicionar ao carrinho
                  </button>
                )
              )}
            </div>
          )
        })}
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

      {cart.length > 0 && !cartOpen && (
        <div className="fixed left-0 right-0 bottom-20 lg:bottom-4 z-30 px-4">
          <button onClick={openCart} className="btn-gold w-full max-w-md mx-auto !py-3 flex items-center justify-between !px-5 shadow-gold">
            <span className="flex items-center gap-2"><ShoppingCart size={16} /> {cartCount} ite{cartCount > 1 ? 'ns' : 'm'}</span>
            <span className="font-bold">{formatBRL(cartTotal)} · Ver carrinho</span>
          </button>
        </div>
      )}

      <Modal open={cartOpen} onClose={closeCart} className="!max-w-sm">
        {step === 'form' && (
          <div className="space-y-4 text-ink-950">
            <p className="font-semibold flex items-center gap-1.5"><ShoppingCart size={16} /> Seu carrinho</p>

            <div className="space-y-2 max-h-52 overflow-y-auto">
              {cart.map((i) => (
                <div key={i.promotion.id} className="flex items-center gap-2 border-b border-black/5 pb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{i.promotion.title}</p>
                    <p className="text-xs text-black/40">{formatBRL(i.promotion.subscriber_price ?? 0)} un.</p>
                  </div>
                  <button type="button" onClick={() => decItem(i.promotion.id)} className="w-7 h-7 rounded-full border border-black/15 flex items-center justify-center shrink-0"><Minus size={12} /></button>
                  <span className="w-5 text-center text-sm font-semibold">{i.qty}</span>
                  <button type="button" disabled={i.qty >= i.promotion.quantity} onClick={() => incItem(i.promotion.id)} className="w-7 h-7 rounded-full border border-black/15 flex items-center justify-center shrink-0 disabled:opacity-30"><Plus size={12} /></button>
                  <button type="button" onClick={() => removeItem(i.promotion.id)} className="text-red-500 shrink-0" aria-label="Remover"><Trash2 size={14} /></button>
                </div>
              ))}
              {!cart.length && <p className="text-sm text-black/40 py-4 text-center">Seu carrinho está vazio.</p>}
            </div>

            <div className="flex items-center justify-between border-t border-black/10 pt-3">
              <span className="text-sm text-black/50">Total</span>
              <span className="font-bold text-lg">{formatBRL(cartTotal)}</span>
            </div>

            {!!cart.length && (
              <>
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
                    <button onClick={submitCard} disabled={busy} className="btn-gold w-full">{busy ? 'Processando...' : `Pagar ${formatBRL(cartTotal)} no cartão`}</button>
                  </div>
                )}

                {method === 'wallet' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm border-t border-black/10 pt-3">
                      <span className="text-black/50">Saldo disponível</span>
                      <span className="font-semibold">{formatBRL(walletAvailable)}</span>
                    </div>
                    {walletAvailable < cartTotal && (
                      <p className="text-sm text-red-500">Saldo insuficiente para essa compra. Escolha Pix ou cartão, ou reduza a quantidade.</p>
                    )}
                    {error && <p className="text-sm text-red-500">{error}</p>}
                    <button onClick={submitWallet} disabled={busy || walletAvailable < cartTotal} className="btn-gold w-full disabled:opacity-40">
                      {busy ? 'Processando...' : `Pagar ${formatBRL(cartTotal)} com saldo`}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {step === 'pix' && (
          <div className="space-y-4 text-center text-ink-950">
            <p className="font-semibold">Pagamento via Pix</p>
            <div className="w-40 h-40 mx-auto rounded-xl bg-white border border-black/10 p-3 flex items-center justify-center overflow-hidden">
              {pixQrCode ? <img src={`data:image/png;base64,${pixQrCode}`} alt="QR Code Pix" className="w-full h-full object-contain" /> : null}
            </div>
            <p className="text-sm text-black/50">Escaneie ou copie o código Pix para pagar {formatBRL(cartTotal)}.</p>
            <button onClick={copyPix} className="btn-dark-light w-full !py-2.5 text-sm gap-2"><Copy size={14} /> {copied ? 'Copiado!' : 'Copiar código Pix'}</button>
            <p className="text-xs text-black/40">A confirmação é automática. Acompanhe o andamento do pedido em "Minhas compras" — o código de retirada aparece depois que o parceiro confirmar o pedido.</p>
            <button onClick={() => { closeCart(); navigate('/app/produtos/compras') }} className="btn-gold w-full">Ver minhas compras</button>
          </div>
        )}

        {step === 'done' && (
          <div className="space-y-4 text-center text-ink-950">
            <p className="font-semibold">Pagamento aprovado!</p>
            <p className="text-sm text-black/50">Acompanhe o andamento em "Minhas compras" — o código de retirada aparece depois que o parceiro confirmar o pedido.</p>
            <button onClick={() => { closeCart(); navigate('/app/produtos/compras') }} className="btn-gold w-full">Ver minhas compras</button>
          </div>
        )}
      </Modal>
    </div>
  )
}
