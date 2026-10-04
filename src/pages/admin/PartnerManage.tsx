import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Check, Gift, Package, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ProductRow, Partner } from '../../lib/types'
import { formatBRL } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'

// Admin gerenciando a vitrine e o estoque de um parceiro específico, nos
// mesmos moldes de partner/Products.tsx e partner/Stock.tsx — não é um
// "logar como o parceiro" de verdade, mas chega no mesmo resultado prático
// via RLS (is_admin() libera tudo que is_partner_staff libera). Mesma
// regra de produto do parceiro comum: só escolhe do catálogo do admin
// (/admin/cadastrar-brinde), não cadastra brinde do zero.
interface CatalogItem { id: string; name: string; description: string | null; image_url: string | null }
interface StockRow { id: string; quantity: number; product: { id: string; name: string } }

export default function AdminPartnerManage() {
  const { id } = useParams<{ id: string }>()
  const [partner, setPartner] = useState<Partner | null>(null)
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [mine, setMine] = useState<ProductRow[]>([])
  const [stock, setStock] = useState<StockRow[]>([])
  const [addingId, setAddingId] = useState<string | null>(null)
  const [refValue, setRefValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingValueId, setEditingValueId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [receiveProduct, setReceiveProduct] = useState('')
  const [receiveQty, setReceiveQty] = useState('')
  const [receiving, setReceiving] = useState(false)

  async function load() {
    if (!id) return
    const [{ data: p }, { data: cat }, { data: own }, { data: stockRows }] = await Promise.all([
      supabase.from('partners').select('*').eq('id', id).maybeSingle(),
      supabase.from('products_public').select('id, name, description, image_url').is('partner_id', null).eq('is_gift', true).order('name'),
      supabase.from('products').select('*').eq('partner_id', id).order('created_at', { ascending: false }),
      supabase.from('stock_partner').select('id, quantity, product:product_id(id, name)').eq('partner_id', id),
    ])
    setPartner(p as Partner)
    setCatalog((cat as CatalogItem[]) ?? [])
    setMine((own as ProductRow[]) ?? [])
    setStock((stockRows as any[]) ?? [])
  }

  useEffect(() => { load() }, [id])

  const selectedCatalogIds = new Set(mine.map((p) => p.catalog_id).filter(Boolean))

  function startAdd(catalogId: string) {
    setAddingId(catalogId)
    setRefValue('')
    setError(null)
  }

  async function confirmAdd(item: CatalogItem) {
    if (!id) return
    setError(null)
    setSaving(true)
    const { error: insertError } = await supabase.from('products').insert({
      partner_id: id,
      catalog_id: item.id,
      name: item.name,
      description: item.description,
      image_url: item.image_url,
      normal_price: Number(refValue || 0),
      is_gift: true,
      approved: true,
    })
    setSaving(false)
    if (insertError) { setError('Não foi possível adicionar este brinde à vitrine do parceiro.'); return }
    setAddingId(null)
    load()
  }

  async function toggleActive(p: ProductRow) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id)
    load()
  }

  async function saveValue(p: ProductRow) {
    await supabase.from('products').update({ normal_price: Number(editValue || 0) }).eq('id', p.id)
    setEditingValueId(null)
    load()
  }

  async function deleteMine(p: ProductRow) {
    if (!confirm(`Remover "${p.name}" da vitrine deste parceiro? Essa ação não pode ser desfeita.`)) return
    setDeleteError(null)
    setDeletingId(p.id)
    const { error: deleteErr } = await supabase.from('products').delete().eq('id', p.id)
    setDeletingId(null)
    if (deleteErr) {
      setDeleteError({
        id: p.id,
        message: deleteErr.code === '23503' ? 'Não é possível remover: já tem retirada ou movimentação de estoque registrada. Use Pausar.' : 'Não foi possível remover.',
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
    <div className="space-y-8">
      <div>
        <Link to="/admin/parceiros" className="text-xs text-white/40 flex items-center gap-1 mb-2 w-fit"><ArrowLeft size={12} /> Voltar pra parceiros</Link>
        <h1 className="font-display text-2xl font-semibold">{partner.trade_name}</h1>
        <p className="text-white/50 text-sm">Escolha, do catálogo, quais brindes este parceiro oferece, e gerencie o estoque — como se fosse o próprio painel dele.</p>
      </div>

      <div>
        <p className="font-semibold mb-3">Catálogo disponível</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {catalog.map((item) => {
            const selected = selectedCatalogIds.has(item.id)
            return (
              <div key={item.id} className="card">
                <div className="aspect-video rounded-lg bg-ink-950 border border-ink-800 mb-3 overflow-hidden flex items-center justify-center">
                  {item.image_url ? <img src={item.image_url} alt={item.name} className="w-full h-full object-cover" /> : <span className="text-xs text-white/20">Sem foto</span>}
                </div>
                <p className="font-semibold">{item.name}</p>
                {item.description && <p className="text-xs text-white/50 mb-2">{item.description}</p>}

                {selected ? (
                  <p className="mt-3 pt-3 border-t border-ink-800 text-xs text-emerald-400 flex items-center gap-1.5"><Check size={12} /> Já está na vitrine</p>
                ) : addingId === item.id ? (
                  <div className="mt-3 pt-3 border-t border-ink-800 space-y-2">
                    <div>
                      <label className="label">Valor de referência (R$)</label>
                      <input className="input" type="number" step="0.01" min="0" value={refValue} onChange={(e) => setRefValue(e.target.value)} placeholder="0,00" />
                    </div>
                    {error && <p className="text-xs text-red-400">{error}</p>}
                    <div className="flex gap-2">
                      <button onClick={() => confirmAdd(item)} disabled={saving} className="btn-gold !py-2 text-xs flex-1">{saving ? 'Adicionando...' : 'Confirmar'}</button>
                      <button onClick={() => setAddingId(null)} className="btn-ghost !py-2 text-xs flex-1">Cancelar</button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => startAdd(item.id)} className="btn-dark w-full !py-2 text-xs gap-1.5 mt-3 pt-3 border-t border-ink-800 justify-center"><Plus size={12} /> Adicionar à vitrine</button>
                )}
              </div>
            )
          })}
          {!catalog.length && (
            <div className="col-span-full"><EmptyState dark icon={Gift} title="Nenhum brinde no catálogo ainda" description="Cadastre o primeiro em Cadastrar brinde." /></div>
          )}
        </div>
      </div>

      <div>
        <p className="font-semibold mb-3">Vitrine deste parceiro</p>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {mine.map((p) => (
            <div key={p.id} className={`card ${!p.active ? 'opacity-60' : ''}`}>
              <div className="aspect-video rounded-lg bg-ink-950 border border-ink-800 mb-3 overflow-hidden flex items-center justify-center">
                {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-xs text-white/20">Sem foto</span>}
              </div>
              <p className="font-semibold">{p.name}</p>
              {editingValueId === p.id ? (
                <div className="flex gap-1.5 mt-1">
                  <input className="input !py-1.5 !text-xs" type="number" step="0.01" min="0" value={editValue} onChange={(e) => setEditValue(e.target.value)} />
                  <button onClick={() => saveValue(p)} className="btn-gold !py-1.5 !px-2 text-xs">Salvar</button>
                </div>
              ) : (
                <button onClick={() => { setEditingValueId(p.id); setEditValue(String(p.normal_price)) }} className="text-xs text-white/40 mt-1">
                  Valor de referência: <span className="text-gold-400 font-medium">{formatBRL(p.normal_price)}</span>
                </button>
              )}
              <div className="flex gap-2 mt-3 pt-3 border-t border-ink-800">
                <button onClick={() => toggleActive(p)} className="btn-dark flex-1 !py-2 text-xs gap-1.5">
                  {p.active ? <><Pause size={12} /> Pausar</> : <><Play size={12} /> Reativar</>}
                </button>
                <button onClick={() => deleteMine(p)} disabled={deletingId === p.id} className="btn-dark !py-2 !px-2.5 text-xs text-red-400"><Trash2 size={12} /></button>
              </div>
              {deleteError?.id === p.id && <p className="text-xs text-red-400 mt-2">{deleteError.message}</p>}
            </div>
          ))}
          {!mine.length && (
            <div className="col-span-full"><EmptyState dark icon={Gift} title="Nenhum brinde escolhido ainda" description="Escolha um brinde do catálogo acima." /></div>
          )}
        </div>
      </div>

      <div>
        <p className="font-semibold mb-3 flex items-center gap-2"><Package size={16} className="text-gold-400" /> Estoque</p>
        <div className="card mb-4">
          {mine.length ? (
            <div className="grid sm:grid-cols-[1fr_auto_auto] gap-3 items-end">
              <div>
                <label className="label">Brinde</label>
                <select className="input" value={receiveProduct} onChange={(e) => setReceiveProduct(e.target.value)}>
                  <option value="">Selecione um brinde da vitrine...</option>
                  {mine.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
              <div className="w-full sm:w-32">
                <label className="label">Quantidade</label>
                <input className="input" type="number" min="1" placeholder="0" value={receiveQty} onChange={(e) => setReceiveQty(e.target.value)} />
              </div>
              <button onClick={receiveStock} disabled={!receiveProduct || !receiveQty || receiving} className="btn-gold !py-3">{receiving ? 'Adicionando...' : 'Adicionar'}</button>
            </div>
          ) : (
            <p className="text-xs text-white/40">Escolha um brinde do catálogo acima antes de adicionar estoque.</p>
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
