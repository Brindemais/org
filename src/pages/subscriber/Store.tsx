import { useEffect, useState } from 'react'
import { ShoppingBag } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ProductRow } from '../../lib/types'
import { formatBRL } from '../../lib/format'

export default function SubscriberStore() {
  const { user } = useAuth()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [buying, setBuying] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    supabase.from('products').select('*').eq('store_visible', true).eq('active', true).then(({ data }) => setProducts((data as ProductRow[]) ?? []))
  }, [])

  async function buy(p: ProductRow) {
    if (!user) return
    setBuying(p.id)
    const { data: order } = await supabase.from('store_orders').insert({ subscriber_id: user.id, total: p.subscriber_price }).select().single()
    if (order) {
      await supabase.from('store_order_items').insert({ order_id: order.id, product_id: p.id, partner_id: p.partner_id, quantity: 1, unit_price: p.subscriber_price })
      await supabase.from('payments').insert({ subscriber_id: user.id, order_id: order.id, amount: p.subscriber_price, type: 'store', pix_code: 'PEDIDO-' + order.id.slice(0, 8) })
    }
    setBuying(null)
    setDone(p.id)
    setTimeout(() => setDone(null), 3000)
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold flex items-center gap-2"><ShoppingBag size={19} className="text-gold-400" /> Loja Brinde Mais</h1>
        <p className="text-sm text-white/50">Produtos e brindes exclusivos, com preço especial para assinantes.</p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <div key={p.id} className="card !p-3">
            <div className="aspect-square rounded-lg bg-ink-800 mb-2 flex items-center justify-center text-white/20 text-xs">
              {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover rounded-lg" /> : 'Sem imagem'}
            </div>
            <p className="text-sm font-medium leading-tight mb-1">{p.name}</p>
            <div className="flex items-baseline gap-1.5 mb-2">
              <span className="text-xs line-through text-white/30">{formatBRL(p.normal_price)}</span>
              <span className="text-sm font-bold text-gold-400">{formatBRL(p.subscriber_price)}</span>
            </div>
            <button onClick={() => buy(p)} disabled={buying === p.id} className="btn-gold w-full !py-2 text-xs">
              {done === p.id ? 'Pedido enviado!' : buying === p.id ? '...' : 'Comprar via Pix'}
            </button>
          </div>
        ))}
        {!products.length && <p className="col-span-2 text-sm text-white/40 text-center py-12">Nenhum produto disponível na loja no momento.</p>}
      </div>
    </div>
  )
}
