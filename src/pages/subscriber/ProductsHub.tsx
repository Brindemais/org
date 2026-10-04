import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { MapPin, Percent, LocateFixed, Search } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner } from '../../lib/types'
import { useGeolocation } from '../../hooks/useGeolocation'
import { haversineKm, formatDistance } from '../../lib/geo'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

// Separado de Benefícios (brinde) de propósito — brinde é o benefício sem
// custo da assinatura, produto é algo com preço real que o parceiro vende
// com desconto pro assinante. Só lista parceiro que tem pelo menos um
// produto aprovado com estoque, igual a regra equivalente pro brinde.
type HubPartner = Pick<Partner, 'id' | 'trade_name' | 'category' | 'neighborhood' | 'city' | 'logo_url' | 'lat' | 'lng'>
interface PromoRow { partner_id: string; quantity: number }

export default function SubscriberProductsHub() {
  const [partners, setPartners] = useState<HubPartner[]>([])
  const [promoCounts, setPromoCounts] = useState<Record<string, number>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const geo = useGeolocation()

  useEffect(() => {
    setLoading(true)
    Promise.all([
      supabase.rpc('list_public_partners').select('id, trade_name, category, neighborhood, city, logo_url, lat, lng'),
      supabase.from('promotions').select('partner_id, quantity').eq('status', 'approved').gte('valid_until', new Date().toISOString().slice(0, 10)).gt('quantity', 0),
    ]).then(([{ data: p }, { data: promos }]) => {
      setPartners((p as HubPartner[]) ?? [])
      const counts: Record<string, number> = {}
      for (const row of (promos as PromoRow[]) ?? []) counts[row.partner_id] = (counts[row.partner_id] ?? 0) + 1
      setPromoCounts(counts)
      setLoading(false)
    })
  }, [])

  const sorted = useMemo(() => {
    const withOffers = partners.filter((p) => promoCounts[p.id] > 0 && p.trade_name.toLowerCase().includes(search.toLowerCase()))
    const withDistance = withOffers.map((p) => ({
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
      <div>
        <h1 className="font-display text-xl font-semibold">Produtos e descontos</h1>
        <p className="text-sm text-white/50 mt-1">Escolha um parceiro próximo e veja o catálogo de produtos com preço de assinante.</p>
      </div>

      <div className="relative">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
        <input className="input !pl-9" placeholder="Buscar parceiro..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      {geo.status === 'denied' && (
        <p className="text-xs text-white/40 flex items-center gap-1.5"><LocateFixed size={13} /> Ative a localização do navegador pra ver a distância até cada parceiro.</p>
      )}

      <div className="space-y-3">
        {loading && <LoadingState dark label="Carregando parceiros..." />}
        {!loading && sorted.map(({ partner: p, distanceKm }) => (
          <Link key={p.id} to={`/app/produtos/${p.id}`} className="card flex items-center gap-3 active:scale-[0.99] transition">
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
              <p className="text-[11px] font-semibold text-gold-400 flex items-center gap-1 mt-1">
                <Percent size={11} /> {promoCounts[p.id]} {promoCounts[p.id] === 1 ? 'produto com desconto' : 'produtos com desconto'}
              </p>
            </div>
          </Link>
        ))}
        {!loading && !sorted.length && (
          <EmptyState dark icon={Percent} title="Nenhum produto disponível no momento" description="Volte mais tarde ou tente outra busca." />
        )}
      </div>
    </div>
  )
}
