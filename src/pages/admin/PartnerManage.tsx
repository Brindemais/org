import { useEffect, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Gift, Package, Pause, Pencil, Play, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ProductRow, Partner } from '../../lib/types'
import { formatBRL } from '../../lib/format'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'

// Admin gerenciando produtos e estoque de um parceiro específico, nos
// mesmos moldes de partner/Products.tsx e partner/Stock.tsx — não é um
// "logar como o parceiro" de verdade (não troca a sessão do admin), mas
// chega no mesmo resultado prático: RLS já libera is_admin() tanto pra
// products (products_admin_insert/products_update/products_delete) quanto
// pra partner_adjust_stock (via is_partner_staff que inclui is_admin()),
// então o admin consegue cadastrar, editar, pausar, excluir e ajustar
// estoque de qualquer parceiro direto por aqui.
const NETWORK_COMMISSION_PCT = 4
const emptyForm = { name: '', description: '', normal_price: '', discount_pct: '', subscriber_discount_pct: '', image_url: '' }

interface StockRow { id: string; quantity: number; product: { id: string; name: string } }

export default function AdminPartnerManage() {
  const { id } = useParams<{ id: string }>()
  const [partner, setPartner] = useState<Partner | null>(null)
  const [products, setProducts] = useState<ProductRow[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [receiveProduct, setReceiveProduct] = useState('')
  const [receiveQty, setReceiveQty] = useState('')
  const [receiving, setReceiving] = useState(false)

  async function load() {
    if (!id) return
    const [{ data: p }, { data: prods }, { data: stockRows }] = await Promise.all([
      supabase.from('partners').select('*').eq('id', id).maybeSingle(),
      supabase.from('products').select('*').eq('partner_id', id).order('created_at', { ascending: false }),
      supabase.from('stock_partner').select('id, quantity, product:product_id(id, name)').eq('partner_id', id),
    ])
    setPartner(p as Partner)
    setProducts((prods as ProductRow[]) ?? [])
    setStock((stockRows as any[]) ?? [])
  }

  useEffect(() => { load() }, [id])

  const normalPrice = Number(form.normal_price || 0)
  const discountPct = Math.min(50, Math.max(0, Number(form.discount_pct || 0)))
  const subscriberDiscountPct = Math.max(0, Number(form.subscriber_discount_pct || 0))
  const netProfitPct = discountPct - subscriberDiscountPct - NETWORK_COMMISSION_PCT
  const usesPricingRule = discountPct > 0
  const subscriberPrice = normalPrice * (1 - subscriberDiscountPct / 100)
  const poolInvalid = usesPricingRule && subscriberDiscountPct + NETWORK_COMMISSION_PCT > discountPct

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!id) return
    setError(null)
    if (poolInvalid) {
      setError(`O desconto Brinde Mais precisa cobrir o repasse ao assinante + os ${NETWORK_COMMISSION_PCT}% da rede de consumo.`)
      return
    }
    setSaving(true)
    const payload = {
      name: form.name,
      description: form.description,
      normal_price: normalPrice,
      subscriber_price: Number(subscriberPrice.toFixed(2)),
      discount_pct: discountPct,
      subscriber_discount_pct: subscriberDiscountPct,
      image_url: form.image_url || null,
    }
    const { error: saveError } = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId)
      : await supabase.from('products').insert({ ...payload, partner_id: id, is_gift: true, approved: true })

    setSaving(false)
    if (saveError) { setError(editingId ? 'Não foi possível salvar as alterações.' : 'Não foi possível cadastrar o brinde.'); return }
    setForm(emptyForm)
    setEditingId(null)
    load()
  }

  function startEdit(p: ProductRow) {
    setEditingId(p.id)
    setError(null)
    setForm({
      name: p.name, description: p.description ?? '', normal_price: String(p.normal_price),
      discount_pct: String(p.discount_pct), subscriber_discount_pct: String(p.subscriber_discount_pct), image_url: p.image_url ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() { setEditingId(null); setForm(emptyForm); setError(null) }

  async function toggleActive(p: ProductRow) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id)
    load()
  }

  async function deleteProduct(p: ProductRow) {
    if (!confirm(`Excluir "${p.name}" definitivamente? Essa ação não pode ser desfeita.`)) return
    setDeleteError(null)
    setDeletingId(p.id)
    const { error: deleteErr } = await supabase.from('products').delete().eq('id', p.id)
    setDeletingId(null)
    if (deleteErr) {
      setDeleteError({
        id: p.id,
        message: deleteErr.code === '23503' ? 'Não é possível excluir: já tem retirada ou movimentação de estoque registrada. Use Pausar.' : 'Não foi possível excluir o brinde.',
      })
      return
    }
    load()
  }

  async function receiveStock() {
    if (!id || !receiveProduct || !receiveQty || Number(receiveQty) <= 0) return
    setReceiving(true)
    await supabase.rpc('partner_adjust_stock', {
      p_product_id: receiveProduct, p_partner_id: id, p_quantity: Math.abs(Number(receiveQty)), p_type: 'adjustment', p_reason: 'Ajuste de estoque pelo administrador',
    })
    setReceiving(false)
    setReceiveProduct(''); setReceiveQty('')
    load()
  }

  if (!partner) return null

  return (
    <div className="space-y-6">
      <div>
        <Link to="/admin/parceiros" className="text-xs text-white/40 flex items-center gap-1 mb-2 w-fit"><ArrowLeft size={12} /> Voltar pra parceiros</Link>
        <h1 className="font-display text-2xl font-semibold">{partner.trade_name}</h1>
        <p className="text-white/50 text-sm">Cadastre, edite e gerencie o estoque dos brindes deste parceiro, como se fosse o próprio painel dele.</p>
      </div>

      <form onSubmit={handleSubmit} className="card grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2 flex items-center justify-between">
          <p className="font-semibold text-sm">{editingId ? 'Editando brinde' : 'Novo brinde'}</p>
          {editingId && <button type="button" onClick={cancelEdit} className="text-xs text-white/40 flex items-center gap-1"><X size={12} /> Cancelar edição</button>}
        </div>
        <div className="sm:col-span-2">
          <ImageUpload value={form.image_url || null} onChange={(url) => setForm({ ...form, image_url: url })} folder="products" label="Foto do brinde" hint="Tamanho recomendado: 800x450px (16:9), até 4MB." />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Nome do brinde</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Descrição</label>
          <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="label">Valor do produto (R$)</label>
          <input className="input" type="number" step="0.01" min="0" value={form.normal_price} onChange={(e) => setForm({ ...form, normal_price: e.target.value })} />
        </div>
        <div>
          <label className="label">Desconto Brinde Mais (até 50%)</label>
          <input className="input" type="number" step="0.01" min="0" max="50" placeholder="0" value={form.discount_pct} onChange={(e) => setForm({ ...form, discount_pct: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">% desse desconto repassado ao assinante</label>
          <input className="input" type="number" step="0.01" min="0" placeholder="0" value={form.subscriber_discount_pct} onChange={(e) => setForm({ ...form, subscriber_discount_pct: e.target.value })} />
        </div>
        {error && <p className="sm:col-span-2 text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={saving || poolInvalid} className="btn-gold sm:col-span-2">
          {saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Cadastrar brinde'}
        </button>
      </form>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <div key={p.id} className={`card ${!p.active ? 'opacity-60' : ''}`}>
            <div className="aspect-video rounded-lg bg-ink-950 border border-ink-800 mb-3 overflow-hidden flex items-center justify-center">
              {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-xs text-white/20">Sem foto</span>}
            </div>
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold">{p.name}</p>
              <StatusBadge status={!p.active ? 'cancelled' : p.approved ? 'approved' : 'pending_approval'} />
            </div>
            <p className="text-xs text-white/50 mb-2">{p.description}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xs line-through text-white/30">{formatBRL(p.normal_price)}</span>
              <span className="text-sm font-bold text-gold-400">{formatBRL(p.subscriber_price)}</span>
            </div>
            <div className="flex gap-2 mt-3 pt-3 border-t border-ink-800">
              <button onClick={() => startEdit(p)} className="btn-dark flex-1 !py-2 text-xs gap-1.5"><Pencil size={12} /> Editar</button>
              <button onClick={() => toggleActive(p)} className="btn-dark flex-1 !py-2 text-xs gap-1.5">
                {p.active ? <><Pause size={12} /> Pausar</> : <><Play size={12} /> Reativar</>}
              </button>
              <button onClick={() => deleteProduct(p)} disabled={deletingId === p.id} className="btn-dark !py-2 !px-2.5 text-xs text-red-400"><Trash2 size={12} /></button>
            </div>
            {deleteError?.id === p.id && <p className="text-xs text-red-400 mt-2">{deleteError.message}</p>}
          </div>
        ))}
        {!products.length && (
          <div className="col-span-full"><EmptyState dark icon={Gift} title="Nenhum brinde cadastrado ainda" description="Cadastre o primeiro brinde no formulário acima." /></div>
        )}
      </div>

      <div>
        <p className="font-semibold mb-3 flex items-center gap-2"><Package size={16} className="text-gold-400" /> Estoque</p>
        <div className="card mb-4">
          {products.length ? (
            <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
              <div>
                <label className="label">Brinde</label>
                <select className="input" value={receiveProduct} onChange={(e) => setReceiveProduct(e.target.value)}>
                  <option value="">Selecione um brinde cadastrado...</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="w-full sm:w-32">
                <label className="label">Quantidade</label>
                <input className="input" type="number" min="1" placeholder="0" value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} />
              </div>
              <button onClick={receiveStock} disabled={!receiveProduct || !receiveQty || receiving} className="btn-gold !py-3">{receiving ? 'Adicionando...' : 'Adicionar'}</button>
            </div>
          ) : (
            <p className="text-xs text-white/40">Cadastre um brinde acima antes de adicionar estoque.</p>
          )}
        </div>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[400px]">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase"><th className="pb-3">Produto</th><th className="pb-3">Quantidade</th></tr>
            </thead>
            <tbody>
              {stock.map((s) => (
                <tr key={s.id} className="border-t border-ink-800">
                  <td className="py-3">{s.product?.name}</td>
                  <td className="py-3 font-semibold">{s.quantity}</td>
                </tr>
              ))}
              {!stock.length && <tr><td colSpan={2}><EmptyState dark icon={Package} title="Nenhum brinde em estoque ainda" className="py-6" /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
