import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Percent, Phone, Search, LocateFixed, ShoppingBag } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import type { Partner } from '../../lib/types'
import { PARTNER_CATEGORIES } from '../../lib/types'
import { useGeolocation } from '../../hooks/useGeolocation'
import { haversineKm, formatDistance } from '../../lib/geo'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

// Mesma rede de parceiros que o assinante vê em "Produtos e descontos"
// (src/pages/subscriber/Partners.tsx) — o parceiro, como comerciante,
// também pode comprar produto de outro parceiro da rede, com desconto.
// Só não aparece o próprio parceiro logado na lista (não tem sentido
// comprar de si mesmo).
type DirectoryPartner = Pick<Partner, 'id' | 'trade_name' | 'category' | 'neighborhood' | 'logo_url' | 'opening_hours' | 'address' | 'city' | 'state' | 'whatsapp' | 'lat' | 'lng'>

export default function PartnerNetwork() {
  const { partner } = useAuth()
  const [partners, setPartners] = useState<DirectoryPartner[]>([])
  const [promoCounts, setPromoCounts] = useState<Record<string, number>>({})
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const geo = useGeolocation()

  useEffect(() => {
    setLoading(true)
    let query = supabase.rpc('list_public_partners').select('id, trade_name, category, neighborhood, logo_url, opening_hours, address, city, state, whatsapp, lat, lng')
    if (category) query = query.eq('category', category)
    query.then(({ data }) => {
      const list = ((data as DirectoryPartner[]) ?? []).filter((p) => p.id !== partner?.id)
      setPartners(list)
      setLoading(false)
    })

    supabase.from('promotions').select('partner_id').eq('status', 'approved').gte('valid_until', new Date().toISOString().slice(0, 10)).gt('quantity', 0)
      .then(({ data }) => {
        const counts: Record<string, number> = {}
        for (const p of data ?? []) counts[p.partner_id] = (counts[p.partner_id] ?? 0) + 1
        setPromoCounts(counts)
      })
  }, [category, partner?.id])

  const filtered = useMemo(() => {
    const list = partners.filter((p) => !!promoCounts[p.id] && p.trade_name.toLowerCase().includes(search.toLowerCase()))
    const withDistance = list.map((p) => ({
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
  }, [partners, promoCounts, search, geo])

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Parceiros</h1>
          <p className="text-sm text-white/50 mt-1">Compre produtos com desconto de outros parceiros da rede Brinde Mais.</p>
        </div>
        <Link to="/parceiro/compras" className="btn-dark !px-3 !py-2 text-xs gap-1.5 shrink-0"><ShoppingBag size={14} /> Minhas compras</Link>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input className="input !pl-9" placeholder="Buscar parceiro..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {geo.status === 'denied' && (
        <p className="text-xs text-white/40 flex items-center gap-1.5"><LocateFixed size={13} /> Ative a localização do navegador para ver a distância até cada parceiro.</p>
      )}
      {geo.status === 'granted' && (
        <p className="text-xs text-gold-400 flex items-center gap-1.5"><LocateFixed size={13} /> Mostrando parceiros ordenados por proximidade.</p>
      )}

      <div className="flex gap-2 overflow-x-auto pb-1">
        <button onClick={() => setCategory('')} className={`shrink-0 pill ${!category ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-900 text-white/50'}`}>Todos</button>
        {PARTNER_CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setCategory(c.value)} className={`shrink-0 pill ${category === c.value ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-900 text-white/50'}`}>
            {c.label}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {loading && <LoadingState dark label="Carregando parceiros..." />}
        {!loading && filtered.map(({ partner: p, distanceKm }) => (
          <Link key={p.id} to={`/parceiro/parceiros/${p.id}`} className="card block active:scale-[0.99] transition">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-gold-gradient p-[1.5px] shrink-0">
                <div className="w-full h-full rounded-full bg-ink-800 flex items-center justify-center font-display text-gold-400 font-semibold overflow-hidden">
                  {p.logo_url ? <img src={p.logo_url} alt="" className="w-full h-full object-cover" /> : p.trade_name.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium text-sm truncate">{p.trade_name}</p>
                <p className="text-xs text-white/40">{PARTNER_CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}</p>
              </div>
              {distanceKm != null && <span className="pill bg-gold-400/15 text-gold-300 shrink-0">{formatDistance(distanceKm)}</span>}
            </div>
            <p className="text-xs text-white/50 flex items-center gap-1.5 mb-1"><MapPin size={12} /> {p.address}, {p.neighborhood}, {p.city}/{p.state}</p>
            {p.opening_hours && <p className="text-xs text-white/40 mb-1">{p.opening_hours}</p>}
            {p.whatsapp && <p className="text-xs text-white/40 flex items-center gap-1.5 mb-1"><Phone size={12} /> {p.whatsapp}</p>}
            {!!promoCounts[p.id] && (
              <p className="text-[11px] font-semibold text-gold-400 flex items-center gap-1 mt-1">
                <Percent size={11} /> {promoCounts[p.id]} {promoCounts[p.id] === 1 ? 'produto com desconto' : 'produtos com desconto'}
              </p>
            )}
          </Link>
        ))}
        {!loading && !filtered.length && (
          <EmptyState dark icon={MapPin} title="Nenhum parceiro com produto no momento" description="Volte mais tarde ou tente outra categoria." />
        )}
      </div>
    </div>
  )
}
