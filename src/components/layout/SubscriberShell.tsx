import { Outlet } from 'react-router-dom'
import { Home, Gift, Wallet, MapPin, User } from 'lucide-react'
import { TopBar } from './TopBar'
import { BottomNavigation, type BottomNavItem } from '../ui/BottomNavigation'

// Capped at 5 items per the navigation spec. "Indique" and other actions live
// inside Início (CTA) and Perfil instead of taking a 6th tab slot.
const NAV: BottomNavItem[] = [
  { to: '/app', label: 'Início', icon: Home, end: true },
  { to: '/app/beneficios', label: 'Benefícios', icon: Gift },
  { to: '/app/parceiros', label: 'Parceiros', icon: MapPin },
  { to: '/app/carteira', label: 'Carteira', icon: Wallet },
  { to: '/app/perfil', label: 'Perfil', icon: User },
]

export function SubscriberShell() {
  return (
    <div className="min-h-dvh bg-ink-950">
      <div className="mobile-shell flex flex-col bg-ink-950 border-x border-ink-800/60">
        <TopBar />
        <main className="flex-1 pb-24 px-4 pt-3">
          <Outlet />
        </main>
        <BottomNavigation items={NAV} />
      </div>
    </div>
  )
}
