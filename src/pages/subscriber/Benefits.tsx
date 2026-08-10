import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Lock, MapPin, Percent, Store, LocateFixed } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner, Promotion } from '../../lib/types'
import { useSubscription } from '../../hooks/useSubscription'
import { PARTNER_CATEGORIES } from '../../lib/types'
import { useGeolocation } from '../../hooks/useGeolocation'
import { haversineKm, formatDistance } from '../../lib/geo'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

// Only the columns this card grid renders — see the same note in Partners.tsx.
type BenefitPartner = Pick<Partner, 'id' | 'trade_name' | 'category' | 'neighborhood' | 'city' | 'logo_url' | 'lat' | 'lng'>

export default function SubscriberBenefits() {
  const { subscription, pickup, reload, benefitsBlocked } = useSubscription()
  const [partners, setPartners] = useState<BenefitPartner[]>([])
  const [inStockIds, setInStockIds] = useState<Set<string> | null>(null)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [category, setCategory] = useState<string>('')
  const [choosing, setChoosing] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()
  const geo = useGeolocation()

  useEffect(() => {
    setLoading(true)
    let query = supabase.from('partners').select('id, trade_name, category, neighborhood, city, logo_url, lat, lng').in('status', ['approved', 'active'])
    if (category) query = query.eq('category', category)
    query.then(({ data }) => { setPartners((data as BenefitPartner[]) ?? []); setLoading(false) })
    supabase.from('promotions').select('*').eq('status', 'approved').gte('valid_until', new Date().toISOString().slice(0, 10)).then(({ data }) => setPromotions((data as Promotion[]) ?? []))
    // Only partners with at least one brinde in stock can be chosen as a
    // pickup point — filtering them out here (instead of only rejecting at
    // confirm time) is what actually satisfies "não deixar escolher parceiro
    // sem estoque".
    supabase.from('stock_partner').select('partner_id, quantity').gt('quantity', 0)
      .then(({ data }) => setInStockIds(new Set((data ?? []).map((s) => s.partner_id))))
  }, [category])

  const sortedPartners = useMemo(() => {
    const available = inStockIds ? partners.filter((p) => inStockIds.has(p.id)) : partners
    const withDistance = available.map((p) => ({
      partner: p,
      distanceKm: geo.status === 'granted' && p.lat != null && p.lng != null ? haversineKm(geo.lat!, geo.lng!, p.lat, p.lng) : null,
    }))
    withDistance.sort((a, b) => {
      if (a.distanceKm == null && b.distanceKm == null) return 0
      if (a.distanceKm == null) return 1
      if (b.distanceKm == null) return -1
      return a.distanceKm - b.distanceKm
    })
    return withDistance
  }, [partners, geo, inStockIds])

  const outOfStockCount = inStockIds ? partners.length - sortedPartners.length : 0

  async function choosePartner(partnerId: string) {
    if (!subscription || benefitsBlocked) return
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

  if (benefitsBlocked && subscription) {
    return (
      <div className="space-y-6">
        <h1 className="font-display text-xl font-semibold">Benefícios</h1>
        <div className="card border-red-500/30 bg-red-500/5 text-center py-8">
          <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-3">
            <Lock size={20} className="text-red-400" />
          </div>
          <p className="font-semibold mb-1">Benefícios suspensos</p>
          <p className="text-sm text-white/50 mb-4 max-w-xs mx-auto">
            Sua assinatura venceu e o acesso a brindes, descontos e promoções fica pausado até a confirmação de um novo pagamento.
          </p>
          <Link to="/app/assinatura" className="btn-gold w-full max-w-xs mx-auto">Renovar agora</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-xl font-semibold">Benefícios</h1>

      {promotions.length > 0 && (
        <section>
          <p className="font-semibold mb-3 flex items-center gap-1.5"><Percent size={16} className="text-gold-400" /> Descontos e promoções</p>
          <div className="flex gap-3 overflow-x-auto -mx-4 px-4 pb-1">
            {promotions.map((p) => (
              <Link key={p.id} to={`/app/parceiros/${p.partner_id}`} className="shrink-0 w-56 card !bg-ink-900 block active:scale-[0.99] transition">
                <p className="font-semibold text-sm mb-1">{p.title}</p>
                <p className="text-xs text-white/50 mb-2">{p.description}</p>
                <div className="flex items-baseline gap-2">
                  {p.normal_price && <span className="text-xs line-through text-white/30">R$ {p.normal_price.toFixed(2)}</span>}
                  {p.subscriber_price && <span className="text-gold-400 font-bold text-sm">R$ {p.subscriber_price.toFixed(2)}</span>}
                </div>
              </Link>
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
        {geo.status === 'denied' && (
          <p className="text-xs text-white/40 flex items-center gap-1.5 mb-3"><LocateFixed size={13} /> Ative a localização para ver a distância até cada parceiro.</p>
        )}

        <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-3">
          <button onClick={() => setCategory('')} className={`shrink-0 pill ${!category ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-900 text-white/50'}`}>Todos</button>
          {PARTNER_CATEGORIES.map((c) => (
            <button key={c.value} onClick={() => setCategory(c.value)} className={`shrink-0 pill ${category === c.value ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-900 text-white/50'}`}>
              {c.label}
            </button>
          ))}
        </div>

        <div className="space-y-3">
          {loading && <LoadingState dark label="Carregando parceiros..." />}
          {!loading && sortedPartners.map(({ partner: p, distanceKm }) => (
            <div key={p.id} className="card flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-gold-gradient p-[1.5px] shrink-0">
                <div className="w-full h-full rounded-full bg-ink-800 flex items-center justify-center font-display text-gold-400 font-semibold overflow-hidden">
                  {p.logo_url ? <img src={p.logo_url} alt="" className="w-full h-full object-cover" /> : p.trade_name.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{p.trade_name}</p>
                <p className="text-xs text-white/40 flex items-center gap-1">
                  <MapPin size={11} /> {p.neighborhood ?? p.city}{distanceKm != null && ` · ${formatDistance(distanceKm)}`}
                </p>
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
          {!loading && !sortedPartners.length && (
            <EmptyState dark icon={Store} title="Nenhum parceiro encontrado" description="Tente outra categoria ou volte mais tarde." />
          )}
          {!loading && outOfStockCount > 0 && (
            <p className="text-xs text-white/30 text-center pt-1">
              {outOfStockCount} parceiro{outOfStockCount === 1 ? '' : 's'} sem brinde em estoque no momento não {outOfStockCount === 1 ? 'aparece' : 'aparecem'} aqui.
            </p>
          )}
        </div>
      </section>
    </div>
  )
}
