import { useEffect, useState } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { NotificationRow } from '../../lib/types'
import { formatDateTime } from '../../lib/format'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

export default function SubscriberNotifications() {
  const { profile } = useAuth()
  const [items, setItems] = useState<NotificationRow[]>([])
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

  return (
    <div className="space-y-4">
      <h1 className="font-display text-xl font-semibold">Notificações</h1>
      <div className="space-y-2">
        {loading && <LoadingState dark label="Carregando notificações..." />}
        {!loading && items.map((n) => (
          <div key={n.id} className="card !py-3 flex gap-3">
            <div className="w-8 h-8 rounded-full bg-gold-400/15 flex items-center justify-center shrink-0">
              <Bell size={14} className="text-gold-400" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium">{n.title}</p>
              <p className="text-xs text-white/50">{n.message}</p>
              <p className="text-xs text-white/30 mt-1">{formatDateTime(n.created_at)}</p>
            </div>
          </div>
        ))}
        {!loading && !items.length && (
          <EmptyState dark icon={Bell} title="Nenhuma notificação por aqui" description="Avisos sobre brindes, cashback e indicações aparecem aqui." />
        )}
      </div>
    </div>
  )
}
