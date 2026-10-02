import { useEffect, useState, type FormEvent } from 'react'
import { Gift, Pause, Pencil, Play, X } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { ProductRow } from '../../lib/types'
import { formatBRL } from '../../lib/format'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'

// Comissionamento da rede de consumo é sempre 1% por nível em 4 níveis
// (ver award_referral_bonuses no banco) — 4% fixo, não configurável por
// produto.
const NETWORK_COMMISSION_PCT = 4

const emptyForm = { name: '', description: '', normal_price: '', discount_pct: '', subscriber_discount_pct: '', image_url: '' }

export default function PartnerProducts() {
  const { partner } = useAuth()
  const [products, setProducts] = useState<ProductRow[]>([])
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  async function load() {
    if (!partner) return
    const { data } = await supabase.from('products').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false })
    setProducts((data as ProductRow[]) ?? [])
  }

  useEffect(() => { load() }, [partner])

  const normalPrice = Number(form.normal_price || 0)
  const discountPct = Math.min(50, Math.max(0, Number(form.discount_pct || 0)))
  const subscriberDiscountPct = Math.max(0, Number(form.subscriber_discount_pct || 0))
  const netProfitPct = discountPct - subscriberDiscountPct - NETWORK_COMMISSION_PCT
  const usesPricingRule = discountPct > 0
  const subscriberPrice = normalPrice * (1 - subscriberDiscountPct / 100)
  const commissionValue = usesPricingRule ? (normalPrice * NETWORK_COMMISSION_PCT) / 100 : 0
  const netProfitValue = usesPricingRule ? (normalPrice * netProfitPct) / 100 : 0
  const poolInvalid = usesPricingRule && subscriberDiscountPct + NETWORK_COMMISSION_PCT > discountPct

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!partner) return
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
      : await supabase.from('products').insert({ ...payload, partner_id: partner.id, is_gift: true, approved: false })

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
      name: p.name,
      description: p.description ?? '',
      normal_price: String(p.normal_price),
      discount_pct: String(p.discount_pct),
      subscriber_discount_pct: String(p.subscriber_discount_pct),
      image_url: p.image_url ?? '',
    })
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function cancelEdit() {
    setEditingId(null)
    setForm(emptyForm)
    setError(null)
  }

  async function toggleActive(p: ProductRow) {
    await supabase.from('products').update({ active: !p.active }).eq('id', p.id)
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Produtos cadastrados</h1>
        <p className="text-white/50 text-sm">Cadastre os brindes disponíveis para retirada no seu estabelecimento. Novos brindes e alterações passam por aprovação da administração antes de ficarem visíveis.</p>
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

        <div className="sm:col-span-2 rounded-lg bg-ink-950 border border-ink-800 p-3 space-y-1.5 text-sm">
          <div className="flex items-center justify-between"><span className="text-white/50">Valor de venda para o assinante</span><span className="font-semibold">{formatBRL(subscriberPrice)}</span></div>
          <div className="flex items-center justify-between"><span className="text-white/50">Comissionamento rede de consumo (4 níveis, 1% cada)</span><span className="font-semibold text-gold-400">{usesPricingRule ? formatBRL(commissionValue) : '—'}</span></div>
          <div className="flex items-center justify-between"><span className="text-white/50">Lucro líquido Brinde Mais</span><span className={`font-semibold ${poolInvalid ? 'text-red-400' : ''}`}>{usesPricingRule ? `${netProfitPct.toFixed(2)}% · ${formatBRL(netProfitValue)}` : '—'}</span></div>
          {!usesPricingRule && <p className="text-xs text-white/30">Sem desconto Brinde Mais definido: o assinante paga o valor cheio e este brinde não gera comissão de consumo na retirada.</p>}
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
            {p.discount_pct > 0 && (
              <p className="text-xs text-white/30 mt-1">Desconto Brinde Mais {p.discount_pct}% · comissão de consumo ativa</p>
            )}
            <div className="flex gap-2 mt-3 pt-3 border-t border-ink-800">
              <button onClick={() => startEdit(p)} className="btn-dark flex-1 !py-2 text-xs gap-1.5"><Pencil size={12} /> Editar</button>
              <button onClick={() => toggleActive(p)} className="btn-dark flex-1 !py-2 text-xs gap-1.5">
                {p.active ? <><Pause size={12} /> Pausar</> : <><Play size={12} /> Reativar</>}
              </button>
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
