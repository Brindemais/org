import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Subscription, Pickup } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'
import { RENEWAL_WARNING_DAYS } from '../lib/plans'

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

  // Nothing in this app flips `status` from 'active' to 'overdue' on its
  // own — payments are confirmed manually by an admin (see confirm_payment
  // in the migrations) and there's no recurring billing/webhook, so a
  // subscription simply stops being current once `expires_at` passes. Both
  // this "silently expired while status still says active" case and an
  // explicitly non-active status (overdue/suspended/cancelled/pending)
  // mean benefits are suspended.
  const isExpired = !!subscription?.expires_at && new Date(subscription.expires_at) < new Date()
  const benefitsBlocked = !subscription || subscription.status !== 'active' || isExpired

  const daysUntilExpiry = useMemo(() => {
    if (!subscription?.expires_at || subscription.status !== 'active' || isExpired) return null
    const diffMs = new Date(subscription.expires_at).getTime() - Date.now()
    return Math.ceil(diffMs / 86_400_000)
  }, [subscription, isExpired])

  const renewalDue = daysUntilExpiry !== null && daysUntilExpiry <= RENEWAL_WARNING_DAYS

  return { subscription, pickup, loading, reload, isExpired, benefitsBlocked, daysUntilExpiry, renewalDue }
}
