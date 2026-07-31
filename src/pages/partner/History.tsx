import { useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'

export default function PartnerHistory() {
  const { partner } = useAuth()
  const [pickups, setPickups] = useState<any[]>([])

  useEffect(() => {
    if (!partner) return
    supabase.from('partner_pickup_view').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false }).limit(100)
      .then(({ data }) => setPickups(data ?? []))
  }, [partner])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Histórico</h1>
        <p className="text-white/50 text-sm">Todas as retiradas registradas no seu estabelecimento.</p>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase">
              <th className="pb-3">Assinante</th><th className="pb-3">Código</th><th className="pb-3">Status</th><th className="pb-3">Confirmado em</th>
            </tr>
          </thead>
          <tbody>
            {pickups.map((p) => (
              <tr key={p.pickup_id} className="border-t border-ink-800">
                <td className="py-3">{p.subscriber_name}</td>
                <td className="py-3 font-mono text-xs">{p.code}</td>
                <td className="py-3"><StatusBadge status={p.status} /></td>
                <td className="py-3 text-white/50">{p.confirmed_at ? formatDateTime(p.confirmed_at) : '-'}</td>
              </tr>
            ))}
            {!pickups.length && <tr><td colSpan={4}><EmptyState dark icon={History} title="Nenhum registro ainda" className="py-8" /></td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
