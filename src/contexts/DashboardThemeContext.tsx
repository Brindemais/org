import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

export type DashboardTheme = 'dark' | 'light'

const STORAGE_KEY = 'bm-dashboard-theme'

interface DashboardThemeContextValue {
  theme: DashboardTheme
  toggleTheme: () => void
}

const DashboardThemeContext = createContext<DashboardThemeContextValue | undefined>(undefined)

function readStoredTheme(): DashboardTheme {
  if (typeof window === 'undefined') return 'dark'
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    return stored === 'light' ? 'light' : 'dark'
  } catch {
    // Private browsing / storage blocked — fall back to the default.
    return 'dark'
  }
}

// Scoped to admin + parceiro (both render through DashboardShell). Each
// person's choice is remembered per browser, not tied to their account —
// simplest option for a preference this cosmetic, and it means it works
// the same whether they're on a shared machine or not.
export function DashboardThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<DashboardTheme>(readStoredTheme)

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // Ignore — nothing to fall back to here, the toggle still works for the session.
    }
  }, [theme])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return <DashboardThemeContext.Provider value={{ theme, toggleTheme }}>{children}</DashboardThemeContext.Provider>
}

export function useDashboardTheme() {
  const ctx = useContext(DashboardThemeContext)
  if (!ctx) throw new Error('useDashboardTheme must be used within DashboardThemeProvider')
  return ctx
}
