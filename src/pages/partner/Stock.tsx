import { useEffect, useState } from 'react'
import { Package, History, PackagePlus } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'

interface StockRow { id: string; quantity: number; product: { id: string; name: string } }
interface ProductOpt { id: string; name: string }

export default function PartnerStock() {
  const { partner } = useAuth()
  const [stock, setStock] = useState<StockRow[]>([])
  const [ownProducts, setOwnProducts] = useState<ProductOpt[]>([])
  const [movements, setMovements] = useState<any[]>([])
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [type, setType] = useState<'loss' | 'damage' | 'adjustment'>('loss')

  const [receiveProduct, setReceiveProduct] = useState('')
  const [receiveQty, setReceiveQty] = useState('')
  const [receiving, setReceiving] = useState(false)

  async function load() {
    if (!partner) return
    const { data } = await supabase.from('stock_partner').select('id, quantity, product:product_id(id, name)').eq('partner_id', partner.id)
    setStock((data as any[]) ?? [])
    const { data: mv } = await supabase.from('stock_movements').select('*, product:product_id(name)').eq('partner_id', partner.id).order('created_at', { ascending: false }).limit(20)
    setMovements(mv ?? [])
    // Every brinde the partner registered (see Produtos cadastrados), so
    // they can receive stock for one even before it has a stock_partner
    // row — the table above only lists products that already have one.
    const { data: products } = await supabase.from('products').select('id, name').eq('partner_id', partner.id).order('name')
    setOwnProducts((products as ProductOpt[]) ?? [])
  }

  useEffect(() => { load() }, [partner])

  async function submitAdjust(productId: string) {
    if (!partner || !qty) return
    const delta = type === 'adjustment' ? Number(qty) : -Math.abs(Number(qty))
    await supabase.rpc('partner_adjust_stock', {
      p_product_id: productId, p_partner_id: partner.id, p_quantity: delta, p_type: type, p_reason: reason || null,
    })
    setAdjusting(null); setQty(''); setReason('')
    load()
  }

  async function receiveStock() {
    if (!partner || !receiveProduct || !receiveQty || Number(receiveQty) <= 0) return
    setReceiving(true)
    await supabase.rpc('partner_adjust_stock', {
      p_product_id: receiveProduct, p_partner_id: partner.id, p_quantity: Math.abs(Number(receiveQty)), p_type: 'adjustment', p_reason: 'Recebimento de estoque',
    })
    setReceiving(false)
    setReceiveProduct(''); setReceiveQty('')
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Estoque</h1>
        <p className="text-white/50 text-sm">Brindes recebidos da matriz e disponíveis para retirada.</p>
      </div>

      <div className="card">
        <div className="flex items-center gap-2 mb-3">
          <PackagePlus size={16} className="text-gold-400" />
          <p className="font-semibold text-sm">Receber estoque</p>
        </div>
        {ownProducts.length ? (
          <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
            <div>
              <label className="label">Brinde</label>
              <select className="input" value={receiveProduct} onChange={(e) => setReceiveProduct(e.target.value)}>
                <option value="">Selecione um brinde cadastrado...</option>
                {ownProducts.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div className="w-full sm:w-32">
              <label className="label">Quantidade</label>
              <input className="input" type="number" min="1" placeholder="0" value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} />
            </div>
            <button onClick={receiveStock} disabled={!receiveProduct || !receiveQty || receiving} className="btn-gold !py-3">
              {receiving ? 'Adicionando...' : 'Adicionar'}
            </button>
          </div>
        ) : (
          <p className="text-xs text-white/40">Cadastre um brinde em "Produtos" antes de receber estoque para ele.</p>
        )}
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase">
              <th className="pb-3">Produto</th><th className="pb-3">Quantidade</th><th className="pb-3">Status</th><th className="pb-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((s) => (
              <tr key={s.id} className="border-t border-ink-800 align-top">
                <td className="py-3">{s.product?.name}</td>
                <td className="py-3 font-semibold">{s.quantity}</td>
                <td className="py-3">
                  <span className={`pill ${s.quantity === 0 ? 'bg-red-500/15 text-red-400' : s.quantity <= 5 ? 'bg-gold-400/15 text-gold-300' : 'bg-emerald-500/15 text-emerald-400'}`}>
                    {s.quantity === 0 ? 'Sem estoque' : s.quantity <= 5 ? 'Estoque baixo' : 'Em estoque'}
                  </span>
                </td>
                <td className="py-3">
                  {adjusting === s.product.id ? (
                    <div className="flex flex-col gap-1.5 w-48">
                      <select className="input !py-1.5 !text-xs" value={type} onChange={(e) => setType(e.target.value as any)}>
                        <option value="loss">Perda</option>
                        <option value="damage">Avaria</option>
                        <option value="adjustment">Ajuste (entrada)</option>
                      </select>
                      <input className="input !py-1.5 !text-xs" placeholder="Quantidade" type="number" value={qty} onChange={(e) => setQty(e.target.value)} />
                      <input className="input !py-1.5 !text-xs" placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
                      <div className="flex gap-1.5">
                        <button onClick={() => submitAdjust(s.product.id)} className="btn-gold !py-1.5 !px-2 text-xs flex-1">Salvar</button>
                        <button onClick={() => setAdjusting(null)} className="btn-ghost !py-1.5 !px-2 text-xs flex-1">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => setAdjusting(s.product.id)} className="text-xs text-gold-400 font-medium">Ajustar</button>
                  )}
                </td>
              </tr>
            ))}
            {!stock.length && <tr><td colSpan={4}><EmptyState dark icon={Package} title="Nenhum brinde em estoque ainda" description="Use 'Receber estoque' acima para adicionar." className="py-8" /></td></tr>}
          </tbody>
        </table>
      </div>

      <div>
        <p className="font-semibold mb-3">Movimentações recentes</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase">
                <th className="pb-3">Data</th><th className="pb-3">Produto</th><th className="pb-3">Tipo</th><th className="pb-3">Qtd.</th><th className="pb-3">Saldo</th>
              </tr>
            </thead>
            <tbody>
              {movements.map((m) => (
                <tr key={m.id} className="border-t border-ink-800">
                  <td className="py-2 text-white/60">{formatDateTime(m.created_at)}</td>
                  <td className="py-2">{m.product?.name}</td>
                  <td className="py-2 text-white/60">{m.type}</td>
                  <td className="py-2">{m.quantity > 0 ? '+' : ''}{m.quantity}</td>
                  <td className="py-2">{m.new_balance}</td>
                </tr>
              ))}
              {!movements.length && <tr><td colSpan={5}><EmptyState dark icon={History} title="Sem movimentações" className="py-6" /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
