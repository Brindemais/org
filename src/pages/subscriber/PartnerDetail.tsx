import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ChevronLeft, Clock, Gift, MapPin, Percent, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner, Promotion, ProductRow } from '../../lib/types'
import { useSubscription } from '../../hooks/useSubscription'
import { formatBRL, formatDate } from '../../lib/format'
import { PARTNER_CATEGORIES } from '../../lib/types'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

type DetailPartner = Pick<Partner, 'id' | 'trade_name' | 'category' | 'address' | 'neighborhood' | 'city' | 'state' | 'opening_hours' | 'logo_url' | 'whatsapp'>

export default function SubscriberPartnerDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { subscription, pickup, benefitsBlocked, reload } = useSubscription()
  const [partner, setPartner] = useState<DetailPartner | null>(null)
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [gifts, setGifts] = useState<ProductRow[]>([])
  const [hasStock, setHasStock] = useState(false)
  const [loading, setLoading] = useState(true)
  const [choosing, setChoosing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      supabase.from('partners').select('id, trade_name, category, address, neighborhood, city, state, opening_hours, logo_url, whatsapp').eq('id', id).maybeSingle(),
      supabase.from('promotions').select('*').eq('partner_id', id).eq('status', 'approved').gte('valid_until', new Date().toISOString().slice(0, 10)).order('created_at', { ascending: false }),
      supabase.from('products').select('*').eq('partner_id', id).eq('active', true).eq('approved', true).order('is_gift', { ascending: false }),
      // Same rule as Benefícios: a partner without brinde stock can't be
      // chosen as a pickup point, so the button below reflects that instead
      // of only failing after the fact.
      supabase.from('stock_partner').select('quantity').eq('partner_id', id).gt('quantity', 0).limit(1),
    ]).then(([{ data: p }, { data: promos }, { data: prods }, { data: stock }]) => {
      setPartner(p as DetailPartner | null)
      setPromotions((promos as Promotion[]) ?? [])
      setGifts((prods as ProductRow[]) ?? [])
      setHasStock(!!stock?.length)
      setLoading(false)
    })
  }, [id])

  async function choosePartner() {
    if (!subscription || !id) return
    setChoosing(true)
    setError(null)
    const { error: rpcError } = await supabase.rpc('choose_pickup_partner', {
      p_subscription_id: subscription.id,
      p_partner_id: id,
    })
    setChoosing(false)
    if (rpcError) {
      const map: Record<string, string> = {
        PARTNER_OUT_OF_STOCK: 'Este parceiro está sem brindes disponíveis no momento.',
        PICKUP_ALREADY_CHOSEN: 'Você já escolheu um ponto de retirada neste ciclo.',
        SUBSCRIPTION_NOT_ACTIVE: 'Sua assinatura precisa estar ativa para escolher a retirada.',
      }
      setError(map[rpcError.message] ?? 'Não foi possível reservar este parceiro.')
      return
    }
    await reload()
    navigate('/app/retirada')
  }

  if (loading) return <LoadingState dark label="Carregando estabelecimento..." />
  if (!partner) {
    return <EmptyState dark icon={MapPin} title="Parceiro não encontrado" description="Esse estabelecimento pode ter saído da rede." />
  }

  return (
    <div className="space-y-6">
      <Link to="/app/parceiros" className="inline-flex items-center gap-1 text-sm text-white/50 hover:text-white">
        <ChevronLeft size={16} /> Parceiros
      </Link>

      <div className="card flex items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-gold-gradient p-[1.5px] shrink-0">
          <div className="w-full h-full rounded-full bg-ink-800 flex items-center justify-center font-display text-gold-400 font-semibold text-lg overflow-hidden">
            {partner.logo_url ? <img src={partner.logo_url} alt="" className="w-full h-full object-cover" /> : partner.trade_name.slice(0, 2).toUpperCase()}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="font-display text-lg font-semibold truncate">{partner.trade_name}</h1>
          <p className="text-xs text-gold-400 font-medium">{PARTNER_CATEGORIES.find((c) => c.value === partner.category)?.label ?? partner.category}</p>
          <p className="text-xs text-white/40 flex items-center gap-1 mt-1">
            <MapPin size={11} /> {partner.address}, {partner.neighborhood}, {partner.city}/{partner.state}
          </p>
          {partner.opening_hours && <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5"><Clock size={11} /> {partner.opening_hours}</p>}
          {partner.whatsapp && <p className="text-xs text-white/40 flex items-center gap-1 mt-0.5"><Phone size={11} /> {partner.whatsapp}</p>}
        </div>
      </div>

      {error && <p className="text-xs bg-red-500/10 text-red-400 rounded-lg px-3 py-2">{error}</p>}

      {!benefitsBlocked && subscription && !pickup && hasStock && (
        <button onClick={choosePartner} disabled={choosing} className="btn-gold w-full">
          {choosing ? 'Reservando...' : 'Retirar meu brinde do mês aqui'}
        </button>
      )}
      {!benefitsBlocked && subscription && !pickup && !hasStock && !loading && (
        <p className="text-xs bg-white/5 text-white/50 rounded-lg px-3 py-2 text-center">
          Este parceiro está sem brindes em estoque no momento. Escolha outro na lista de parceiros.
        </p>
      )}
      {pickup && pickup.partner_id === partner.id && (
        <p className="text-xs bg-gold-400/10 text-gold-300 rounded-lg px-3 py-2 text-center">Você já reservou seu brinde deste mês aqui.</p>
      )}

      {promotions.length > 0 && (
        <section>
          <p className="font-semibold mb-3 flex items-center gap-1.5"><Percent size={16} className="text-gold-400" /> Descontos e promoções</p>
          <div className="space-y-2">
            {promotions.map((p) => (
              <div key={p.id} className="card !bg-ink-900">
                {p.image_url && <img src={p.image_url} alt="" className="w-full h-28 rounded-lg object-cover mb-2" />}
                <p className="font-semibold text-sm mb-1">{p.title}</p>
                {p.description && <p className="text-xs text-white/50 mb-2">{p.description}</p>}
                <div className="flex items-center justify-between">
                  <div className="flex items-baseline gap-2">
                    {!!p.normal_price && <span className="text-xs line-through text-white/30">{formatBRL(p.normal_price)}</span>}
                    {!!p.subscriber_price && <span className="text-gold-400 font-bold text-sm">{formatBRL(p.subscriber_price)}</span>}
                    {!p.normal_price && !p.subscriber_price && !!p.discount_pct && (
                      <span className="text-gold-400 font-bold text-sm">{p.discount_pct}% OFF</span>
                    )}
                  </div>
                  <span className="text-[11px] text-white/30">Válida até {formatDate(p.valid_until)}</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {gifts.length > 0 && (
        <section>
          <p className="font-semibold mb-3 flex items-center gap-1.5"><Gift size={16} className="text-gold-400" /> Brindes e produtos</p>
          <div className="grid grid-cols-2 gap-3">
            {gifts.map((g) => (
              <div key={g.id} className="card !p-3">
                <div className="aspect-square rounded-lg bg-ink-950 border border-ink-800 mb-2 overflow-hidden flex items-center justify-center">
                  {g.image_url ? <img src={g.image_url} alt={g.name} className="w-full h-full object-cover" /> : <Gift size={20} className="text-white/15" />}
                </div>
                <p className="text-xs font-medium truncate">{g.name}</p>
                {g.is_gift ? (
                  <p className="text-[11px] text-gold-400 font-semibold mt-0.5">Brinde da comunidade</p>
                ) : (
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-[11px] line-through text-white/30">{formatBRL(g.normal_price)}</span>
                    <span className="text-xs text-gold-400 font-bold">{formatBRL(g.subscriber_price)}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {!promotions.length && !gifts.length && (
        <EmptyState dark icon={Percent} title="Sem benefícios cadastrados no momento" description="Esse parceiro ainda não publicou promoções ou brindes." />
      )}
    </div>
  )
}
