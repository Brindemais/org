import { useEffect, useState } from 'react'
import { Percent } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Promotion, PromotionStatus } from '../../lib/types'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDate } from '../../lib/format'

export default function AdminPromotions() {
  const [promotions, setPromotions] = useState<any[]>([])

  async function load() {
    const { data } = await supabase.from('promotions').select('*, partner:partner_id(trade_name)').order('created_at', { ascending: false })
    setPromotions(data ?? [])
  }

  useEffect(() => { load() }, [])

  async function setStatus(id: string, status: PromotionStatus) {
    await supabase.rpc('admin_set_promotion_status', { p_promotion_id: id, p_status: status })
    load()
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Promoções</h1>
        <p className="text-white/50 text-sm">Revise e aprove as promoções enviadas pelos parceiros.</p>
      </div>
      <div className="space-y-3">
        {promotions.map((p: any) => (
          <div key={p.id} className="card flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {p.image_url && <img src={p.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />}
              <div className="min-w-0">
                <p className="font-semibold truncate">{p.title}</p>
                <p className="text-xs text-white/40">{p.partner?.trade_name} · Válida até {formatDate(p.valid_until)}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <StatusBadge status={p.status} />
              {p.status === 'pending_approval' && (
                <>
                  <button onClick={() => setStatus(p.id, 'approved')} className="btn-gold !py-1.5 !px-3 text-xs">Aprovar</button>
                  <button onClick={() => setStatus(p.id, 'rejected')} className="btn-ghost !py-1.5 !px-3 text-xs">Recusar</button>
                </>
              )}
              {p.status === 'approved' && (
                <button onClick={() => setStatus(p.id, 'suspended')} className="btn-ghost !py-1.5 !px-3 text-xs">Suspender</button>
              )}
            </div>
          </div>
        ))}
        {!promotions.length && <EmptyState dark icon={Percent} title="Nenhuma promoção cadastrada" />}
      </div>
    </div>
  )
}
