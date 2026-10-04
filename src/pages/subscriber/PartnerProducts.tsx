import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ChevronLeft, MapPin, Percent } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner, Promotion } from '../../lib/types'
import { formatBRL, formatDate } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { Modal } from '../../components/ui/Modal'

type CatalogPartner = Pick<Partner, 'id' | 'trade_name' | 'neighborhood' | 'city' | 'logo_url'>

export default function SubscriberPartnerProducts() {
  const { id } = useParams<{ id: string }>()
  const [partner, setPartner] = useState<CatalogPartner | null>(null)
  const [products, setProducts] = useState<Promotion[]>([])
  const [loading, setLoading] = useState(true)
  const [zoomed, setZoomed] = useState<Promotion | null>(null)

  useEffect(() => {
    if (!id) return
    setLoading(true)
    Promise.all([
      supabase.rpc('list_public_partners').select('id, trade_name, neighborhood, city, logo_url').eq('id', id).maybeSingle(),
      supabase.from('promotions').select('*').eq('partner_id', id).eq('status', 'approved').order('created_at', { ascending: false }),
    ]).then(([{ data: p }, { data: promos }]) => {
      setPartner(p as CatalogPartner | null)
      setProducts((promos as Promotion[]) ?? [])
      setLoading(false)
    })
  }, [id])

  if (loading) return <LoadingState dark label="Carregando catálogo..." />
  if (!partner) return <EmptyState dark icon={Percent} title="Parceiro não encontrado" />

  return (
    <div className="space-y-4">
      <Link to="/app/produtos" className="text-xs text-white/40 flex items-center gap-1 w-fit"><ChevronLeft size={14} /> Produtos e descontos</Link>

      <div className="flex items-center gap-3">
        <div className="w-14 h-14 rounded-full bg-gold-gradient p-[1.5px] shrink-0">
          <div className="w-full h-full rounded-full bg-ink-800 flex items-center justify-center font-display text-gold-400 font-semibold overflow-hidden">
            {partner.logo_url ? <img src={partner.logo_url} alt="" className="w-full h-full object-cover" /> : partner.trade_name.slice(0, 2).toUpperCase()}
          </div>
        </div>
        <div className="min-w-0">
          <h1 className="font-display text-lg font-semibold truncate">{partner.trade_name}</h1>
          <p className="text-xs text-white/40 flex items-center gap-1"><MapPin size={11} /> {partner.neighborhood ?? partner.city}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {products.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => p.image_url && setZoomed(p)}
            className="card !p-3 text-left"
          >
            <div className="aspect-[4/3] rounded-lg bg-ink-950 border border-ink-800 mb-2 overflow-hidden flex items-center justify-center">
              {p.image_url ? <img src={p.image_url} alt={p.title} className="w-full h-full object-cover" /> : <Percent size={22} className="text-white/15" />}
            </div>
            <p className="text-sm font-medium truncate">{p.title}</p>
            <div className="flex items-baseline gap-1.5 mt-1 flex-wrap">
              {!!p.normal_price && <span className="text-xs line-through text-white/30">{formatBRL(p.normal_price)}</span>}
              {!!p.subscriber_price && <span className="text-sm text-gold-400 font-bold">{formatBRL(p.subscriber_price)}</span>}
              {!p.normal_price && !p.subscriber_price && !!p.discount_pct && <span className="text-sm text-gold-400 font-bold">{p.discount_pct}% OFF</span>}
            </div>
            <p className="text-[11px] mt-1">
              <span className={`font-semibold ${!p.quantity ? 'text-red-400' : p.quantity <= 5 ? 'text-gold-300' : 'text-emerald-400'}`}>
                {!p.quantity ? 'Sem estoque' : p.quantity <= 5 ? `Só ${p.quantity} em estoque` : `${p.quantity} em estoque`}
              </span>
            </p>
            <p className="text-[10px] text-white/30 mt-0.5">Válido até {formatDate(p.valid_until)}</p>
          </button>
        ))}
        {!products.length && (
          <div className="col-span-2">
            <EmptyState dark icon={Percent} title="Sem produtos no momento" description="Esse parceiro ainda não publicou produtos com desconto." />
          </div>
        )}
      </div>

      <Modal open={!!zoomed} onClose={() => setZoomed(null)} className="!max-w-sm">
        {zoomed?.image_url && (
          <div className="space-y-3">
            <img src={zoomed.image_url} alt={zoomed.title} className="w-full rounded-xl object-cover" />
            <p className="font-semibold text-center text-ink-950">{zoomed.title}</p>
          </div>
        )}
      </Modal>
    </div>
  )
}
