import { useEffect, useState, type FormEvent } from 'react'
import { Percent, Trash2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Promotion } from '../../lib/types'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { formatDate } from '../../lib/format'

export default function PartnerPromotions() {
  const { partner } = useAuth()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [form, setForm] = useState({ title: '', description: '', image_url: '', normal_price: '', subscriber_price: '', valid_until: '' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState<string | null>(null)

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
      // Partner-created promotions go live immediately — no admin approval
      // step. The admin panel can still suspend one after the fact if needed.
      status: 'approved',
    })
    setSaving(false)
    setForm({ title: '', description: '', image_url: '', normal_price: '', subscriber_price: '', valid_until: '' })
    load()
  }

  async function remove(id: string) {
    if (!window.confirm('Excluir esta promoção? Essa ação não pode ser desfeita.')) return
    setDeleting(id)
    await supabase.from('promotions').delete().eq('id', id)
    setDeleting(null)
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Promoções e descontos</h1>
        <p className="text-white/50 text-sm">Promoções publicadas aqui ficam visíveis para assinantes imediatamente.</p>
      </div>

      <form onSubmit={handleSubmit} className="card grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <ImageUpload value={form.image_url || null} onChange={(url) => setForm({ ...form, image_url: url })} folder="promotions" label="Foto da promoção" />
        </div>
        <div className="sm:col-span-2">
          <label className="label">Título da promoção</label>
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
        <div className="sm:col-span-2">
          <label className="label">Válida até</label>
          <input className="input" type="date" required value={form.valid_until} onChange={(e) => setForm({ ...form, valid_until: e.target.value })} />
        </div>
        <button type="submit" disabled={saving} className="btn-gold sm:col-span-2">{saving ? 'Publicando...' : 'Publicar promoção'}</button>
      </form>

      <div className="space-y-2">
        {promotions.map((p) => (
          <div key={p.id} className="card flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {p.image_url && <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{p.title}</p>
                <p className="text-xs text-white/40">Válida até {formatDate(p.valid_until)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StatusBadge status={p.status} />
              <button
                onClick={() => remove(p.id)}
                disabled={deleting === p.id}
                className="w-8 h-8 rounded-lg flex items-center justify-center text-white/40 hover:text-red-400 hover:bg-red-500/10 transition"
                aria-label="Excluir promoção"
              >
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!promotions.length && <EmptyState dark icon={Percent} title="Nenhuma promoção cadastrada" description="Publique a primeira promoção no formulário acima." />}
      </div>
    </div>
  )
}
