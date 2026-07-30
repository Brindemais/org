import { useEffect, useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import type { Partner, ProductRow } from '../../lib/types'

export default function AdminStock() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [matrixStock, setMatrixStock] = useState<Record<string, number>>({})
  const [partners, setPartners] = useState<Partner[]>([])
  const [newProduct, setNewProduct] = useState({ name: '', description: '' })
  const [entry, setEntry] = useState({ product_id: '', quantity: '' })
  const [transfer, setTransfer] = useState({ product_id: '', partner_id: '', quantity: '' })
  const [msg, setMsg] = useState('')

  async function load() {
    const { data: prods } = await supabase.from('products').select('*').is('partner_id', null)
    setProducts((prods as ProductRow[]) ?? [])
    const { data: stock } = await supabase.from('stock_matrix').select('*')
    const map: Record<string, number> = {}
    for (const s of stock ?? []) map[s.product_id] = s.quantity
    setMatrixStock(map)
    const { data: p } = await supabase.from('partners').select('*').in('status', ['approved', 'active'])
    setPartners((p as Partner[]) ?? [])
  }

  useEffect(() => { load() }, [])

  async function createProduct(e: FormEvent) {
    e.preventDefault()
    await supabase.from('products').insert({ name: newProduct.name, description: newProduct.description, is_gift: true, partner_id: null })
    setNewProduct({ name: '', description: '' })
    load()
  }

  async function doEntry(e: FormEvent) {
    e.preventDefault()
    if (!entry.product_id || !entry.quantity) return
    await supabase.rpc('matrix_stock_entry', { p_product_id: entry.product_id, p_quantity: Number(entry.quantity), p_reason: 'Entrada de produção' })
    setEntry({ product_id: '', quantity: '' })
    setMsg('Entrada registrada!')
    load()
  }

  async function doTransfer(e: FormEvent) {
    e.preventDefault()
    if (!transfer.product_id || !transfer.partner_id || !transfer.quantity) return
    const { error } = await supabase.rpc('transfer_stock_to_partner', {
      p_product_id: transfer.product_id, p_partner_id: transfer.partner_id, p_quantity: Number(transfer.quantity), p_reason: 'Remessa para parceiro',
    })
    setMsg(error ? 'Estoque insuficiente na matriz.' : 'Remessa enviada ao parceiro!')
    if (!error) setTransfer({ product_id: '', partner_id: '', quantity: '' })
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Estoque</h1>
        <p className="text-white/50 text-sm">Controle do estoque da matriz e remessas para parceiros.</p>
      </div>

      <div className="card overflow-x-auto">
        <p className="font-semibold mb-3">Estoque da matriz</p>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-white/40 text-xs uppercase"><th className="pb-2">Produto</th><th className="pb-2">Quantidade</th></tr></thead>
          <tbody>
            {products.map((p) => (
              <tr key={p.id} className="border-t border-ink-800"><td className="py-2">{p.name}</td><td className="py-2 font-semibold">{matrixStock[p.id] ?? 0}</td></tr>
            ))}
            {!products.length && <tr><td colSpan={2} className="py-6 text-center text-white/40">Nenhum produto de matriz cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <form onSubmit={createProduct} className="card space-y-3">
          <p className="font-semibold text-sm">Cadastrar produto (matriz)</p>
          <input className="input" required placeholder="Nome" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
          <input className="input" placeholder="Descrição" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} />
          <button type="submit" className="btn-gold w-full">Cadastrar</button>
        </form>

        <form onSubmit={doEntry} className="card space-y-3">
          <p className="font-semibold text-sm">Entrada de estoque</p>
          <select className="input" required value={entry.product_id} onChange={(e) => setEntry({ ...entry, product_id: e.target.value })}>
            <option value="">Produto...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <input className="input" required type="number" placeholder="Quantidade" value={entry.quantity} onChange={(e) => setEntry({ ...entry, quantity: e.target.value })} />
          <button type="submit" className="btn-gold w-full">Registrar entrada</button>
        </form>

        <form onSubmit={doTransfer} className="card space-y-3">
          <p className="font-semibold text-sm">Transferir para parceiro</p>
          <select className="input" required value={transfer.product_id} onChange={(e) => setTransfer({ ...transfer, product_id: e.target.value })}>
            <option value="">Produto...</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
          <select className="input" required value={transfer.partner_id} onChange={(e) => setTransfer({ ...transfer, partner_id: e.target.value })}>
            <option value="">Parceiro...</option>
            {partners.map((p) => <option key={p.id} value={p.id}>{p.trade_name}</option>)}
          </select>
          <input className="input" required type="number" placeholder="Quantidade" value={transfer.quantity} onChange={(e) => setTransfer({ ...transfer, quantity: e.target.value })} />
          <button type="submit" className="btn-gold w-full">Transferir</button>
        </form>
      </div>
      {msg && <p className="text-sm text-gold-300">{msg}</p>}
    </div>
  )
}
