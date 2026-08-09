import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { PackageCheck, Box, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner, ProductRow } from '../../lib/types'
import { EmptyState } from '../../components/ui/EmptyState'
import { ImageUpload } from '../../components/ui/ImageUpload'

interface PartnerStockRow { partner_id: string; product_id: string; quantity: number; partner: { trade_name: string } | null; product: { name: string } | null }

const emptyEditProduct = { name: '', description: '', image_url: '', normal_price: '', subscriber_price: '' }

export default function AdminStock() {
  const [products, setProducts] = useState<ProductRow[]>([])
  const [pendingProducts, setPendingProducts] = useState<(ProductRow & { partner?: { trade_name: string } | null })[]>([])
  const [matrixStock, setMatrixStock] = useState<Record<string, number>>({})
  const [partnerStock, setPartnerStock] = useState<PartnerStockRow[]>([])
  const [partners, setPartners] = useState<Partner[]>([])
  const [newProduct, setNewProduct] = useState({ name: '', description: '', image_url: '', normal_price: '', subscriber_price: '' })
  const [entry, setEntry] = useState({ product_id: '', quantity: '' })
  const [transfer, setTransfer] = useState({ product_id: '', partner_id: '', quantity: '' })
  const [msg, setMsg] = useState('')
  const [search, setSearch] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editProduct, setEditProduct] = useState(emptyEditProduct)
  const [savingEdit, setSavingEdit] = useState(false)

  async function load() {
    const { data: prods } = await supabase.from('products').select('*').is('partner_id', null)
    setProducts((prods as ProductRow[]) ?? [])
    const { data: pending } = await supabase
      .from('products')
      .select('*, partner:partner_id(trade_name)')
      .not('partner_id', 'is', null)
      .eq('approved', false)
      .eq('active', true)
      .order('created_at', { ascending: false })
    setPendingProducts((pending as any) ?? [])
    const { data: stock } = await supabase.from('stock_matrix').select('*')
    const map: Record<string, number> = {}
    for (const s of stock ?? []) map[s.product_id] = s.quantity
    setMatrixStock(map)
    const { data: p } = await supabase.from('partners').select('*').in('status', ['approved', 'active'])
    setPartners((p as Partner[]) ?? [])
    const { data: pStock } = await supabase
      .from('stock_partner')
      .select('partner_id, product_id, quantity, partner:partner_id(trade_name), product:product_id(name)')
      .order('quantity', { ascending: true })
    setPartnerStock((pStock as any) ?? [])
  }

  useEffect(() => { load() }, [])

  async function approveProduct(id: string) {
    await supabase.rpc('admin_set_product_approval', { p_product_id: id, p_approved: true })
    load()
  }

  async function rejectProduct(id: string) {
    await supabase.from('products').update({ active: false }).eq('id', id)
    load()
  }

  async function createProduct(e: FormEvent) {
    e.preventDefault()
    await supabase.from('products').insert({
      name: newProduct.name,
      description: newProduct.description,
      image_url: newProduct.image_url || null,
      normal_price: Number(newProduct.normal_price || 0),
      subscriber_price: Number(newProduct.subscriber_price || 0),
      is_gift: true,
      partner_id: null,
    })
    setNewProduct({ name: '', description: '', image_url: '', normal_price: '', subscriber_price: '' })
    load()
  }

  function startEditProduct(p: ProductRow) {
    setEditingId(p.id)
    setEditProduct({
      name: p.name,
      description: p.description ?? '',
      image_url: p.image_url ?? '',
      normal_price: String(p.normal_price ?? ''),
      subscriber_price: String(p.subscriber_price ?? ''),
    })
  }

  async function saveEditProduct(id: string) {
    setSavingEdit(true)
    const { error } = await supabase.from('products').update({
      name: editProduct.name,
      description: editProduct.description || null,
      image_url: editProduct.image_url || null,
      normal_price: Number(editProduct.normal_price || 0),
      subscriber_price: Number(editProduct.subscriber_price || 0),
    }).eq('id', id)
    setSavingEdit(false)
    if (!error) { setEditingId(null); load() }
  }

  const filteredProducts = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return products
    return products.filter((p) => p.name.toLowerCase().includes(q))
  }, [products, search])

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

      <div className="card">
        <p className="font-semibold mb-3">Brindes e produtos de parceiros aguardando aprovação</p>
        <div className="space-y-3">
          {pendingProducts.map((p) => (
            <div key={p.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-ink-800 pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center gap-3 min-w-0">
                {p.image_url && <img src={p.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />}
                <div className="min-w-0">
                  <p className="font-medium text-sm truncate">{p.name}</p>
                  <p className="text-xs text-white/40">{p.partner?.trade_name} · R$ {Number(p.subscriber_price).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => approveProduct(p.id)} className="btn-gold !py-1.5 !px-3 text-xs">Aprovar</button>
                <button onClick={() => rejectProduct(p.id)} className="btn-ghost !py-1.5 !px-3 text-xs">Rejeitar</button>
              </div>
            </div>
          ))}
          {!pendingProducts.length && <EmptyState dark icon={PackageCheck} title="Nenhum item pendente de aprovação" className="py-4" />}
        </div>
      </div>

      <div className="card overflow-x-auto">
        <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
          <p className="font-semibold">Estoque da matriz</p>
          <div className="relative w-56">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
            <input className="input !pl-9 !py-1.5 text-xs" placeholder="Buscar produto..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-left text-white/40 text-xs uppercase"><th className="pb-2">Produto</th><th className="pb-2">Quantidade</th><th className="pb-2">Ação</th></tr></thead>
          <tbody>
            {filteredProducts.map((p) => (
              <tr key={p.id} className="border-t border-ink-800">
                <td className="py-2">
                  <div className="flex items-center gap-2">
                    {p.image_url && <img src={p.image_url} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}
                    {p.name}
                  </div>
                </td>
                <td className="py-2 font-semibold">{matrixStock[p.id] ?? 0}</td>
                <td className="py-2">
                  <button onClick={() => startEditProduct(p)} className="text-xs text-gold-400 font-medium">Editar</button>
                </td>
              </tr>
            ))}
            {!filteredProducts.length && (
              <tr><td colSpan={3}><EmptyState dark icon={Box} title={products.length ? 'Nenhum produto encontrado' : 'Nenhum produto de matriz cadastrado'} className="py-6" /></td></tr>
            )}
          </tbody>
        </table>

        {editingId && (
          <div className="mt-4 bg-ink-950/50 rounded-lg p-4 grid sm:grid-cols-2 gap-3">
            <div className="sm:col-span-2">
              <ImageUpload value={editProduct.image_url || null} onChange={(url) => setEditProduct({ ...editProduct, image_url: url })} folder="products" label="Foto do produto" />
            </div>
            <input className="input" placeholder="Nome" value={editProduct.name} onChange={(e) => setEditProduct({ ...editProduct, name: e.target.value })} />
            <input className="input" placeholder="Descrição" value={editProduct.description} onChange={(e) => setEditProduct({ ...editProduct, description: e.target.value })} />
            <input className="input" type="number" step="0.01" placeholder="Preço normal" value={editProduct.normal_price} onChange={(e) => setEditProduct({ ...editProduct, normal_price: e.target.value })} />
            <input className="input" type="number" step="0.01" placeholder="Preço assinante" value={editProduct.subscriber_price} onChange={(e) => setEditProduct({ ...editProduct, subscriber_price: e.target.value })} />
            <div className="sm:col-span-2 flex gap-2">
              <button onClick={() => saveEditProduct(editingId)} disabled={savingEdit} className="btn-gold !py-2 !px-3 text-xs">{savingEdit ? 'Salvando...' : 'Salvar alterações'}</button>
              <button onClick={() => setEditingId(null)} className="btn-ghost !py-2 !px-3 text-xs">Cancelar</button>
            </div>
          </div>
        )}
      </div>

      <div className="card overflow-x-auto">
        <p className="font-semibold mb-3">Estoque por parceiro</p>
        <table className="w-full text-sm min-w-[500px]">
          <thead><tr className="text-left text-white/40 text-xs uppercase"><th className="pb-2">Parceiro</th><th className="pb-2">Produto</th><th className="pb-2">Quantidade</th></tr></thead>
          <tbody>
            {partnerStock.map((s) => (
              <tr key={`${s.partner_id}-${s.product_id}`} className="border-t border-ink-800">
                <td className="py-2">{s.partner?.trade_name ?? '-'}</td>
                <td className="py-2 text-white/60">{s.product?.name ?? '-'}</td>
                <td className={`py-2 font-semibold ${s.quantity <= 5 ? 'text-red-400' : ''}`}>{s.quantity}</td>
              </tr>
            ))}
            {!partnerStock.length && <tr><td colSpan={3}><EmptyState dark icon={Box} title="Nenhum estoque enviado a parceiros ainda" className="py-6" /></td></tr>}
          </tbody>
        </table>
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <form onSubmit={createProduct} className="card space-y-3">
          <p className="font-semibold text-sm">Cadastrar produto (matriz)</p>
          <ImageUpload value={newProduct.image_url || null} onChange={(url) => setNewProduct({ ...newProduct, image_url: url })} folder="products" label="Foto do produto" />
          <input className="input" required placeholder="Nome" value={newProduct.name} onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })} />
          <input className="input" placeholder="Descrição" value={newProduct.description} onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <input className="input" type="number" step="0.01" placeholder="Preço normal" value={newProduct.normal_price} onChange={(e) => setNewProduct({ ...newProduct, normal_price: e.target.value })} />
            <input className="input" type="number" step="0.01" placeholder="Preço assinante" value={newProduct.subscriber_price} onChange={(e) => setNewProduct({ ...newProduct, subscriber_price: e.target.value })} />
          </div>
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
