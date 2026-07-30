import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'

interface PickupRow {
  pickup_id: string; partner_id: string; status: string; code: string; product_id: string | null
  subscriber_name: string; subscriber_phone: string; created_at: string; deadline: string
  authorized_name: string | null
}
interface ProductOpt { id: string; name: string; quantity: number }

export default function PartnerPickups() {
  const { partner } = useAuth()
  const [pickups, setPickups] = useState<PickupRow[]>([])
  const [products, setProducts] = useState<ProductOpt[]>([])
  const [selected, setSelected] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  async function load() {
    if (!partner) return
    const { data } = await supabase.from('partner_pickup_view').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false })
    setPickups((data as PickupRow[]) ?? [])
    const { data: stock } = await supabase.from('stock_partner').select('product_id, quantity, product:product_id(id,name)').eq('partner_id', partner.id).gt('quantity', 0)
    setProducts((stock ?? []).map((s: any) => ({ id: s.product.id, name: s.product.name, quantity: s.quantity })))
  }

  useEffect(() => { load() }, [partner])

  async function confirmDelivery(pickupId: string) {
    const productId = selected[pickupId]
    if (!productId) return
    setBusy(pickupId)
    const { error } = await supabase.rpc('confirm_pickup_delivery', { p_pickup_id: pickupId, p_product_id: productId })
    setBusy(null)
    if (!error) load()
  }

  async function cancelPickup(pickupId: string) {
    setBusy(pickupId)
    const { error } = await supabase.rpc('cancel_pickup_by_partner', { p_pickup_id: pickupId, p_reason: reason || 'Sem estoque disponível' })
    setBusy(null)
    setCancelling(null)
    setReason('')
    if (!error) load()
  }

  const ready = pickups.filter((p) => p.status === 'ready')
  const others = pickups.filter((p) => p.status !== 'ready')

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Retiradas pendentes</h1>
        <p className="text-white/50 text-sm">Confirme a entrega e dê baixa automática no estoque.</p>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase">
              <th className="pb-3">Assinante</th><th className="pb-3">Código</th><th className="pb-3">Reservado em</th><th className="pb-3">Brinde</th><th className="pb-3">Ação</th>
            </tr>
          </thead>
          <tbody>
            {ready.map((p) => (
              <tr key={p.pickup_id} className="border-t border-ink-800 align-top">
                <td className="py-3">
                  <p className="font-medium">{p.authorized_name ? `${p.authorized_name} (autorizado)` : p.subscriber_name}</p>
                  <p className="text-xs text-white/40">{p.subscriber_phone}</p>
                </td>
                <td className="py-3 font-mono text-xs">{p.code}</td>
                <td className="py-3 text-white/50">{formatDateTime(p.created_at)}</td>
                <td className="py-3">
                  <select className="input !py-1.5 !text-xs" value={selected[p.pickup_id] ?? ''} onChange={(e) => setSelected({ ...selected, [p.pickup_id]: e.target.value })}>
                    <option value="">Selecione...</option>
                    {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name} ({pr.quantity})</option>)}
                  </select>
                </td>
                <td className="py-3">
                  {cancelling === p.pickup_id ? (
                    <div className="flex flex-col gap-1.5 w-40">
                      <input className="input !py-1.5 !text-xs" placeholder="Motivo" value={reason} onChange={(e) => setReason(e.target.value)} />
                      <div className="flex gap-1.5">
                        <button onClick={() => cancelPickup(p.pickup_id)} className="btn-dark !py-1.5 !px-2 text-xs !border-red-500/40 text-red-400 flex-1">Confirmar</button>
                        <button onClick={() => setCancelling(null)} className="btn-ghost !py-1.5 !px-2 text-xs flex-1">X</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmDelivery(p.pickup_id)}
                        disabled={!selected[p.pickup_id] || busy === p.pickup_id}
                        className="btn-gold !py-1.5 !px-3 text-xs"
                      >
                        {busy === p.pickup_id ? '...' : 'Confirmar entrega'}
                      </button>
                      <button onClick={() => setCancelling(p.pickup_id)} className="text-xs text-red-400">Cancelar</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
            {!ready.length && (
              <tr><td colSpan={5} className="py-8 text-center text-white/40">Nenhuma retirada pendente no momento.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div>
        <p className="font-semibold mb-3">Histórico de retiradas</p>
        <div className="card overflow-x-auto">
          <table className="w-full text-sm min-w-[600px]">
            <thead>
              <tr className="text-left text-white/40 text-xs uppercase">
                <th className="pb-3">Assinante</th><th className="pb-3">Código</th><th className="pb-3">Status</th><th className="pb-3">Data</th>
              </tr>
            </thead>
            <tbody>
              {others.map((p) => (
                <tr key={p.pickup_id} className="border-t border-ink-800">
                  <td className="py-3">{p.subscriber_name}</td>
                  <td className="py-3 font-mono text-xs">{p.code}</td>
                  <td className="py-3"><StatusBadge status={p.status} /></td>
                  <td className="py-3 text-white/50">{formatDateTime(p.created_at)}</td>
                </tr>
              ))}
              {!others.length && <tr><td colSpan={4} className="py-6 text-center text-white/40">Sem histórico ainda.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
