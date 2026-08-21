import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type DashboardTheme = 'dark' | 'light'

interface DashboardThemeContextValue {
  theme: DashboardTheme
  toggleTheme: () => void
}

const DashboardThemeContext = createContext<DashboardThemeContextValue | undefined>(undefined)

function readStoredTheme(storageKey: string, defaultTheme: DashboardTheme): DashboardTheme {
  if (typeof window === 'undefined') return defaultTheme
  try {
    const stored = window.localStorage.getItem(storageKey)
    return stored === 'light' || stored === 'dark' ? stored : defaultTheme
  } catch {
    // Private browsing / storage blocked — fall back to the default.
    return defaultTheme
  }
}

// Shared by every internal shell (admin, parceiro, assinante — each wraps
// its own <Outlet> with this provider, using its own storageKey so the
// three preferences don't collide, and its own defaultTheme since the
// assinante app opens light-first while admin/parceiro stay dark-first).
// Each person's choice is remembered per browser, not tied to their
// account — simplest option for a preference this cosmetic.
export function DashboardThemeProvider({
  children, defaultTheme = 'dark', storageKey = 'bm-dashboard-theme',
}: { children: ReactNode; defaultTheme?: DashboardTheme; storageKey?: string }) {
  const [theme, setTheme] = useState<DashboardTheme>(() => readStoredTheme(storageKey, defaultTheme))

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, theme)
    } catch {
      // Ignore — nothing to fall back to here, the toggle still works for the session.
    }
    // Only run when the theme itself changes — re-persisting under a
    // different key if storageKey ever changed at runtime isn't a real case.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return <DashboardThemeContext.Provider value={{ theme, toggleTheme }}>{children}</DashboardThemeContext.Provider>
}

export function useDashboardTheme() {
  const ctx = useContext(DashboardThemeContext)
  if (!ctx) throw new Error('useDashboardTheme must be used within DashboardThemeProvider')
  return ctx
}
