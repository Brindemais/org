import { NavLink, Outlet } from 'react-router-dom'
import { Home, Gift, Wallet, Users, User } from 'lucide-react'
import { TopBar } from './TopBar'

const NAV = [
  { to: '/app', label: 'Início', icon: Home, end: true },
  { to: '/app/beneficios', label: 'Benefícios', icon: Gift },
  { to: '/app/carteira', label: 'Carteira', icon: Wallet },
  { to: '/app/indique', label: 'Indique', icon: Users },
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
        <nav className="fixed bottom-0 inset-x-0 z-30">
          <div className="mobile-shell safe-bottom bg-ink-900/95 backdrop-blur border-t border-ink-800 flex">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) =>
                  `flex-1 flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium ${
                    isActive ? 'text-gold-400' : 'text-white/40'
                  }`
                }
              >
                <Icon size={20} strokeWidth={2.2} />
                {label}
              </NavLink>
            ))}
          </div>
        </nav>
      </div>
    </div>
  )
}
