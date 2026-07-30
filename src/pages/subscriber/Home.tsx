import { Link } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { ChevronRight, Gift, MapPin, Share2, Wallet } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { useSubscription } from '../../hooks/useSubscription'
import { useWallet } from '../../hooks/useWallet'
import { supabase } from '../../lib/supabase'
import type { Partner, Promotion } from '../../lib/types'
import { formatBRL } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'

export default function SubscriberHome() {
  const { profile } = useAuth()
  const { subscription, pickup, loading: subLoading } = useSubscription()
  const { balance } = useWallet()
  const [partners, setPartners] = useState<Partner[]>([])
  const [promo, setPromo] = useState<Promotion | null>(null)

  useEffect(() => {
    supabase.from('partners').select('*').in('status', ['approved', 'active']).limit(4).then(({ data }) => setPartners((data as Partner[]) ?? []))
    supabase.from('promotions').select('*').eq('status', 'approved').limit(1).maybeSingle().then(({ data }) => setPromo(data as Promotion | null))
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

      {!subLoading && (!subscription || subscription.status !== 'active') && (
        <div className="card border-gold-400/30">
          <p className="font-semibold mb-1">Ative sua assinatura</p>
          <p className="text-sm text-white/50 mb-3">Assine por R$ 79,00/mês e comece a receber seu brinde mensal e todos os benefícios do clube.</p>
          <Link to="/cadastro" className="btn-gold w-full">Ativar assinatura</Link>
        </div>
      )}

      {subscription?.status === 'active' && !pickup && (
        <div className="card border-gold-400/30">
          <div className="flex items-center gap-2 mb-1">
            <Gift size={16} className="text-gold-400" />
            <p className="font-semibold">Brinde do mês disponível</p>
          </div>
          <p className="text-sm text-white/50 mb-3">Escolha o parceiro onde deseja retirar seu brinde deste mês.</p>
          <Link to="/app/beneficios" className="btn-gold w-full">Escolher ponto de retirada</Link>
        </div>
      )}

      {pickup && (
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

      <Link to="/app/indique" className="block rounded-xl2 bg-ink-900 border border-gold-400/30 p-4 flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-gold-400/15 flex items-center justify-center shrink-0">
          <Share2 size={18} className="text-gold-400" />
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">Indique aqui</p>
          <p className="text-xs text-white/50">Mais amigos, mais benefícios!</p>
        </div>
        <ChevronRight size={18} className="text-white/30" />
      </Link>

      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="font-semibold">Parceiros próximos</p>
          <Link to="/app/parceiros" className="text-xs text-gold-400 font-medium">Ver todos</Link>
        </div>
        <div className="flex gap-3 overflow-x-auto pb-1 -mx-4 px-4">
          {(partners.length ? partners : []).map((p) => (
            <div key={p.id} className="shrink-0 w-24 text-center">
              <div className="w-16 h-16 rounded-full bg-ink-800 mx-auto mb-2 flex items-center justify-center font-display text-gold-400 font-semibold border border-ink-700">
                {p.trade_name.slice(0, 2).toUpperCase()}
              </div>
              <p className="text-xs font-medium truncate">{p.trade_name}</p>
            </div>
          ))}
          {!partners.length && (
            <p className="text-sm text-white/40 flex items-center gap-1.5"><MapPin size={14} /> Nenhum parceiro cadastrado ainda por aqui.</p>
          )}
        </div>
      </div>

      {promo && (
        <Link to="/app/beneficios" className="block rounded-xl2 overflow-hidden bg-ink-900 border border-ink-800">
          <div className="bg-gold-gradient text-ink-950 px-4 py-3">
            <p className="text-xs font-bold uppercase opacity-70">Oferta para você</p>
            <p className="font-semibold">{promo.title}</p>
          </div>
        </Link>
      )}
    </div>
  )
}
