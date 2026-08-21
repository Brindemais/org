import { useEffect, useState } from 'react'
import { Bell, AlertTriangle, PackageCheck, Truck } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { NotificationRow } from '../../lib/types'
import { formatDateTime } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

const ICONS: Record<string, typeof Bell> = {
  pickup: PackageCheck,
  stock: Truck,
}

interface LowStockRow { id: string; quantity: number; product: { name: string } }

export default function PartnerNotifications() {
  const { profile, partner } = useAuth()
  const [items, setItems] = useState<NotificationRow[]>([])
  const [lowStock, setLowStock] = useState<LowStockRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!profile) return
    supabase.from('notifications').select('*').eq('user_id', profile.id).order('created_at', { ascending: false }).then(({ data }) => {
      setItems((data as NotificationRow[]) ?? [])
      setLoading(false)
      const unreadIds = (data ?? []).filter((n: any) => !n.read).map((n: any) => n.id)
      if (unreadIds.length) supabase.from('notifications').update({ read: true }).in('id', unreadIds).then()
    })
  }, [profile])

  useEffect(() => {
    if (!partner) return
    supabase.from('stock_partner').select('id, quantity, product:product_id(name)').eq('partner_id', partner.id).lte('quantity', 5)
      .then(({ data }) => setLowStock((data as any[]) ?? []))
  }, [partner])

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-xl font-semibold">Notificações</h1>
        <p className="text-white/50 text-sm">Avisos sobre retiradas, estoque recebido da matriz e alertas do seu estabelecimento.</p>
      </div>

      {lowStock.length > 0 && (
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">Alertas ativos</p>
          <div className="space-y-2">
            {lowStock.map((s) => (
              <div key={s.id} className="card !py-3 flex gap-3 border-red-500/30 bg-red-500/5">
                <div className="w-8 h-8 rounded-full bg-red-500/15 flex items-center justify-center shrink-0">
                  <AlertTriangle size={14} className="text-red-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">Estoque baixo: {s.product?.name}</p>
                  <p className="text-xs text-white/50">Restam {s.quantity} unidade{s.quantity === 1 ? '' : 's'}. Peça reposição à matriz.</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        {lowStock.length > 0 && <p className="text-xs font-bold uppercase tracking-wide text-white/40 mb-2">Histórico</p>}
        <div className="space-y-2">
          {loading && <LoadingState dark label="Carregando notificações..." />}
          {!loading && items.map((n) => {
            const Icon = ICONS[n.type] ?? Bell
            return (
              <div key={n.id} className="card !py-3 flex gap-3">
                <div className="w-8 h-8 rounded-full bg-gold-400/15 flex items-center justify-center shrink-0">
                  <Icon size={14} className="text-gold-400" />
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{n.title}</p>
                  <p className="text-xs text-white/50">{n.message}</p>
                  <p className="text-xs text-white/30 mt-1">{formatDateTime(n.created_at)}</p>
                </div>
              </div>
            )
          })}
          {!loading && !items.length && !lowStock.length && (
            <EmptyState dark icon={Bell} title="Nenhuma notificação por aqui" description="Avisos sobre retiradas e estoque recebido da matriz aparecem aqui." />
          )}
        </div>
      </div>
    </div>
  )
}
