import { LogOut } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { DashboardThemeProvider, useDashboardTheme } from '../../contexts/DashboardThemeContext'
import { Logo } from '../layout/Logo'
import PartnerAdvertiser from '../../pages/partner/Advertiser'

// Shown instead of the whole partner dashboard while a partner that
// requires the advertiser fee (new signups only — see 0035) hasn't paid
// it yet. Reuses the Anunciante page itself as the gate body: its
// "not active" branches (pending Pix / pick-and-pay) are exactly what a
// blocked partner needs to see, and once confirmed this gate simply
// stops rendering (PartnerShell re-checks partner.is_advertiser).
export function PartnerFeeGate() {
  return (
    <DashboardThemeProvider>
      <PartnerFeeGateInner />
    </DashboardThemeProvider>
  )
}

function PartnerFeeGateInner() {
  const { signOut } = useAuth()
  const { theme } = useDashboardTheme()

  return (
    <div className="dashboard-ui theme-scope min-h-dvh bg-ink-950" data-theme={theme}>
      <header className="flex items-center justify-between px-5 py-4 border-b border-ink-800">
        <Logo size="sm" />
        <button onClick={signOut} className="flex items-center gap-1.5 text-xs text-white/40 hover:text-white">
          <LogOut size={14} /> Sair
        </button>
      </header>
      <main className="max-w-lg mx-auto px-5 py-8">
        <p className="text-sm text-white/50 mb-6 text-center">
          Sua taxa de anunciante ainda não foi confirmada — pague abaixo para liberar o painel do parceiro.
        </p>
        <PartnerAdvertiser />
      </main>
    </div>
  )
}
