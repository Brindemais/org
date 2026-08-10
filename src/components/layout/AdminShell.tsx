import { LayoutDashboard, Users, Network, Store, Wallet, Boxes, Percent, Landmark, LifeBuoy, UserCog, History, PiggyBank } from 'lucide-react'
import { DashboardShell, type DashNavItem } from './DashboardShell'

const NAV: DashNavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/financeiro', label: 'Financeiro', icon: PiggyBank },
  { to: '/admin/assinantes', label: 'Assinantes', icon: Users },
  { to: '/admin/indicacoes', label: 'Indicações', icon: Network },
  { to: '/admin/parceiros', label: 'Parceiros', icon: Store },
  { to: '/admin/pagamentos', label: 'Pagamentos Pix', icon: Wallet },
  { to: '/admin/estoque', label: 'Estoque', icon: Boxes },
  { to: '/admin/promocoes', label: 'Promoções', icon: Percent },
  { to: '/admin/saques', label: 'Saques', icon: Landmark },
  { to: '/admin/suporte', label: 'Suporte', icon: LifeBuoy },
  { to: '/admin/equipe', label: 'Equipe', icon: UserCog },
  { to: '/admin/auditoria', label: 'Auditoria', icon: History },
]

export function AdminShell() {
  return (
    <DashboardShell
      navItems={NAV}
      eyebrow="ADMINISTRAÇÃO"
      subtitle="Visão geral da operação Brinde Mais"
      accountLabel="Administrador"
    />
  )
}
