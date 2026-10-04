import { useEffect, useState } from 'react'
import { Check, Gift, Pause, Play, Plus, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ProductRow } from '../../lib/types'
import { formatBRL } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'

interface CatalogItem { id: string; name: string; description: string | null; image_url: string | null }

// O parceiro não cadastra brinde nenhum do zero — só escolhe, do catálogo
// que o admin disponibiliza (/admin/cadastrar-brinde), quais quer colocar
// na própria vitrine. O brinde não tem preço pro assinante (é benefício
// incluso na assinatura); o "valor de referência" informado aqui só serve
// de base pro bônus de 1% por nível da rede de indicação quando alguém
// retira esse brinde (award_referral_bonuses, tipo consumption).
export default function PartnerProducts() {
  const { partner } = useAuth()
  const [catalog, setCatalog] = useState<CatalogItem[]>([])
  const [mine, setMine] = useState<ProductRow[]>([])
  const [addingId, setAddingId] = useState<string | null>(null)
  const [refValue, setRefValue] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingValueId, setEditingValueId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    if (!partner) return
    const [{ data: cat }, { data: own }] = await Promise.all([
      supabase.from('products_public').select('id, name, description, image_url').is('partner_id', null).eq('is_gift', true).order('name'),
      supabase.from('products').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false }),
    ])
    setCatalog((cat as CatalogItem[]) ?? [])
    setMine((own as ProductRow[]) ?? [])
  }

  useEffect(() => { load() }, [partner])

  const selectedCatalogIds = new Set(mine.map((p) => p.catalog_id).filter(Boolean))

  function startAdd(catalogId: string) {
    setAddingId(catalogId)
    setRefValue('')
    setError(null)
  }

  async function confirmAdd(item: CatalogItem) {
    if (!partner) return
    setError(null)
    setSaving(true)
    const { error: insertError } = await supabase.from('products').insert({
      partner_id: partner.id,
      catalog_id: item.id,
      name: item.name,
      description: item.description,
      image_url: item.image_url,
      normal_price: Number(refValue || 0),
      is_gift: true,
      approved: true,
    })
    setSaving(false)
    if (insertError) { setError('Não foi possível adicionar este brinde à sua vitrine.'); return }
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
    if (!confirm(`Remover "${p.name}" da sua vitrine? Essa ação não pode ser desfeita.`)) return
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

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-2xl font-semibold">Brindes</h1>
        <p className="text-white/50 text-sm">Escolha, do catálogo abaixo, quais brindes você quer oferecer aos assinantes. O brinde é um benefício da assinatura — não tem preço pro assinante.</p>
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
                  <p className="mt-3 pt-3 border-t border-ink-800 text-xs text-emerald-400 flex items-center gap-1.5"><Check size={12} /> Já está na sua vitrine</p>
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
                  <button onClick={() => startAdd(item.id)} className="btn-dark w-full !py-2 text-xs gap-1.5 mt-3 pt-3 border-t border-ink-800 justify-center"><Plus size={12} /> Adicionar à minha vitrine</button>
                )}
              </div>
            )
          })}
          {!catalog.length && (
            <div className="col-span-full"><EmptyState dark icon={Gift} title="Nenhum brinde disponível no catálogo ainda" description="Assim que a administração cadastrar um brinde, ele aparece aqui." /></div>
          )}
        </div>
      </div>

      <div>
        <p className="font-semibold mb-3">Minha vitrine</p>
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
            <div className="col-span-full"><EmptyState dark icon={Gift} title="Você ainda não escolheu nenhum brinde" description="Escolha um brinde do catálogo acima pra começar." /></div>
          )}
        </div>
      </div>
    </div>
  )
}
