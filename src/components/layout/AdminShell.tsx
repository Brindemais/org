import { LayoutDashboard, Users, Store, Wallet, Boxes, Percent, Landmark, LifeBuoy, UserCog } from 'lucide-react'
import { DashboardShell, type DashNavItem } from './DashboardShell'

const NAV: DashNavItem[] = [
  { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/admin/assinantes', label: 'Assinantes', icon: Users },
  { to: '/admin/parceiros', label: 'Parceiros', icon: Store },
  { to: '/admin/pagamentos', label: 'Pagamentos Pix', icon: Wallet },
  { to: '/admin/estoque', label: 'Estoque', icon: Boxes },
  { to: '/admin/promocoes', label: 'Promoções', icon: Percent },
  { to: '/admin/saques', label: 'Saques', icon: Landmark },
  { to: '/admin/suporte', label: 'Suporte', icon: LifeBuoy },
  { to: '/admin/equipe', label: 'Equipe', icon: UserCog },
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
