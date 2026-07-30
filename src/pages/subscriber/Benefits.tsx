import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { MapPin, Percent, Store } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner, Promotion } from '../../lib/types'
import { useSubscription } from '../../hooks/useSubscription'
import { PARTNER_CATEGORIES } from '../../lib/types'

export default function SubscriberBenefits() {
  const { subscription, pickup, reload } = useSubscription()
  const [partners, setPartners] = useState<Partner[]>([])
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [category, setCategory] = useState<string>('')
  const [choosing, setChoosing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    let query = supabase.from('partners').select('*').in('status', ['approved', 'active'])
    if (category) query = query.eq('category', category)
    query.then(({ data }) => setPartners((data as Partner[]) ?? []))
    supabase.from('promotions').select('*').eq('status', 'approved').then(({ data }) => setPromotions((data as Promotion[]) ?? []))
  }, [category])

  async function choosePartner(partnerId: string) {
    if (!subscription) return
    setChoosing(partnerId)
    setError(null)
    const { error: rpcError } = await supabase.rpc('choose_pickup_partner', {
      p_subscription_id: subscription.id,
      p_partner_id: partnerId,
    })
    setChoosing(null)
    if (rpcError) {
      const map: Record<string, string> = {
        PARTNER_OUT_OF_STOCK: 'Este parceiro está sem brindes disponíveis no momento. Escolha outro.',
        PICKUP_ALREADY_CHOSEN: 'Você já escolheu um ponto de retirada neste ciclo.',
        SUBSCRIPTION_NOT_ACTIVE: 'Sua assinatura precisa estar ativa para escolher a retirada.',
      }
      setError(map[rpcError.message] ?? 'Não foi possível reservar este parceiro.')
      return
    }
    await reload()
    navigate('/app/retirada')
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-semibold">Benefícios</h1>

      {promotions.length > 0 && (
        <section>
          <p className="font-semibold mb-3 flex items-center gap-1.5"><Percent size={16} className="text-gold-400" /> Descontos e promoções</p>
          <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1">
            {promotions.map((p) => (
              <div key={p.id} className="shrink-0 w-56 card !bg-ink-900">
                <p className="font-semibold text-sm mb-1">{p.title}</p>
                <p className="text-xs text-white/50 mb-2">{p.description}</p>
                <div className="flex items-baseline gap-2">
                  {p.normal_price && <span className="text-xs line-through text-white/30">R$ {p.normal_price.toFixed(2)}</span>}
                  {p.subscriber_price && <span className="text-gold-400 font-bold text-sm">R$ {p.subscriber_price.toFixed(2)}</span>}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold flex items-center gap-1.5"><Store size={16} className="text-gold-400" /> Escolha seu ponto de retirada</p>
        </div>

        {pickup && <p className="text-xs bg-gold-400/10 text-gold-300 rounded-lg px-3 py-2 mb-3">Você já possui uma retirada reservada neste ciclo.</p>}
        {!subscription && <p className="text-xs bg-white/5 text-white/50 rounded-lg px-3 py-2 mb-3">Ative sua assinatura para escolher um ponto de retirada.</p>}
        {error && <p className="text-xs bg-red-500/10 text-red-400 rounded-lg px-3 py-2 mb-3">{error}</p>}

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-3">
          <button onClick={() => setCategory('')} className={`shrink-0 pill ${!category ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-900 text-white/50'}`}>Todos</button>
          {PARTNER_CATEGORIES.map((c) => (
            <button key={c.value} onClick={() => setCategory(c.value)} className={`shrink-0 pill ${category === c.value ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-900 text-white/50'}`}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {partners.map((p) => (
            <div key={p.id} className="card flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-ink-800 flex items-center justify-center font-display text-gold-400 font-semibold shrink-0">
                {p.trade_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.trade_name}</p>
                <p className="text-xs text-white/40 flex items-center gap-1"><MapPin size={11} /> {p.neighborhood ?? p.city}</p>
              </div>
              <button
                disabled={!!pickup || !subscription || choosing === p.id}
                onClick={() => choosePartner(p.id)}
                className="btn-gold !px-3 !py-2 text-xs shrink-0"
              >
                {choosing === p.id ? '...' : 'Escolher'}
              </button>
            </div>
          ))}
          {!partners.length && <p className="text-sm text-white/40 text-center py-8">Nenhum parceiro encontrado nesta categoria.</p>}
        </div>
      </section>
    </div>
  )
}
