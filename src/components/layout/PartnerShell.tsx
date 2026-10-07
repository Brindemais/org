import { useState } from 'react'
import { LayoutDashboard, PackageCheck, Boxes, Gift, Percent, CalendarCheck, Bell, History, Store, Megaphone, Users, AlertTriangle, ShoppingBag, Wallet, Check } from 'lucide-react'
import { Link } from 'react-router-dom'
import { DashboardShell, type DashNavItem } from './DashboardShell'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { PartnerFeeGate } from '../partner/PartnerFeeGate'

const NAV: DashNavItem[] = [
  { to: '/parceiro', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/parceiro/retiradas', label: 'Retiradas pendentes', icon: PackageCheck },
  { to: '/parceiro/estoque', label: 'Estoque', icon: Boxes },
  { to: '/parceiro/brindes', label: 'Brindes', icon: Gift },
  { to: '/parceiro/promocoes', label: 'Produtos e descontos', icon: Percent },
  { to: '/parceiro/vendas', label: 'Vendas de produtos', icon: ShoppingBag },
  { to: '/parceiro/anunciante', label: 'Anunciante', icon: Megaphone },
  { to: '/parceiro/indicacoes', label: 'Indicações', icon: Users },
  { to: '/parceiro/reservas', label: 'Reservas selecionadas', icon: CalendarCheck },
  { to: '/parceiro/notificacoes', label: 'Notificações', icon: Bell },
  { to: '/parceiro/historico', label: 'Histórico', icon: History },
  { to: '/parceiro/perfil', label: 'Meu estabelecimento', icon: Store },
]

export function PartnerShell() {
  const { partner, refreshProfile } = useAuth()
  const [confirmingAsaas, setConfirmingAsaas] = useState(false)
  const [asaasDismissed, setAsaasDismissed] = useState(false)

  async function confirmAsaasVerified() {
    if (!partner) return
    setConfirmingAsaas(true)
    await supabase.from('partners').update({ asaas_verified_at: new Date().toISOString() }).eq('id', partner.id)
    await refreshProfile()
    setConfirmingAsaas(false)
  }

  // Only new-signup partners carry requires_fee (see 0035) — existing
  // approved partners never see this, and it lifts on its own once
  // is_advertiser flips (confirm_payment, admin-confirmed like every
  // other payment on the platform).
  const isAdvertiserActive = !!partner?.is_advertiser && (!partner.advertiser_expires_at || new Date(partner.advertiser_expires_at) > new Date())
  if (partner?.requires_fee && !isAdvertiserActive) {
    return <PartnerFeeGate />
  }

  // Aviso de vencimento próximo (até 7 dias) da taxa de anunciante — só
  // enquanto ela ainda está ativa; depois de vencer de verdade, o painel
  // inteiro já fica bloqueado pelo PartnerFeeGate acima, então não faz
  // sentido mostrar os dois ao mesmo tempo.
  const daysLeft = isAdvertiserActive && partner?.advertiser_expires_at
    ? Math.ceil((new Date(partner.advertiser_expires_at).getTime() - Date.now()) / 86400000)
    : null
  const showExpiryBanner = daysLeft !== null && daysLeft <= 7

  // Subconta Asaas criada mas ainda sem confirmação de que o parceiro
  // terminou a verificação (link que a própria Asaas manda por e-mail —
  // a API não devolve esse link pra gente embutir direto, só dispara o
  // envio). Fica até ele mesmo confirmar, ou "dispensar" por esta sessão.
  const showAsaasBanner = partner?.asaas_subaccount_status === 'created' && !partner?.asaas_verified_at && !asaasDismissed

  const banner = (showExpiryBanner || showAsaasBanner) ? (
    <>
      {showExpiryBanner && (
        <div className="bg-red-600 text-white px-4 lg:px-8 py-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm font-medium">
          <AlertTriangle size={15} className="shrink-0" />
          <span>
            {daysLeft === 0 ? 'Sua taxa de anunciante vence hoje.' : daysLeft === 1 ? 'Sua taxa de anunciante vence amanhã.' : `Sua taxa de anunciante vence em ${daysLeft} dias.`}
          </span>
          <Link to="/parceiro/anunciante" className="underline font-semibold whitespace-nowrap">Renovar agora</Link>
        </div>
      )}
      {showAsaasBanner && (
        <div className="bg-gold-500 text-ink-950 px-4 lg:px-8 py-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm font-medium">
          <Wallet size={15} className="shrink-0" />
          <span>
            Falta confirmar sua conta Asaas para receber os repasses automáticos das suas vendas. A Asaas enviou um e-mail
            de ativação para <strong>{partner?.email}</strong>.
          </span>
          <a href="https://www.asaas.com/login" target="_blank" rel="noopener noreferrer" className="underline font-semibold whitespace-nowrap">
            Acessar Asaas
          </a>
          <button onClick={confirmAsaasVerified} disabled={confirmingAsaas} className="underline font-semibold whitespace-nowrap flex items-center gap-1">
            <Check size={13} /> {confirmingAsaas ? 'Salvando...' : 'Já confirmei'}
          </button>
          <button onClick={() => setAsaasDismissed(true)} className="whitespace-nowrap opacity-70 hover:opacity-100">Dispensar por agora</button>
        </div>
      )}
    </>
  ) : undefined

  return (
    <DashboardShell
      navItems={NAV}
      eyebrow="PAINEL DO PARCEIRO"
      subtitle="Visão geral do seu parceiro"
      accountLabel={partner ? `Parceiro desde ${new Date(partner.approved_at ?? partner.created_at).toLocaleDateString('pt-BR', { month: '2-digit', year: 'numeric' })}` : 'Parceiro Brinde Mais'}
      notificationsPath="/parceiro/notificacoes"
      banner={banner}
    />
  )
}
