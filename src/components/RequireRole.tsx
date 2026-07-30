import { Navigate } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from '../contexts/AuthContext'
import type { UserRole } from '../lib/types'

export function RequireRole({ roles, children }: { roles: UserRole[]; children: ReactNode }) {
  const { user, profile, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-ink-950">
        <div className="w-8 h-8 rounded-full border-2 border-gold-400 border-t-transparent animate-spin" />
      </div>
    )
  }

  if (!user || !profile) return <Navigate to="/entrar" replace />
  if (!roles.includes(profile.role)) {
    const home = profile.role === 'admin' || profile.role === 'operator' ? '/admin' : profile.role === 'partner' ? '/parceiro' : '/app'
    return <Navigate to={home} replace />
  }
  return <>{children}</>
}
