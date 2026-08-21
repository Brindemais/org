import { useEffect, useState } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { PackageCheck, History } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'

interface PickupRow {
  pickup_id: string; partner_id: string; status: string; code: string; product_id: string | null
  subscriber_name: string; subscriber_phone: string; created_at: string; deadline: string
  authorized_name: string | null
}
interface ProductOpt { id: string; name: string; quantity: number }
interface AuthorizedOpt { id: string; full_name: string; cpf: string; relationship: string | null }

export default function PartnerPickups() {
  const { partner } = useAuth()
  const [pickups, setPickups] = useState<PickupRow[]>([])
  const [products, setProducts] = useState<ProductOpt[]>([])
  const [authorizedOptions, setAuthorizedOptions] = useState<Record<string, AuthorizedOpt[]>>({})
  const [selectedProduct, setSelectedProduct] = useState<Record<string, string>>({})
  const [selectedWithdrawer, setSelectedWithdrawer] = useState<Record<string, string>>({})
  const [codeInput, setCodeInput] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [cancelling, setCancelling] = useState<string | null>(null)
  const [reason, setReason] = useState('')

  async function load() {
    if (!partner) return
    const { data } = await supabase.rpc('get_partner_pickups', { p_partner_id: partner.id })
    const rows = (data as PickupRow[]) ?? []
    setPickups(rows)
    const { data: stock } = await supabase.from('stock_partner').select('product_id, quantity, product:product_id(id,name)').eq('partner_id', partner.id).gt('quantity', 0)
    setProducts((stock ?? []).map((s: any) => ({ id: s.product.id, name: s.product.name, quantity: s.quantity })))

    const readyRows = rows.filter((r) => r.status === 'ready')
    const authEntries = await Promise.all(
      readyRows.map(async (r) => {
        const { data: opts } = await supabase.rpc('list_authorized_persons_for_pickup', { p_pickup_id: r.pickup_id })
        return [r.pickup_id, (opts as AuthorizedOpt[]) ?? []] as const
      }),
    )
    setAuthorizedOptions(Object.fromEntries(authEntries))
  }

  useEffect(() => { load() }, [partner])

  async function confirmDelivery(pickupId: string) {
    const productId = selectedProduct[pickupId]
    const code = codeInput[pickupId]
    if (!productId || !code) return
    setBusy(pickupId)
    setErrors((e) => ({ ...e, [pickupId]: '' }))
    const withdrawerId = selectedWithdrawer[pickupId]
    const { error } = await supabase.rpc('confirm_pickup_delivery', {
      p_pickup_id: pickupId,
      p_product_id: productId,
      p_code: code,
      p_authorized_person_id: withdrawerId || null,
    })
    setBusy(null)
    if (error) {
      const map: Record<string, string> = {
        CODE_MISMATCH: 'Código não confere com o da retirada.',
        NO_STOCK: 'Sem estoque para este brinde.',
        INVALID_AUTHORIZED_PERSON: 'Pessoa autorizada inválida.',
      }
      setErrors((e) => ({ ...e, [pickupId]: map[error.message] ?? 'Não foi possível confirmar.' }))
      return
    }
    load()
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
  const withdrawnCount = others.filter((p) => p.status === 'withdrawn').length

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Retiradas</h1>
        <p className="text-white/50 text-sm">Peça o código ao assinante (na tela dele) e confirme aqui. A entrega só é liberada se o código bater.</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm flex items-center gap-2">
            Pendentes
            {ready.length > 0 && <span className="pill bg-gold-400/15 text-gold-300">{ready.length}</span>}
          </p>
        </div>
        <div className="space-y-4">
          {ready.map((p) => (
          <div key={p.pickup_id} className="card">
            <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
              <div className="flex items-center gap-3">
                <div className="bg-white p-1.5 rounded shrink-0">
                  <QRCodeSVG value={p.code} size={44} />
                </div>
                <div>
                  <p className="font-medium">{p.subscriber_name}</p>
                  <p className="text-xs text-white/40">{p.subscriber_phone} · reservado em {formatDateTime(p.created_at)}</p>
                  <p className="text-xs text-gold-400 font-mono tracking-wider mt-0.5">{p.code}</p>
                </div>
              </div>
              <StatusBadge status={p.status} />
            </div>

            {cancelling === p.pickup_id ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <input className="input !py-2 !text-sm flex-1" placeholder="Motivo do cancelamento" value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="flex gap-2">
                  <button onClick={() => cancelPickup(p.pickup_id)} className="btn-dark !py-2 !px-3 text-xs !border-red-500/40 text-red-400">Confirmar cancelamento</button>
                  <button onClick={() => setCancelling(null)} className="btn-ghost !py-2 !px-3 text-xs">Voltar</button>
                </div>
              </div>
            ) : (
              <div className="grid sm:grid-cols-4 gap-3 items-end">
                <div>
                  <label className="label">Código informado pelo assinante</label>
                  <input
                    className="input !py-2 !text-sm font-mono tracking-wider"
                    placeholder="BM24560"
                    value={codeInput[p.pickup_id] ?? ''}
                    onChange={(e) => setCodeInput({ ...codeInput, [p.pickup_id]: e.target.value })}
                  />
                </div>
                <div>
                  <label className="label">Brinde entregue</label>
                  <select className="input !py-2 !text-sm" value={selectedProduct[p.pickup_id] ?? ''} onChange={(e) => setSelectedProduct({ ...selectedProduct, [p.pickup_id]: e.target.value })}>
                    <option value="">Selecione...</option>
                    {products.map((pr) => <option key={pr.id} value={pr.id}>{pr.name} ({pr.quantity})</option>)}
                  </select>
                </div>
                <div>
                  <label className="label">Quem está retirando</label>
                  <select className="input !py-2 !text-sm" value={selectedWithdrawer[p.pickup_id] ?? ''} onChange={(e) => setSelectedWithdrawer({ ...selectedWithdrawer, [p.pickup_id]: e.target.value })}>
                    <option value="">O(a) próprio(a) assinante</option>
                    {(authorizedOptions[p.pickup_id] ?? []).map((a) => (
                      <option key={a.id} value={a.id}>{a.full_name} ({a.relationship ?? 'autorizado'})</option>
                    ))}
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => confirmDelivery(p.pickup_id)}
                    disabled={!selectedProduct[p.pickup_id] || !codeInput[p.pickup_id] || busy === p.pickup_id}
                    className="btn-gold !py-2 !px-3 text-xs flex-1"
                  >
                    {busy === p.pickup_id ? '...' : 'Confirmar entrega'}
                  </button>
                  <button onClick={() => setCancelling(p.pickup_id)} className="text-xs text-red-400 shrink-0">Cancelar</button>
                </div>
              </div>
            )}
            {errors[p.pickup_id] && <p className="text-xs text-red-400 mt-2">{errors[p.pickup_id]}</p>}
          </div>
        ))}
          {!ready.length && (
            <div className="card"><EmptyState dark icon={PackageCheck} title="Nenhuma retirada pendente" description="Novas reservas de assinantes aparecem aqui." /></div>
          )}
        </div>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold text-sm">Histórico</p>
          {others.length > 0 && (
            <p className="text-xs text-white/40">{withdrawnCount} retirada{withdrawnCount === 1 ? '' : 's'} concluída{withdrawnCount === 1 ? '' : 's'} · {others.length} no total</p>
          )}
        </div>
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
                  <td className="py-3">
                    <div className="flex items-center gap-2">
                      <div className="bg-white p-1 rounded shrink-0">
                        <QRCodeSVG value={p.code} size={24} />
                      </div>
                      <span className="font-mono text-xs">{p.code}</span>
                    </div>
                  </td>
                  <td className="py-3"><StatusBadge status={p.status} /></td>
                  <td className="py-3 text-white/50">{formatDateTime(p.created_at)}</td>
                </tr>
              ))}
              {!others.length && <tr><td colSpan={4}><EmptyState dark icon={History} title="Sem histórico ainda" className="py-6" /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
