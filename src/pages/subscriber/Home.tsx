import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AlertTriangle, ChevronRight, Clock, Gift, Lock, MapPin, Percent, ShoppingBag, Share2, Wallet } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useSubscription } from '../../hooks/useSubscription'
import { useWallet } from '../../hooks/useWallet'
import { supabase } from '../../lib/supabase'
import type { Partner } from '../../lib/types'
import { formatBRL } from '../../lib/format'
import { PLAN_PRICES } from '../../lib/plans'
import { PARTNER_CATEGORIES } from '../../lib/types'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'

// Only the columns this preview strip renders — see the same note in
// Landing.tsx / subscriber/Partners.tsx.
type HomePartner = Pick<Partner, 'id' | 'trade_name' | 'category' | 'logo_url'>

const QUICK_LINKS = [
  { to: '/app/beneficios', label: 'Benefícios', icon: Gift },
  { to: '/app/parceiros', label: 'Clube', icon: Percent },
  { to: '/app/loja', label: 'Loja', icon: ShoppingBag },
  { to: '/app/indique', label: 'Indique', icon: Share2 },
]

export default function SubscriberHome() {
  const { profile } = useAuth()
  const { subscription, pickup, loading: subLoading, benefitsBlocked, renewalDue, daysUntilExpiry } = useSubscription()
  const { balance } = useWallet()
  const [partners, setPartners] = useState<HomePartner[]>([])
  const [promoCounts, setPromoCounts] = useState<Record<string, number>>({})
  const [loadingClub, setLoadingClub] = useState(true)

  useEffect(() => {
    supabase.from('partners').select('id, trade_name, category, logo_url').in('status', ['approved', 'active']).limit(6)
      .then(({ data }) => {
        const rows = (data as HomePartner[]) ?? []
        setPartners(rows)
        setLoadingClub(false)
        if (!rows.length) return
        supabase.from('promotions').select('partner_id').eq('status', 'approved').gte('valid_until', new Date().toISOString().slice(0, 10))
          .in('partner_id', rows.map((p) => p.id))
          .then(({ data: promos }) => {
            const counts: Record<string, number> = {}
            for (const p of promos ?? []) counts[p.partner_id] = (counts[p.partner_id] ?? 0) + 1
            setPromoCounts(counts)
          })
      })
  }, [])

  const firstName = profile?.full_name?.split(' ')[0] ?? ''

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Olá, {firstName}! 👋</h1>
        <p className="text-sm text-white/50">Bem-vindo(a) ao seu clube de benefícios.</p>
      </div>

      <div className="rounded-xl2 bg-gold-gradient text-ink-950 p-5">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs font-bold uppercase tracking-wide opacity-70">Saldo disponível</p>
          <Wallet size={16} className="opacity-60" />
        </div>
        <p className="text-3xl font-bold">{formatBRL(balance)}</p>
        <Link to="/app/carteira" className="text-xs font-semibold mt-2 inline-flex items-center gap-1">
          Ver carteira <ChevronRight size={13} />
        </Link>
      </div>

      <div className="grid grid-cols-4 gap-2">
        {QUICK_LINKS.map(({ to, label, icon: Icon }) => (
          <Link key={to} to={to} className="flex flex-col items-center gap-1.5 rounded-xl2 bg-ink-900 border border-ink-800 py-3 hover:border-gold-400/30 transition">
            <div className="w-9 h-9 rounded-full bg-gold-400/10 flex items-center justify-center">
              <Icon size={16} className="text-gold-400" />
            </div>
            <p className="text-[11px] font-medium text-white/70">{label}</p>
          </Link>
        ))}
      </div>

      {subLoading && <LoadingState dark label="Carregando sua assinatura..." size="sm" />}

      {!subLoading && !subscription && (
        <div className="card border-gold-400/30">
          <p className="font-semibold mb-1">Ative sua assinatura</p>
          <p className="text-sm text-white/50 mb-3">Assine a partir de {formatBRL(PLAN_PRICES.monthly)}/mês e comece a receber seu brinde mensal e todos os benefícios do clube.</p>
          <Link to="/app/assinatura" className="btn-gold w-full">Ativar assinatura</Link>
        </div>
      )}

      {!subLoading && subscription && benefitsBlocked && (
        <div className="card border-red-500/30 bg-red-500/5">
          <div className="flex items-center gap-2 mb-1">
            <Lock size={16} className="text-red-400" />
            <p className="font-semibold">Benefícios suspensos</p>
          </div>
          <p className="text-sm text-white/50 mb-3">
            Seu plano venceu e o acesso ao brinde do mês, descontos e demais benefícios ficou pausado até a confirmação de um novo pagamento.
          </p>
          <Link to="/app/assinatura" className="btn-gold w-full">Aguardando pagamento · Renovar agora</Link>
        </div>
      )}

      {!subLoading && !benefitsBlocked && renewalDue && (
        <Link to="/app/assinatura" className="card border-gold-400/40 bg-gold-400/5 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gold-400/15 flex items-center justify-center shrink-0">
            <Clock size={18} className="text-gold-400" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-sm flex items-center gap-1.5">
              <AlertTriangle size={13} className="text-gold-400" />
              {daysUntilExpiry !== null && daysUntilExpiry <= 0 ? 'Sua assinatura vence hoje' : `Vence em ${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'dia' : 'dias'}`}
            </p>
            <p className="text-xs text-white/50">Renove agora para não perder o acesso aos benefícios.</p>
          </div>
          <ChevronRight size={18} className="text-white/30" />
        </Link>
      )}

      {!benefitsBlocked && subscription?.status === 'active' && !pickup && (
        <div className="card border-gold-400/30">
          <div className="flex items-center gap-2 mb-1">
            <Gift size={16} className="text-gold-400" />
            <p className="font-semibold">Brinde do mês disponível</p>
          </div>
          <p className="text-sm text-white/50 mb-3">Escolha o parceiro onde deseja retirar seu brinde deste mês.</p>
          <Link to="/app/beneficios" className="btn-gold w-full">Escolher ponto de retirada</Link>
        </div>
      )}

      {!benefitsBlocked && pickup && (
        <Link to="/app/retirada" className="card border-gold-400/30 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Gift size={16} className="text-gold-400" />
              <p className="font-semibold">Seu brinde está pronto</p>
            </div>
            <p className="text-sm text-white/50">Código {pickup.code}</p>
          </div>
          <StatusBadge status={pickup.status} />
        </Link>
      )}

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold flex items-center gap-1.5"><Percent size={15} className="text-gold-400" /> Clube de Benefícios</p>
          <Link to="/app/parceiros" className="text-xs text-gold-400 font-medium">Ver todos</Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
          {loadingClub && <LoadingState dark label="Carregando parceiros..." size="sm" />}
          {!loadingClub && partners.map((p) => (
            <Link key={p.id} to={`/app/parceiros/${p.id}`} className="shrink-0 w-32 rounded-xl2 bg-ink-900 border border-ink-800 p-3 hover:border-gold-400/30 transition">
              <div className="w-12 h-12 rounded-full bg-gold-gradient p-[1.5px] mx-auto mb-2">
                <div className="w-full h-full rounded-full bg-ink-800 flex items-center justify-center font-display text-gold-400 font-semibold overflow-hidden">
                  {p.logo_url ? <img src={p.logo_url} alt="" className="w-full h-full object-cover" /> : p.trade_name.slice(0, 2).toUpperCase()}
                </div>
              </div>
              <p className="text-xs font-medium text-center truncate">{p.trade_name}</p>
              <p className="text-[10px] text-white/40 text-center truncate">{PARTNER_CATEGORIES.find((c) => c.value === p.category)?.label ?? p.category}</p>
              {!!promoCounts[p.id] && (
                <p className="text-[10px] font-semibold text-gold-400 text-center mt-1">{promoCounts[p.id]} {promoCounts[p.id] === 1 ? 'oferta' : 'ofertas'}</p>
              )}
            </Link>
          ))}
          {!loadingClub && !partners.length && (
            <EmptyState
              dark
              icon={MapPin}
              title="Nenhum parceiro por aqui ainda"
              description="Novos parceiros são adicionados com frequência à rede."
              className="w-full py-6"
            />
          )}
        </div>
      </div>
    </div>
  )
}
