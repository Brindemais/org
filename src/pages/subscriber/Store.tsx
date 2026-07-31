import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Minus, Plus, Receipt, ShoppingBag, ShoppingCart, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ProductRow } from '../../lib/types'
import { formatBRL } from '../../lib/format'

export default function SubscriberStore() {
  const { user } = useAuth()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [cart, setCart] = useState<Record<string, number>>({})
  const [cartOpen, setCartOpen] = useState(false)
  const [checkingOut, setCheckingOut] = useState(false)
  const [done, setDone] = useState(false)

  useEffect(() => {
    supabase.from('products').select('*').eq('store_visible', true).eq('active', true).eq('approved', true).then(({ data }) => setProducts((data as ProductRow[]) ?? []))
  }, [])

  function addToCart(id: string) {
    setCart((prev) => ({ ...prev, [id]: (prev[id] ?? 0) + 1 }))
  }

  function changeQty(id: string, delta: number) {
    setCart((prev) => {
      const next = { ...prev }
      const qty = (next[id] ?? 0) + delta
      if (qty <= 0) delete next[id]
      else next[id] = qty
      return next
    })
  }

  const cartItems = useMemo(
    () => Object.entries(cart).map(([id, qty]) => ({ product: products.find((p) => p.id === id)!, qty })).filter((i) => i.product),
    [cart, products],
  )
  const cartCount = cartItems.reduce((sum, i) => sum + i.qty, 0)
  const cartTotal = cartItems.reduce((sum, i) => sum + i.qty * i.product.subscriber_price, 0)

  async function checkout() {
    if (!user || !cartItems.length) return
    setCheckingOut(true)
    const { data: order } = await supabase.from('store_orders').insert({ subscriber_id: user.id, total: cartTotal }).select().single()
    if (order) {
      await supabase.from('store_order_items').insert(
        cartItems.map((i) => ({ order_id: order.id, product_id: i.product.id, partner_id: i.product.partner_id, quantity: i.qty, unit_price: i.product.subscriber_price })),
      )
      await supabase.from('payments').insert({ subscriber_id: user.id, order_id: order.id, amount: cartTotal, type: 'store', pix_code: 'PEDIDO-' + order.id.slice(0, 8) })
    }
    setCheckingOut(false)
    setCart({})
    setCartOpen(false)
    setDone(true)
    setTimeout(() => setDone(false), 3500)
  }

  return (
    <div className="space-y-5 relative">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-xl font-semibold flex items-center gap-2"><ShoppingBag size={19} className="text-gold-400" /> Loja Brinde Mais</h1>
          <p className="text-sm text-white/50">Produtos e brindes exclusivos, com preço especial para assinantes.</p>
        </div>
        <Link to="/app/loja/pedidos" className="shrink-0 w-9 h-9 rounded-full bg-ink-900 border border-ink-800 flex items-center justify-center" aria-label="Meus pedidos">
          <Receipt size={16} className="text-white/70" />
        </Link>
      </div>

      {done && <p className="text-sm bg-gold-400/10 text-gold-300 rounded-lg px-3 py-2">Pedido enviado! Acompanhe o status em "Meus pedidos".</p>}

      <div className="grid grid-cols-2 gap-3 pb-20">
        {products.map((p) => (
          <div key={p.id} className="card !p-3">
            <div className="aspect-square rounded-lg bg-ink-800 mb-2 flex items-center justify-center text-white/20 text-xs overflow-hidden">
              {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : 'Sem imagem'}
            </div>
            <p className="text-sm font-medium leading-tight mb-1">{p.name}</p>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-xs line-through text-white/30">{formatBRL(p.normal_price)}</span>
              <span className="text-sm font-bold text-gold-400">{formatBRL(p.subscriber_price)}</span>
            </div>
            <button onClick={() => addToCart(p.id)} className="btn-gold w-full !py-2 text-xs">
              {cart[p.id] ? `No carrinho (${cart[p.id]})` : 'Adicionar ao carrinho'}
            </button>
          </div>
        ))}
        {!products.length && <p className="col-span-2 text-sm text-white/40 text-center py-12">Nenhum produto disponível na loja no momento.</p>}
      </div>

      {cartCount > 0 && !cartOpen && (
        <button
          onClick={() => setCartOpen(true)}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 z-30 btn-gold !rounded-full !py-3 !px-5 gap-2 shadow-gold"
        >
          <ShoppingCart size={16} /> {cartCount} item{cartCount > 1 ? 's' : ''} · {formatBRL(cartTotal)}
        </button>
      )}

      {cartOpen && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/60" onClick={() => setCartOpen(false)} />
          <div className="mobile-shell absolute inset-x-0 bottom-0 mx-auto bg-ink-900 border-t border-ink-800 rounded-t-2xl p-4 max-h-[75vh] overflow-y-auto safe-bottom">
            <div className="flex items-center justify-between mb-4">
              <p className="font-semibold flex items-center gap-2"><ShoppingCart size={16} className="text-gold-400" /> Seu carrinho</p>
              <button onClick={() => setCartOpen(false)} className="text-white/40"><X size={18} /></button>
            </div>
            <div className="space-y-3 mb-4">
              {cartItems.map(({ product, qty }) => (
                <div key={product.id} className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg bg-ink-800 shrink-0 overflow-hidden">
                    {product.image_url && <img src={product.image_url} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{product.name}</p>
                    <p className="text-xs text-gold-400 font-semibold">{formatBRL(product.subscriber_price)}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button onClick={() => changeQty(product.id, -1)} className="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center"><Minus size={13} /></button>
                    <span className="text-sm w-4 text-center">{qty}</span>
                    <button onClick={() => changeQty(product.id, 1)} className="w-7 h-7 rounded-full bg-ink-800 flex items-center justify-center"><Plus size={13} /></button>
                  </div>
                </div>
              ))}
              {!cartItems.length && <p className="text-sm text-white/40 text-center py-6">Seu carrinho está vazio.</p>}
            </div>
            {cartItems.length > 0 && (
              <>
                <div className="flex items-center justify-between mb-3 pt-3 border-t border-ink-800">
                  <p className="text-sm text-white/50">Total</p>
                  <p className="text-lg font-bold text-gold-400">{formatBRL(cartTotal)}</p>
                </div>
                <button onClick={checkout} disabled={checkingOut} className="btn-gold w-full">
                  {checkingOut ? 'Enviando pedido...' : 'Finalizar pedido via Pix'}
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
