import { NavLink, Outlet } from 'react-router-dom'
import { Home, Gift, Wallet, MapPin, User, LogOut, Bell, CreditCard, ShoppingBag, Receipt, Share2, LifeBuoy } from 'lucide-react'
import { TopBar } from './TopBar'
import { Logo } from './Logo'
import { BottomNavigation, type BottomNavItem } from '../ui/BottomNavigation'
import { useAuth } from '../../contexts/AuthContext'
import { useWallet } from '../../hooks/useWallet'
import { formatBRL } from '../../lib/format'

// Capped at 5 items — the bottom tab bar is a phone-width strip, it can't
// fit more without shrinking labels into illegibility. "Indique" and other
// actions live inside Início (CTA) and Perfil on mobile instead of taking a
// 6th tab slot.
const MOBILE_NAV: BottomNavItem[] = [
  { to: '/app', label: 'Início', icon: Home, end: true },
  { to: '/app/beneficios', label: 'Benefícios', icon: Gift },
  { to: '/app/parceiros', label: 'Parceiros', icon: MapPin },
  { to: '/app/carteira', label: 'Carteira', icon: Wallet },
  { to: '/app/perfil', label: 'Perfil', icon: User },
]

// The desktop/tablet sidebar has no such space constraint — same idea as
// the admin/parceiro sidebars, which list every top-level screen instead of
// a curated 5.
const SIDEBAR_NAV: BottomNavItem[] = [
  { to: '/app', label: 'Início', icon: Home, end: true },
  { to: '/app/beneficios', label: 'Benefícios', icon: Gift },
  { to: '/app/assinatura', label: 'Planos', icon: CreditCard },
  { to: '/app/parceiros', label: 'Parceiros', icon: MapPin },
  { to: '/app/loja', label: 'Loja', icon: ShoppingBag },
  { to: '/app/carteira', label: 'Carteira', icon: Wallet },
  { to: '/app/pagamentos', label: 'Pagamentos', icon: Receipt },
  { to: '/app/indique', label: 'Indique', icon: Share2 },
  { to: '/app/notificacoes', label: 'Notificações', icon: Bell },
  { to: '/app/suporte', label: 'Suporte', icon: LifeBuoy },
  { to: '/app/perfil', label: 'Perfil', icon: User },
]

export function SubscriberShell() {
  const { profile, signOut } = useAuth()
  const { balance } = useWallet()

  return (
    <div className="min-h-dvh bg-ink-950 lg:flex">
      {/* Desktop/tablet sidebar — mobile keeps the bottom tab bar instead */}
      <aside className="hidden lg:flex w-72 shrink-0 bg-ink-900 border-r border-ink-800 flex-col h-dvh sticky top-0">
        <div className="p-6 border-b border-ink-800">
          <Logo size="md" />
        </div>
        <div className="px-6 py-4 bg-gold-gradient text-ink-950">
          <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">Saldo disponível</p>
          <p className="text-xl font-bold">{formatBRL(balance)}</p>
        </div>
        <nav className="flex-1 overflow-y-auto py-3">
          {SIDEBAR_NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `mx-3 mb-1 flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? 'bg-gold-400/15 text-gold-300' : 'text-white/60 hover:bg-ink-800 hover:text-white'
                }`
              }
            >
              <Icon size={17} />
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="p-4 border-t border-ink-800">
          <div className="card !p-3 flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gold-gradient flex items-center justify-center text-ink-950 font-bold text-sm shrink-0">
              {(profile?.full_name ?? '?').slice(0, 1).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{profile?.full_name}</p>
              <p className="text-xs text-white/40 truncate">Assinante Brinde Mais</p>
            </div>
            <button onClick={signOut} className="text-white/40 hover:text-white shrink-0" aria-label="Sair">
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <div className="lg:hidden">
          <TopBar />
        </div>
        <header className="hidden lg:flex items-center justify-end px-8 py-3.5 border-b border-ink-800 sticky top-0 bg-ink-950/90 backdrop-blur z-20">
          <NavLink
            to="/app/notificacoes"
            className="relative w-9 h-9 rounded-full bg-ink-900 border border-ink-800 flex items-center justify-center hover:bg-ink-800"
            aria-label="Notificações"
          >
            <Bell size={16} className="text-white/70" />
          </NavLink>
        </header>

        <main className="mobile-shell flex-1 w-full pb-24 px-4 pt-3 lg:pb-12 lg:px-8 lg:pt-8">
          <Outlet />
        </main>

        <div className="lg:hidden">
          <BottomNavigation items={MOBILE_NAV} />
        </div>
      </div>
    </div>
  )
}
