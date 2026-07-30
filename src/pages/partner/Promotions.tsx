import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Promotion } from '../../lib/types'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { formatDate } from '../../lib/format'

export default function PartnerPromotions() {
  const { partner } = useAuth()
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [form, setForm] = useState({ title: '', description: '', normal_price: '', subscriber_price: '', valid_until: '' })
  const [saving, setSaving] = useState(false)

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
      normal_price: Number(form.normal_price || 0),
      subscriber_price: Number(form.subscriber_price || 0),
      valid_until: form.valid_until,
    })
    setSaving(false)
    setForm({ title: '', description: '', normal_price: '', subscriber_price: '', valid_until: '' })
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Promoções e descontos</h1>
        <p className="text-white/50 text-sm">Novas promoções passam por aprovação da administração antes de ficarem visíveis.</p>
      </div>

      <form onSubmit={handleSubmit} className="card grid sm:grid-cols-2 gap-3">
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
        <button type="submit" disabled={saving} className="btn-gold sm:col-span-2">{saving ? 'Enviando...' : 'Enviar para aprovação'}</button>
      </form>

      <div className="space-y-2">
        {promotions.map((p) => (
          <div key={p.id} className="card flex items-center justify-between">
            <div>
              <p className="font-medium text-sm">{p.title}</p>
              <p className="text-xs text-white/40">Válida até {formatDate(p.valid_until)}</p>
            </div>
            <StatusBadge status={p.status} />
          </div>
        ))}
        {!promotions.length && <p className="text-sm text-white/40 text-center py-8">Nenhuma promoção cadastrada.</p>}
      </div>
    </div>
  )
}
