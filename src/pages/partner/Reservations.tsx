import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { CalendarCheck } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/format'
import { StatCard } from '../../components/ui/StatCard'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

interface PickupRow {
  pickup_id: string; status: string; code: string; product_id: string | null
  subscriber_name: string; cycle_month: number; cycle_year: number; created_at: string
}

export default function PartnerReservations() {
  const { partner } = useAuth()
  const [rows, setRows] = useState<PickupRow[]>([])
  const [productNames, setProductNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!partner) return
    setLoading(true)
    supabase.rpc('get_partner_pickups', { p_partner_id: partner.id }).then(async ({ data }) => {
      const now = new Date()
      const month = now.getMonth() + 1
      const year = now.getFullYear()
      const all = (data as PickupRow[]) ?? []
      const cycle = all.filter((p) => p.cycle_month === month && p.cycle_year === year)
      setRows(cycle)

      const ids = [...new Set(cycle.map((p) => p.product_id).filter(Boolean))] as string[]
      if (ids.length) {
        const { data: products } = await supabase.from('products').select('id, name').in('id', ids)
        setProductNames(Object.fromEntries((products ?? []).map((p: any) => [p.id, p.name])))
      }
      setLoading(false)
    })
  }, [partner])

  const now = new Date()
  const cycleLabel = now.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Reservas selecionadas</h1>
        <p className="text-white/50 text-sm">Assinantes que escolheram seu estabelecimento neste ciclo ({cycleLabel}).</p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4 max-w-lg">
        <StatCard label="Reservas neste ciclo" value={rows.length} hint={cycleLabel} icon={<CalendarCheck size={18} />} tone="gold" />
        <StatCard label="Já retiradas" value={rows.filter((r) => r.status === 'withdrawn').length} hint="Confirmadas pelo parceiro" icon={<CalendarCheck size={18} />} />
      </div>

      <div className="card overflow-x-auto">
        {loading && <LoadingState dark label="Carregando reservas..." />}
        {!loading && (
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase">
                <th className="pb-3">Assinante</th>
                <th className="pb-3">Código / QR Code</th>
                <th className="pb-3">Brinde selecionado</th>
                <th className="pb-3">Status</th>
                <th className="pb-3">Data da reserva</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.pickup_id} className="border-t border-ink-800">
                  <td className="py-3">{p.subscriber_name}</td>
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-white p-1 rounded shrink-0">
                        <QRCodeSVG value={p.code} size={28} />
                      </div>
                      <span className="font-mono text-xs">{p.code}</span>
                    </div>
                  </td>
                  <td className="py-3 text-white/60">{p.product_id ? (productNames[p.product_id] ?? '-') : '-'}</td>
                  <td className="py-3"><StatusBadge status={p.status} /></td>
                  <td className="py-3 text-white/50">{formatDateTime(p.created_at)}</td>
                </tr>
              ))}
              {!rows.length && (
                <tr><td colSpan={5}><EmptyState dark icon={CalendarCheck} title="Nenhuma reserva neste ciclo" description="Assim que um assinante escolher seu estabelecimento, a reserva aparece aqui." className="py-8" /></td></tr>
              )}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
