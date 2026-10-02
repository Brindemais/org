import { useEffect, useState, type FormEvent } from 'react'
import { Gift } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner } from '../../lib/types'
import { ImageUpload } from '../../components/ui/ImageUpload'

const emptyGift = { partner_id: '', name: '', description: '', image_url: '', normal_price: '' }

// Cadastro de brinde em nome de um parceiro pelo admin — pro parceiro que
// pede por telefone/WhatsApp em vez de usar o próprio painel. Entra já
// aprovado (approved: true), sem passar pela fila de aprovação de
// /admin/estoque. O parceiro ainda precisa entrar em "Estoque" no painel
// dele pra informar a quantidade disponível — a RLS de stock_partner
// exige partner_staff, admin não tem acesso a isso de propósito.
export default function AdminRegisterGift() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [gift, setGift] = useState(emptyGift)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    supabase.from('partners').select('*').in('status', ['approved', 'active']).order('trade_name')
      .then(({ data }) => setPartners((data as Partner[]) ?? []))
  }, [])

  async function createGift(e: FormEvent) {
    e.preventDefault()
    if (!gift.partner_id) return
    setSaving(true)
    setMsg('')
    const price = Number(gift.normal_price || 0)
    const { error } = await supabase.from('products').insert({
      partner_id: gift.partner_id,
      name: gift.name,
      description: gift.description || null,
      image_url: gift.image_url || null,
      normal_price: price,
      subscriber_price: price,
      is_gift: true,
      approved: true,
    })
    setSaving(false)
    if (error) { setMsg('Não foi possível cadastrar o brinde.'); return }
    setGift(emptyGift)
    setMsg('Brinde cadastrado e já aprovado! O parceiro precisa entrar em "Estoque" no painel dele e adicionar a quantidade disponível.')
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Gift size={22} className="text-gold-400" /> Cadastrar brinde</h1>
        <p className="text-white/50 text-sm">Cadastre um brinde em nome de um parceiro (ex: pedido combinado por telefone ou WhatsApp). Entra já aprovado, sem passar pela fila de aprovação.</p>
      </div>

      <form onSubmit={createGift} className="card grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <ImageUpload value={gift.image_url || null} onChange={(url) => setGift({ ...gift, image_url: url })} folder="products" label="Foto do brinde" hint="Tamanho recomendado: 800x450px (16:9), até 4MB." />
        </div>
        <select className="input sm:col-span-2" required value={gift.partner_id} onChange={(e) => setGift({ ...gift, partner_id: e.target.value })}>
          <option value="">Parceiro...</option>
          {partners.map((p) => <option key={p.id} value={p.id}>{p.trade_name}</option>)}
        </select>
        <input className="input" required placeholder="Nome do brinde" value={gift.name} onChange={(e) => setGift({ ...gift, name: e.target.value })} />
        <input className="input" type="number" step="0.01" min="0" placeholder="Valor (R$)" value={gift.normal_price} onChange={(e) => setGift({ ...gift, normal_price: e.target.value })} />
        <input className="input sm:col-span-2" placeholder="Descrição" value={gift.description} onChange={(e) => setGift({ ...gift, description: e.target.value })} />
        <button type="submit" disabled={saving} className="btn-gold sm:col-span-2">{saving ? 'Salvando...' : 'Cadastrar brinde'}</button>
        {msg && <p className="text-xs text-gold-300 sm:col-span-2">{msg}</p>}
      </form>
    </div>
  )
}
