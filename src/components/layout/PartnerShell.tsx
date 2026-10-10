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

const MISSING_FIELD_LABELS: Record<string, string> = {
  trade_name: 'nome fantasia',
  email: 'e-mail',
  cnpj_cpf: 'CNPJ/CPF',
  address: 'endereço',
  address_number: 'número do endereço',
  neighborhood: 'bairro',
  cep: 'CEP',
  income_value: 'faturamento mensal estimado',
  birth_date: 'data de nascimento',
  company_type: 'tipo de empresa',
}

export function PartnerShell() {
  const { partner, refreshProfile } = useAuth()
  const [confirmingAsaas, setConfirmingAsaas] = useState(false)
  const [asaasDismissed, setAsaasDismissed] = useState(false)
  const [linkingAsaas, setLinkingAsaas] = useState(false)
  const [asaasLinkError, setAsaasLinkError] = useState<string | null>(null)

  async function confirmAsaasVerified() {
    if (!partner) return
    setConfirmingAsaas(true)
    await supabase.from('partners').update({ asaas_verified_at: new Date().toISOString() }).eq('id', partner.id)
    await refreshProfile()
    setConfirmingAsaas(false)
  }

  async function startAsaasLink() {
    if (!partner) return
    setLinkingAsaas(true)
    setAsaasLinkError(null)
    const { data: sessionData } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('asaas-create-subaccount', {
      body: { partner_id: partner.id },
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    }).catch((e) => ({ data: null, error: e }))
    setLinkingAsaas(false)
    if (error || data?.error) {
      if (data?.error === 'MISSING_KYC_FIELDS') {
        const labels = (data.missing ?? []).map((f: string) => MISSING_FIELD_LABELS[f] ?? f)
        setAsaasLinkError(`Complete em "Meu estabelecimento": ${labels.join(', ')}.`)
      } else {
        setAsaasLinkError('Não foi possível vincular agora. Tente novamente em instantes.')
      }
      return
    }
    await refreshProfile()
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
  const showAsaasRejectedBanner = partner?.asaas_subaccount_status === 'rejected' && !asaasDismissed
  // Parceiro que nunca iniciou o vínculo (ou tentou e falhou) — sem isso
  // não sai nenhum repasse automático nem dá pra cadastrar produto com
  // preço. Separado do banner de "criada mas não verificada" acima.
  const showAsaasPendingBanner = (!partner?.asaas_subaccount_status || partner?.asaas_subaccount_status === 'pending' || partner?.asaas_subaccount_status === 'failed') && !asaasDismissed

  const banner = (showExpiryBanner || showAsaasPendingBanner || showAsaasBanner || showAsaasRejectedBanner) ? (
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
      {showAsaasPendingBanner && (
        <div className="bg-red-600 text-white px-4 lg:px-8 py-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm font-medium">
          <AlertTriangle size={15} className="shrink-0" />
          <span>Sua conta Asaas ainda não foi vinculada — sem ela não sai repasse automático nem dá pra cadastrar produto com preço.</span>
          <button onClick={startAsaasLink} disabled={linkingAsaas} className="underline font-semibold whitespace-nowrap">
            {linkingAsaas ? 'Vinculando...' : 'Vincular Asaas agora'}
          </button>
          {asaasLinkError && <span className="whitespace-nowrap">{asaasLinkError}</span>}
          <Link to="/parceiro/perfil" className="underline font-semibold whitespace-nowrap">Meu estabelecimento</Link>
          <button onClick={() => setAsaasDismissed(true)} className="whitespace-nowrap opacity-70 hover:opacity-100">Dispensar por agora</button>
        </div>
      )}
      {showAsaasBanner && (
        <div className="bg-gold-500 text-ink-950 px-4 lg:px-8 py-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm font-medium">
          <Wallet size={15} className="shrink-0" />
          <span>
            Falta a Asaas aprovar sua conta pra receber os repasses automáticos e poder cadastrar produto com preço. A
            Asaas enviou um e-mail de ativação para <strong>{partner?.email}</strong> — isso atualiza sozinho quando for aprovado.
          </span>
          <a href="https://www.asaas.com/login" target="_blank" rel="noopener noreferrer" className="underline font-semibold whitespace-nowrap">
            Acessar Asaas
          </a>
          <button onClick={confirmAsaasVerified} disabled={confirmingAsaas} className="underline font-semibold whitespace-nowrap flex items-center gap-1" title="Isso só oculta este aviso — a liberação pra cadastrar produto com preço é confirmada pela própria Asaas, automaticamente.">
            <Check size={13} /> {confirmingAsaas ? 'Salvando...' : 'Já verifiquei (ocultar aviso)'}
          </button>
          <button onClick={() => setAsaasDismissed(true)} className="whitespace-nowrap opacity-70 hover:opacity-100">Dispensar por agora</button>
        </div>
      )}
      {showAsaasRejectedBanner && (
        <div className="bg-red-600 text-white px-4 lg:px-8 py-2.5 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-sm font-medium">
          <AlertTriangle size={15} className="shrink-0" />
          <span>A Asaas rejeitou a verificação da sua conta — sem isso você não consegue cadastrar produto com preço. Fale com o suporte Brinde Mais.</span>
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
