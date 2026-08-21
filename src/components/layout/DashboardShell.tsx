import { NavLink, Outlet } from 'react-router-dom'
import { useState } from 'react'
import { Bell, LogOut, Menu, Moon, Sun, type LucideIcon } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DashboardThemeProvider, useDashboardTheme } from '../../contexts/DashboardThemeContext'
import { Logo } from './Logo'

export interface DashNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export function DashboardShell(props: { navItems: DashNavItem[]; eyebrow: string; subtitle: string; accountLabel: string }) {
  return (
    <DashboardThemeProvider>
      <DashboardShellInner {...props} />
    </DashboardThemeProvider>
  )
}

function DashboardShellInner({
  navItems, eyebrow, subtitle, accountLabel,
}: { navItems: DashNavItem[]; eyebrow: string; subtitle: string; accountLabel: string }) {
  const { profile, partner, signOut } = useAuth()
  const { theme, toggleTheme } = useDashboardTheme()
  const [open, setOpen] = useState(false)

  const sidebar = (
    <aside className="w-72 shrink-0 bg-ink-900 border-r border-ink-800 flex flex-col h-full">
      <div className="p-6 border-b border-ink-800">
        <Logo size="md" />
        <p className="text-[11px] text-white/40 mt-3 leading-relaxed">
          MAIS AMIGOS. MAIS BENEFÍCIOS.<br />MAIS MOTIVOS PARA BRINDAR!
        </p>
      </div>
      <div className="px-6 py-4 bg-gold-gradient text-ink-950">
        <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{eyebrow}</p>
        <p className="text-sm font-semibold">{subtitle}</p>
      </div>
      <nav className="flex-1 overflow-y-auto py-3">
        {navItems.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            onClick={() => setOpen(false)}
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
            {(partner?.trade_name ?? profile?.full_name ?? '?').slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium truncate">{partner?.trade_name ?? profile?.full_name}</p>
            <p className="text-xs text-white/40 truncate">{accountLabel}</p>
          </div>
          <button onClick={signOut} className="text-white/40 hover:text-white" aria-label="Sair">
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  )

  return (
    <div className="dashboard-ui min-h-dvh bg-ink-950 flex" data-theme={theme}>
      <div className="hidden lg:block">{sidebar}</div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0">{sidebar}</div>
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 bg-ink-950/90 backdrop-blur border-b border-ink-800 px-4 lg:px-8 py-3.5 flex items-center justify-between">
          <button className="lg:hidden text-white/70" onClick={() => setOpen(true)}>
            <Menu size={22} />
          </button>
          <div className="hidden lg:block">
            <p className="text-lg font-display font-semibold">{eyebrow}</p>
            <p className="text-sm text-white/40">{subtitle}</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="w-9 h-9 rounded-full bg-ink-900 border border-ink-800 flex items-center justify-center hover:bg-ink-800 transition"
              aria-label={theme === 'dark' ? 'Mudar para fundo claro' : 'Mudar para fundo escuro'}
              title={theme === 'dark' ? 'Fundo claro' : 'Fundo escuro'}
            >
              {theme === 'dark' ? <Sun size={16} className="text-white/70" /> : <Moon size={16} className="text-white/70" />}
            </button>
            <button className="relative w-9 h-9 rounded-full bg-ink-900 border border-ink-800 flex items-center justify-center">
              <Bell size={16} className="text-white/70" />
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 lg:p-8 overflow-x-hidden">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
