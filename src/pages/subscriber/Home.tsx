import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import {
  AlertTriangle, ArrowDownLeft, ArrowUpRight, ChevronRight, Clock, Copy, CreditCard,
  Eye, EyeOff, Gift, History, Lock, MapPin, Percent, Share2, Users2, Wallet,
} from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useSubscription } from '../../hooks/useSubscription'
import { useWallet } from '../../hooks/useWallet'
import { supabase } from '../../lib/supabase'
import type { Partner } from '../../lib/types'
import { formatBRL, formatDate, formatDateTime } from '../../lib/format'
import { PLAN_PRICES } from '../../lib/plans'
import { PARTNER_CATEGORIES } from '../../lib/types'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { LoadingState } from '../../components/ui/LoadingState'
import { LogoMark } from '../../components/layout/Logo'

interface OfferRow { id: string; title: string; discount_pct: number | null; subscriber_price: number | null; normal_price: number | null; image_url: string | null; partner: { trade_name: string } | null }

const TX_LABELS: Record<string, string> = {
  bonus_subscription: 'Bonificação de assinatura',
  bonus_consumption: 'Bonificação de consumo',
  cashback: 'Cashback',
  withdrawal: 'Saque',
  adjustment: 'Ajuste administrativo',
  reversal: 'Estorno',
  purchase: 'Compra',
}

// Only the columns this preview strip renders — see the same note in
// Landing.tsx / subscriber/Partners.tsx.
type HomePartner = Pick<Partner, 'id' | 'trade_name' | 'category' | 'logo_url'>

const QUICK_LINKS = [
  { to: '/app/beneficios', label: 'Benefícios', icon: Gift },
  { to: '/app/assinatura', label: 'Planos', icon: CreditCard },
  { to: '/app/parceiros', label: 'Parceiros', icon: MapPin },
  { to: '/app/indique', label: 'Indique', icon: Share2 },
]

export default function SubscriberHome() {
  const { profile } = useAuth()
  const { subscription, pickup, loading: subLoading, benefitsBlocked, renewalDue, daysUntilExpiry } = useSubscription()
  const { balance, transactions } = useWallet()
  const [partners, setPartners] = useState<HomePartner[]>([])
  const [promoCounts, setPromoCounts] = useState<Record<string, number>>({})
  const [loadingClub, setLoadingClub] = useState(true)
  const [referralCount, setReferralCount] = useState(0)
  const [referralEarned, setReferralEarned] = useState(0)
  const [copied, setCopied] = useState(false)
  const [hideBalance, setHideBalance] = useState(false)
  const [offers, setOffers] = useState<OfferRow[]>([])
  const [loadingOffers, setLoadingOffers] = useState(true)

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

  useEffect(() => {
    if (!profile) return
    supabase.from('referrals').select('id', { count: 'exact', head: true }).eq('referrer_id', profile.id)
      .then(({ count }) => setReferralCount(count ?? 0))
    supabase.from('bonuses').select('amount').eq('beneficiary_id', profile.id)
      .then(({ data }) => setReferralEarned((data ?? []).reduce((s, b: any) => s + Number(b.amount), 0)))
  }, [profile])

  useEffect(() => {
    supabase
      .from('promotions')
      .select('id, title, discount_pct, subscriber_price, normal_price, image_url, partner:partner_id(trade_name)')
      .eq('status', 'approved')
      .gte('valid_until', new Date().toISOString().slice(0, 10))
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        setOffers((data as any as OfferRow[]) ?? [])
        setLoadingOffers(false)
      })
  }, [])

  const firstName = profile?.full_name?.split(' ')[0] ?? ''
  const referralLink = profile ? `${window.location.origin}/cadastro?ref=${profile.referral_code}` : ''

  function copyReferralLink() {
    navigator.clipboard.writeText(referralLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const pickupDaysLeft = pickup ? Math.ceil((new Date(pickup.deadline).getTime() - Date.now()) / 86_400_000) : null

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-xl font-semibold">Olá, {firstName}! 👋</h1>
        <p className="text-sm text-white/50 mb-2">
          Bem-vindo(a) à sua comunidade de consumo inteligente.{profile?.created_at && ` Assinante desde ${formatDate(profile.created_at)}.`}
        </p>
        {!subLoading && subscription && (
          <span className={`pill ${benefitsBlocked ? 'bg-red-500/15 text-red-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${benefitsBlocked ? 'bg-red-400' : 'bg-emerald-400'}`} />
            {benefitsBlocked ? 'Assinatura suspensa' : 'Assinatura ativa'}
          </span>
        )}
      </div>

      <div className="relative rounded-xl2 bg-ink-950 border border-ink-800 p-5 overflow-hidden">
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold uppercase tracking-wide text-gold-400">Saldo disponível</p>
            <button onClick={() => setHideBalance(!hideBalance)} className="text-white/40 hover:text-white/70" aria-label={hideBalance ? 'Mostrar saldo' : 'Ocultar saldo'}>
              {hideBalance ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          <p className="text-3xl font-bold text-white">{hideBalance ? '••••••' : formatBRL(balance)}</p>
          <Link to="/app/carteira" className="text-xs font-semibold mt-2 inline-flex items-center gap-1 text-gold-400">
            Ver carteira <ChevronRight size={13} />
          </Link>
        </div>
        <div className="absolute -right-3 -bottom-3 opacity-90">
          <LogoMark size={68} />
        </div>
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
          <p className="text-sm text-white/50 mb-3">Assine a partir de {formatBRL(PLAN_PRICES.monthly)}/mês e comece a receber seu brinde mensal e todos os benefícios da comunidade.</p>
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

      {!benefitsBlocked && subscription?.status === 'active' && (
        <div className="card !p-0 overflow-hidden border-gold-400/30">
          <div className="flex items-center gap-3 p-4">
            <img
              src="/images/gift-glass.webp"
              alt="Taça de Cerveja Premium Brinde Mais"
              className="w-16 h-16 object-contain rounded-lg bg-white shrink-0"
            />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold uppercase tracking-wide text-gold-400">Brinde do mês</p>
              <p className="font-semibold text-sm truncate">Taça de Cerveja Premium Brinde Mais</p>
              {!pickup ? (
                <p className="text-xs text-white/50 mt-0.5">Escolha onde retirar</p>
              ) : (
                <div className="flex items-center gap-1.5 mt-0.5">
                  <p className="text-xs text-white/50">
                    Código {pickup.code}
                    {pickupDaysLeft !== null && pickupDaysLeft >= 0 && ` · ${pickupDaysLeft === 0 ? 'último dia' : `${pickupDaysLeft} ${pickupDaysLeft === 1 ? 'dia' : 'dias'}`}`}
                  </p>
                  <StatusBadge status={pickup.status} />
                </div>
              )}
            </div>
          </div>
          <Link to={pickup ? '/app/retirada' : '/app/beneficios'} className="btn-gold w-full !rounded-none text-sm">
            {pickup ? 'Ver minha retirada' : 'Escolher ponto de retirada'}
          </Link>
        </div>
      )}

      <div className="card border-gold-400/30">
        <div className="flex items-center justify-between mb-2">
          <p className="font-semibold flex items-center gap-1.5"><Share2 size={15} className="text-gold-400" /> Indique aqui</p>
          <Link to="/app/indique" className="text-xs text-gold-400 font-medium">Ver rede</Link>
        </div>
        <div className="flex items-center gap-4 mb-3">
          <div className="flex items-center gap-1.5">
            <Users2 size={14} className="text-white/40" />
            <p className="text-sm"><span className="font-semibold">{referralCount}</span> <span className="text-white/50">indicado{referralCount === 1 ? '' : 's'}</span></p>
          </div>
          <div className="flex items-center gap-1.5">
            <Wallet size={14} className="text-white/40" />
            <p className="text-sm"><span className="font-semibold text-gold-400">{formatBRL(referralEarned)}</span> <span className="text-white/50">ganhos</span></p>
          </div>
        </div>
        <button onClick={copyReferralLink} className="btn-dark w-full !py-2.5 text-sm gap-2">
          <Copy size={14} /> {copied ? 'Link copiado!' : 'Copiar meu link de indicação'}
        </button>
      </div>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold flex items-center gap-1.5 min-w-0"><Percent size={15} className="text-gold-400 shrink-0" /> <span className="truncate">Comunidade de Consumo Inteligente</span></p>
          <Link to="/app/parceiros" className="text-xs text-gold-400 font-medium shrink-0">Ver todos</Link>
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

      {!loadingOffers && offers.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold flex items-center gap-1.5"><Percent size={15} className="text-gold-400" /> Ofertas para você</p>
            <Link to="/app/beneficios" className="text-xs text-gold-400 font-medium">Ver todas</Link>
          </div>
          <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
            {offers.map((o) => (
              <Link key={o.id} to="/app/beneficios" className="shrink-0 w-40 rounded-xl2 bg-ink-900 border border-ink-800 overflow-hidden hover:border-gold-400/30 transition">
                <div className="h-20 bg-white flex items-center justify-center overflow-hidden">
                  {o.image_url ? <img src={o.image_url} alt="" className="w-full h-full object-cover" /> : <Gift size={22} className="text-ink-950/20" />}
                </div>
                <div className="p-2.5">
                  {o.discount_pct && <p className="text-[10px] font-bold text-gold-400 mb-0.5">-{o.discount_pct}% OFF</p>}
                  <p className="text-xs font-medium truncate">{o.title}</p>
                  <p className="text-[10px] text-white/40 truncate">{o.partner?.trade_name}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {transactions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-3">
            <p className="font-semibold flex items-center gap-1.5"><History size={15} className="text-gold-400" /> Atividade recente</p>
            <Link to="/app/carteira" className="text-xs text-gold-400 font-medium">Ver extrato</Link>
          </div>
          <div className="space-y-2">
            {transactions.slice(0, 3).map((t) => (
              <div key={t.id} className="card !py-3 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${t.direction === 'in' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>
                  {t.direction === 'in' ? <ArrowDownLeft size={15} /> : <ArrowUpRight size={15} />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{TX_LABELS[t.type] ?? t.description}</p>
                  <p className="text-xs text-white/40">{formatDateTime(t.created_at)}</p>
                </div>
                <p className={`text-sm font-semibold shrink-0 ${t.direction === 'in' ? 'text-emerald-400' : 'text-red-400'}`}>
                  {t.direction === 'in' ? '+' : '-'} {formatBRL(t.amount)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
