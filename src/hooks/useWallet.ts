import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { WalletTransaction } from '../lib/types'
import { useAuth } from '../contexts/AuthContext'

export function useWallet() {
  const { user } = useAuth()
  const [balance, setBalance] = useState(0)
  const [available, setAvailable] = useState(0)
  const [transactions, setTransactions] = useState<WalletTransaction[]>([])
  const [loading, setLoading] = useState(true)

  const reload = useCallback(async () => {
    if (!user) { setLoading(false); return }
    setLoading(true)
    const [{ data: bal }, { data: avail }, { data: txs }] = await Promise.all([
      supabase.rpc('current_wallet_balance', { p_user_id: user.id }),
      supabase.rpc('available_balance', { p_user_id: user.id }),
      supabase.from('wallet_transactions').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
    ])
    setBalance(Number(bal ?? 0))
    setAvailable(Number(avail ?? 0))
    setTransactions((txs as WalletTransaction[]) ?? [])
    setLoading(false)
  }, [user])

  useEffect(() => { reload() }, [reload])

  return { balance, available, transactions, loading, reload }
}
