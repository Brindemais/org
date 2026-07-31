import { useEffect, useMemo, useState } from 'react'
import { MapPin, Phone, Search, LocateFixed } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner } from '../../lib/types'
import { PARTNER_CATEGORIES } from '../../lib/types'
import { useGeolocation } from '../../hooks/useGeolocation'
import { haversineKm, formatDistance } from '../../lib/geo'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

export default function SubscriberPartners() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [category, setCategory] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const geo = useGeolocation()

  useEffect(() => {
    setLoading(true)
    let query = supabase.from('partners').select('*').in('status', ['approved', 'active'])
    if (category) query = query.eq('category', category)
    if (neighborhood) query = query.eq('neighborhood', neighborhood)
    query.then(({ data }) => { setPartners((data as Partner[]) ?? []); setLoading(false) })
  }, [category, neighborhood])

  const neighborhoods = useMemo(() => Array.from(new Set(partners.map((p) => p.neighborhood).filter(Boolean))) as string[], [partners])

  const filtered = useMemo(() => {
    const list = partners.filter((p) => p.trade_name.toLowerCase().includes(search.toLowerCase()))
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
  }, [partners, search, geo])

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">Parceiros próximos</h1>

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

      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        <button onClick={() => setCategory('')} className={`shrink-0 pill ${!category ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-900 text-white/50'}`}>Todos</button>
        {PARTNER_CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setCategory(c.value)} className={`shrink-0 pill ${category === c.value ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-900 text-white/50'}`}>
            {c.label}
          </button>
        ))}
      </div>

      {neighborhoods.length > 1 && (
        <select className="input !py-2 !text-sm" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)}>
          <option value="">Todos os bairros</option>
          {neighborhoods.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      )}

      <div className="space-y-3">
        {loading && <LoadingState dark label="Carregando parceiros..." />}
        {!loading && filtered.map(({ partner: p, distanceKm }) => (
          <div key={p.id} className="card">
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
            {p.whatsapp && <p className="text-xs text-white/40 flex items-center gap-1.5"><Phone size={12} /> {p.whatsapp}</p>}
          </div>
        ))}
        {!loading && !filtered.length && (
          <EmptyState dark icon={MapPin} title="Nenhum parceiro encontrado" description="Tente ajustar a busca, categoria ou bairro." />
        )}
      </div>
    </div>
  )
}
