import { Bell } from 'lucide-react'
import { Link, useNavigate } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { Logo } from './Logo'

export function TopBar() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('notifications')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', profile.id)
      .eq('read', false)
      .then(({ count }) => setUnread(count ?? 0))
  }, [profile])

  return (
    <header className="sticky top-0 z-20 safe-top bg-ink-950/90 backdrop-blur border-b border-ink-800/60 px-4 py-3 flex items-center justify-between">
      <Link to="/app"><Logo size="sm" /></Link>
      <button
        onClick={() => navigate('/app/notificacoes')}
        className="relative w-9 h-9 rounded-full bg-ink-900 border border-ink-800 flex items-center justify-center"
        aria-label="Notificações"
      >
        <Bell size={17} className="text-white/70" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full bg-gold-400 text-ink-950 text-[10px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    </header>
  )
}
