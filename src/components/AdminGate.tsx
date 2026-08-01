import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import AdminLogin from '../pages/public/AdminLogin'

export function AdminGate({ children }: { children: ReactNode }) {
  const { user, profile, loading, signOut } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-ink-950">
        <div className="w-8 h-8 rounded-full border-2 border-gold-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user || !profile) return <AdminLogin />

  if (profile.role !== 'admin' && profile.role !== 'operator') {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-ink-950 px-5 text-center">
        <div>
          <p className="text-white mb-4">Esta conta não tem acesso administrativo.</p>
          <button onClick={signOut} className="btn-outline-light">Sair e tentar outra conta</button>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
