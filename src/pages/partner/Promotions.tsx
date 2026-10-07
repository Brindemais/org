import { useEffect, useState, type FormEvent } from 'react'
import { Percent, Trash2 } from 'lucide-react'
import { formatDate } from '../../lib/format'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Promotion } from '../../lib/types'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { ImageUpload } from '../../components/ui/ImageUpload'

export default function PartnerPromotions() {
  const { partner } = useAuth()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [form, setForm] = useState({ title: '', description: '', image_url: '', normal_price: '', subscriber_price: '', valid_until: '', quantity: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [editingQtyId, setEditingQtyId] = useState<string | null>(null)
  const [editQty, setEditQty] = useState('')

  async function load() {
    if (!partner) return
    const { data } = await supabase.from('promotions').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false })
    setPromotions((data as Promotion[]) ?? [])
  }

  useEffect(() => { load() }, [partner])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!partner || !form.valid_until) return
    setSaving(true)
    await supabase.from('promotions').insert({
      partner_id: partner.id,
      title: form.title,
      description: form.description,
      image_url: form.image_url || null,
      normal_price: Number(form.normal_price || 0),
      subscriber_price: Number(form.subscriber_price || 0),
      valid_until: form.valid_until,
      quantity: Math.max(0, Number(form.quantity || 0)),
      // Partner-created promotions go live immediately — no admin approval
      // step. The admin panel can still suspend one after the fact if needed.
      status: 'approved',
    })
    setSaving(false)
    setForm({ title: '', description: '', image_url: '', normal_price: '', subscriber_price: '', valid_until: '', quantity: '' })
    load()

    // Produto com preço de verdade e parceiro ainda sem subconta Asaas:
    // tenta vincular agora (melhor esforço — se faltar dado ou falhar,
    // não trava nada, o produto já foi salvo; venda cai na carteira
    // interna até ficar vinculado).
    if (Number(form.subscriber_price) > 0 && partner && !partner.asaas_wallet_id) {
      const { data: sessionData } = await supabase.auth.getSession()
      supabase.functions.invoke('asaas-create-subaccount', {
        body: { partner_id: partner.id },
        headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
      }).catch(() => null)
    }
  }

  async function remove(id: string) {
    if (!window.confirm('Excluir este produto? Essa ação não pode ser desfeita.')) return
    setDeleting(id)
    await supabase.from('promotions').delete().eq('id', id)
    setDeleting(null)
    load()
  }

  async function saveQty(id: string) {
    await supabase.from('promotions').update({ quantity: Math.max(0, Number(editQty || 0)) }).eq('id', id)
    setEditingQtyId(null)
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Produtos e descontos</h1>
        <p className="text-white/50 text-sm">Cadastre produtos com preço normal e preço assinante. Publicados aqui ficam visíveis para assinantes imediatamente.</p>
      </div>

      <form onSubmit={handleSubmit} className="card grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <ImageUpload value={form.image_url || null} onChange={(url) => setForm({ ...form, image_url: url })} folder="promotions" label="Foto do produto" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Nome do produto</label>
          <input className="input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Descrição</label>
          <input className="input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </div>
        <div>
          <label className="label">Preço normal</label>
          <input className="input" type="number" step="0.01" value={form.normal_price} onChange={(e) => setForm({ ...form, normal_price: e.target.value })} />
        </div>
        <div>
          <label className="label">Preço assinante</label>
          <input className="input" type="number" step="0.01" value={form.subscriber_price} onChange={(e) => setForm({ ...form, subscriber_price: e.target.value })} />
        </div>
        <div>
          <label className="label">Quantidade em estoque</label>
          <input className="input" type="number" min="0" placeholder="0" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Válida até</label>
          <input className="input" type="date" required value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
        </div>
        <button type="submit" disabled={saving} className="btn-gold sm:col-span-2">{saving ? 'Publicando...' : 'Publicar produto'}</button>
      </form>

      <div className="space-y-2">
        {promotions.map((p) => (
          <div key={p.id} className="card flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {p.image_url && <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{p.title}</p>
                <p className="text-xs text-white/40">Válida até {formatDate(p.valid_until)}</p>
                {editingQtyId === p.id ? (
                  <div className="flex items-center gap-1.5 mt-1">
                    <input className="input !py-1 !px-2 !text-xs !w-20" type="number" min="0" value={editQty} onChange={(e) => setEditQty(e.target.value)} autoFocus />
                    <button onClick={() => saveQty(p.id)} className="btn-gold !py-1 !px-2 text-xs">Salvar</button>
                    <button onClick={() => setEditingQtyId(null)} className="btn-ghost !py-1 !px-2 text-xs">Cancelar</button>
                  </div>
                ) : (
                  <button onClick={() => { setEditingQtyId(p.id); setEditQty(String(p.quantity)) }} className="text-xs text-white/40 mt-0.5">
                    Estoque: <span className={`font-semibold ${!p.quantity ? 'text-red-400' : p.quantity <= 5 ? 'text-gold-300' : 'text-emerald-400'}`}>{p.quantity}</span>
                  </button>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={p.status} />
              <button
                onClick={() => remove(p.id)}
                disabled={deleting === p.id}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition"
                aria-label="Excluir produto"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!promotions.length && <EmptyState dark icon={Percent} title="Nenhum produto cadastrado" description="Publique o primeiro produto no formulário acima." />}
      </div>
    </div>
  )
}
