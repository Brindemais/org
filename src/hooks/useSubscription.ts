import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Subscription, Pickup } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'

export function useSubscription() {
  const { user } = useAuth()
  const [subscription, setSubscription] = useState<Subscription | null>(null)
  const [pickup, setPickup] = useState<Pickup | null>(null)
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('subscriber_id', user.id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setSubscription(sub as Subscription | null)

    if (sub) {
      const { data: pk } = await supabase
        .from('pickups')
        .select('*')
        .eq('subscription_id', sub.id)
        .in('status', ['reserved', 'ready'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      setPickup(pk as Pickup | null)
    }
    setLoading(false)
  }, [user])

  useEffect(() => { reload() }, [reload])

  return { subscription, pickup, loading, reload }
}
