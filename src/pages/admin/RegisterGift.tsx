import { useEffect, useState, type FormEvent } from 'react'
import { Gift, Pause, Pencil, Play, Trash2, X } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { ProductRow } from '../../lib/types'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { EmptyState } from '../../components/ui/EmptyState'

const emptyForm = { name: '', description: '', image_url: '' }

// Catálogo central de brindes (products com partner_id null) — o parceiro
// não cadastra mais brinde nenhum do zero, só escolhe destes modelos quais
// quer oferecer na vitrine dele (ver partner/Products.tsx e
// admin/PartnerManage.tsx). O brinde em si não tem preço pro assinante —
// é um benefício incluso na assinatura, não uma compra; o valor que o
// parceiro informa ao escolher é só a referência usada pra calcular o
// bônus de 1% por nível da rede de indicação na retirada.
export default function AdminRegisterGift() {
  const [catalog, setCatalog] = useState<ProductRow[]>([])
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [deleteError, setDeleteError] = useState<{ id: string; message: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  async function load() {
    const { data } = await supabase.from('products').select('*').is('partner_id', null).order('created_at', { ascending: false })
    setCatalog((data as ProductRow[]) ?? [])
  }

  useEffect(() => { load() }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)
    const payload = { name: form.name, description: form.description || null, image_url: form.image_url || null }
    const { error: saveError } = editingId
      ? await supabase.from('products').update(payload).eq('id', editingId)
      : await supabase.from('products').insert({ ...payload, partner_id: null, is_gift: true, approved: true })
    setSaving(false)
    if (saveError) { setError(editingId ? 'Não foi possível salvar as alterações.' : 'Não foi possível cadastrar o brinde.'); return }
    setForm(emptyForm)
    setEditingId(null)
    load()
  }

  function startEdit(p: ProductRow) {
    setEditingId(p.id)
    setError(null)
    setForm({ name: p.name, description: p.description ?? '', image_url: p.image_url ?? '' })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() { setEditingId(null); setForm(emptyForm); setError(null) }

  async function toggleActive(p: ProductRow) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id)
    load()
  }

  async function deleteTemplate(p: ProductRow) {
    if (!confirm(`Remover "${p.name}" do catálogo? Parceiros que já escolheram esse brinde continuam com ele na vitrine deles.`)) return
    setDeleteError(null)
    setDeletingId(p.id)
    const { error: deleteErr } = await supabase.from('products').delete().eq('id', p.id)
    setDeletingId(null)
    if (deleteErr) { setDeleteError({ id: p.id, message: 'Não foi possível remover — use Pausar pra tirar da lista de novas escolhas.' }); return }
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Gift size={22} className="text-gold-400" /> Catálogo de brindes</h1>
        <p className="text-white/50 text-sm">Cadastre os modelos de brinde que os parceiros poderão escolher oferecer na vitrine deles. O parceiro não cria brinde do zero — só seleciona destes.</p>
      </div>

      <form onSubmit={handleSubmit} className="card grid sm:grid-cols-2 gap-3 max-w-2xl">
        <div className="sm:col-span-2 flex items-center justify-between">
          <p className="font-semibold text-sm">{editingId ? 'Editando brinde do catálogo' : 'Novo brinde no catálogo'}</p>
          {editingId && <button type="button" onClick={cancelEdit} className="text-xs text-white/40 flex items-center gap-1"><X size={12} /> Cancelar edição</button>}
        </div>
        <div className="sm:col-span-2">
          <ImageUpload value={form.image_url || null} onChange={(url) => setForm({ ...form, image_url: url })} folder="products" label="Foto do brinde" hint="Tamanho recomendado: 800x450px (16:9), até 4MB." />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Nome do brinde</label>
          <input className="input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Ex: Combo Balde de Cerveja + Caipirinha" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Descrição</label>
          <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        {error && <p className="sm:col-span-2 text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={saving} className="btn-gold sm:col-span-2">{saving ? 'Salvando...' : editingId ? 'Salvar alterações' : 'Adicionar ao catálogo'}</button>
      </form>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {catalog.map((p) => (
          <div key={p.id} className={`card ${!p.active ? 'opacity-60' : ''}`}>
            <div className="aspect-video rounded-lg bg-ink-950 border border-ink-800 mb-3 overflow-hidden flex items-center justify-center">
              {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-xs text-white/20">Sem foto</span>}
            </div>
            <p className="font-semibold">{p.name}</p>
            <p className="text-xs text-white/50">{p.description}</p>
            <div className="flex gap-2 mt-3 pt-3 border-t border-ink-800">
              <button onClick={() => startEdit(p)} className="btn-dark flex-1 !py-2 text-xs gap-1.5"><Pencil size={12} /> Editar</button>
              <button onClick={() => toggleActive(p)} className="btn-dark flex-1 !py-2 text-xs gap-1.5">
                {p.active ? <><Pause size={12} /> Pausar</> : <><Play size={12} /> Reativar</>}
              </button>
              <button onClick={() => deleteTemplate(p)} disabled={deletingId === p.id} className="btn-dark !py-2 !px-2.5 text-xs text-red-400"><Trash2 size={12} /></button>
            </div>
            {deleteError?.id === p.id && <p className="text-xs text-red-400 mt-2">{deleteError.message}</p>}
          </div>
        ))}
        {!catalog.length && (
          <div className="col-span-full"><EmptyState dark icon={Gift} title="Nenhum brinde no catálogo ainda" description="Cadastre o primeiro brinde no formulário acima." /></div>
        )}
      </div>
    </div>
  )
}
