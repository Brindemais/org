import { NavLink } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'

export interface BottomNavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

interface BottomNavigationProps {
  items: BottomNavItem[]
}

/**
 * Fixed bottom tab bar for the mobile app shells. Capped at 5 items per the
 * navigation spec — anything else belongs in a screen's own menu/shortcuts.
 */
export function BottomNavigation({ items }: BottomNavigationProps) {
  return (
    <nav className="fixed bottom-0 inset-x-0 z-30">
      <div className="mobile-shell safe-bottom bg-ink-900/95 backdrop-blur border-t border-ink-800 flex">
        {items.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center justify-center gap-1 min-h-[52px] py-2.5 text-[11px] font-medium transition-colors focus-ring ${
                isActive ? 'text-gold-400' : 'text-white/40 active:text-white/70'
              }`
            }
          >
            <Icon size={20} strokeWidth={2.2} />
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  )
}
