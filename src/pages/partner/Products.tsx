import { useEffect, useState, type FormEvent } from 'react'
import { Gift } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ProductRow } from '../../lib/types'
import { formatBRL } from '../../lib/format'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'

export default function PartnerProducts() {
  const { partner } = useAuth()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [form, setForm] = useState({ name: '', description: '', normal_price: '', subscriber_price: '', image_url: '' })
  const [saving, setSaving] = useState(false)

  async function load() {
    if (!partner) return
    const { data } = await supabase.from('products').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false })
    setProducts((data as ProductRow[]) ?? [])
  }

  useEffect(() => { load() }, [partner])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!partner) return
    setSaving(true)
    await supabase.from('products').insert({
      partner_id: partner.id,
      name: form.name,
      description: form.description,
      normal_price: Number(form.normal_price || 0),
      subscriber_price: Number(form.subscriber_price || 0),
      image_url: form.image_url || null,
      is_gift: true,
    })
    setSaving(false)
    setForm({ name: '', description: '', normal_price: '', subscriber_price: '', image_url: '' })
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Brindes cadastrados</h1>
        <p className="text-white/50 text-sm">Cadastre os brindes disponíveis para retirada no seu estabelecimento. Novos brindes e alterações passam por aprovação da administração antes de ficarem visíveis.</p>
      </div>

      <form onSubmit={handleSubmit} className="card grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <ImageUpload value={form.image_url || null} onChange={(url) => setForm({ ...form, image_url: url })} folder="products" label="Foto do brinde" />
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
          <label className="label">Preço normal</label>
          <input className="input" type="number" step="0.01" value={form.normal_price} onChange={(e) => setForm({ ...form, normal_price: e.target.value })} />
        </div>
        <div>
          <label className="label">Preço assinante</label>
          <input className="input" type="number" step="0.01" value={form.subscriber_price} onChange={(e) => setForm({ ...form, subscriber_price: e.target.value })} />
        </div>
        <button type="submit" disabled={saving} className="btn-gold sm:col-span-2">{saving ? 'Salvando...' : 'Cadastrar brinde'}</button>
      </form>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {products.map((p) => (
          <div key={p.id} className="card">
            <div className="aspect-video rounded-lg bg-ink-950 border border-ink-800 mb-3 overflow-hidden flex items-center justify-center">
              {p.image_url ? <img src={p.image_url} alt={p.name} className="w-full h-full object-cover" /> : <span className="text-xs text-white/20">Sem foto</span>}
            </div>
            <div className="flex items-center justify-between mb-1">
              <p className="font-semibold">{p.name}</p>
              <StatusBadge status={p.approved ? 'approved' : 'pending_approval'} />
            </div>
            <p className="text-xs text-white/50 mb-2">{p.description}</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xs line-through text-white/30">{formatBRL(p.normal_price)}</span>
              <span className="text-sm font-bold text-gold-400">{formatBRL(p.subscriber_price)}</span>
            </div>
          </div>
        ))}
        {!products.length && (
          <div className="col-span-full">
            <EmptyState dark icon={Gift} title="Nenhum brinde cadastrado ainda" description="Cadastre o primeiro brinde no formulário acima." />
          </div>
        )}
      </div>
    </div>
  )
}
