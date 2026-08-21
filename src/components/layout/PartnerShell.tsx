import { LayoutDashboard, PackageCheck, Boxes, Gift, Percent, CalendarCheck, Bell, History, Store } from 'lucide-react'
import { DashboardShell, type DashNavItem } from './DashboardShell'
import { useAuth } from '../../contexts/AuthContext'

const NAV: DashNavItem[] = [
  { to: '/parceiro', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/parceiro/retiradas', label: 'Retiradas pendentes', icon: PackageCheck },
  { to: '/parceiro/estoque', label: 'Estoque', icon: Boxes },
  { to: '/parceiro/brindes', label: 'Produtos cadastrados', icon: Gift },
  { to: '/parceiro/promocoes', label: 'Promoções e descontos', icon: Percent },
  { to: '/parceiro/reservas', label: 'Reservas selecionadas', icon: CalendarCheck },
  { to: '/parceiro/notificacoes', label: 'Notificações', icon: Bell },
  { to: '/parceiro/historico', label: 'Histórico', icon: History },
  { to: '/parceiro/perfil', label: 'Meu estabelecimento', icon: Store },
]

export function PartnerShell() {
  const { partner } = useAuth()
  return (
    <DashboardShell
      navItems={NAV}
      eyebrow="PAINEL DO PARCEIRO"
      subtitle="Visão geral do seu parceiro"
      accountLabel={partner ? `Parceiro desde ${new Date(partner.approved_at ?? partner.created_at).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}` : 'Parceiro Brinde Mais'}
      notificationsPath="/parceiro/notificacoes"
    />
  )
}
