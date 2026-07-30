import { useEffect, useState } from 'react'
import { MapPin, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner } from '../../lib/types'
import { PARTNER_CATEGORIES } from '../../lib/types'

export default function SubscriberPartners() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [category, setCategory] = useState('')

  useEffect(() => {
    let query = supabase.from('partners').select('*').in('status', ['approved', 'active'])
    if (category) query = query.eq('category', category)
    query.then(({ data }) => setPartners((data as Partner[]) ?? []))
  }, [category])

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">Parceiros próximos</h1>
      <div className="flex gap-2 overflow-x-auto -mx-4 px-4 pb-1">
        <button onClick={() => setCategory('')} className={`shrink-0 pill ${!category ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-900 text-white/50'}`}>Todos</button>
        {PARTNER_CATEGORIES.map((c) => (
          <button key={c.value} onClick={() => setCategory(c.value)} className={`shrink-0 pill ${category === c.value ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-900 text-white/50'}`}>
            {c.label}
          </button>
        ))}
      </div>
      <div className="space-y-3">
        {partners.map((p) => (
          <div key={p.id} className="card">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 rounded-full bg-ink-800 flex items-center justify-center font-display text-gold-400 font-semibold shrink-0">
                {p.trade_name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-medium text-sm truncate">{p.trade_name}</p>
                <p className="text-xs text-white/40">{PARTNER_CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}</p>
              </div>
            </div>
            <p className="text-xs text-white/50 flex items-center gap-1.5 mb-1"><MapPin size={12} /> {p.address}, {p.neighborhood} — {p.city}/{p.state}</p>
            {p.opening_hours && <p className="text-xs text-white/40 mb-1">{p.opening_hours}</p>}
            {p.whatsapp && <p className="text-xs text-white/40 flex items-center gap-1.5"><Phone size={12} /> {p.whatsapp}</p>}
          </div>
        ))}
        {!partners.length && <p className="text-sm text-white/40 text-center py-12">Nenhum parceiro encontrado.</p>}
      </div>
    </div>
  )
}
