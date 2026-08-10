import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useSubscription } from '../../hooks/useSubscription'
import { formatBRL, formatDate } from '../../lib/format'
import { PLAN_PRICES, PLAN_LABELS, ANNUAL_DISCOUNT_PCT, ANNUAL_MONTHLY_EQUIVALENT } from '../../lib/plans'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { SubscriptionPlan } from '../../lib/types'

export default function SubscriberSubscription() {
  const { user } = useAuth()
  const { subscription, benefitsBlocked, renewalDue, daysUntilExpiry, reload } = useSubscription()
  const [plan, setPlan] = useState<SubscriptionPlan>('monthly')
  const [pixCode, setPixCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()

  // Pre-select whatever plan they're already on, so renewing/switching
  // starts from their current choice instead of always defaulting to
  // monthly.
  useEffect(() => {
    if (subscription) setPlan(subscription.plan)
  }, [subscription])

  const amount = PLAN_PRICES[plan]
  const isRenewal = !!subscription && (benefitsBlocked || renewalDue)

  async function generatePix() {
    if (!user) return
    setLoading(true)
    const fakePix = `00020126360014BR.GOV.BCB.PIX0114${user.id.slice(0, 14)}5204000053039865406${amount.toFixed(2)}5802BR5913BRINDEMAIS6009RIOJANEIRO62070503***6304${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    setPixCode(fakePix)
    await supabase.from('payments').insert({
      subscriber_id: user.id,
      subscription_id: subscription?.id ?? null,
      amount,
      plan,
      type: 'subscription',
      pix_code: fakePix,
    })
    setLoading(false)
  }

  function copyPix() {
    navigator.clipboard.writeText(pixCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const showCurrentPlanCard = subscription && subscription.status === 'active' && !benefitsBlocked && !pixCode

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-semibold">Planos</h1>

      {showCurrentPlanCard && (
        <div className="rounded-xl2 bg-gold-gradient text-ink-950 p-5">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-bold uppercase tracking-wide opacity-70">Seu plano atual</p>
            <StatusBadge status="active" />
          </div>
          <p className="text-2xl font-bold">Plano {PLAN_LABELS[subscription.plan]}</p>
          <p className="text-sm font-medium opacity-80 mt-0.5">{formatBRL(subscription.amount)}{subscription.plan === 'annual' ? '/ano' : '/mês'}</p>
          {subscription.expires_at && <p className="text-xs opacity-70 mt-2">Renova ou vence em {formatDate(subscription.expires_at)}</p>}
        </div>
      )}

      {benefitsBlocked && subscription && (
        <div className="card border-red-500/30 bg-red-500/5">
          <p className="font-semibold text-sm mb-1">Assinatura aguardando pagamento</p>
          <p className="text-xs text-white/50">
            Seu ciclo anterior venceu{subscription.expires_at ? ` em ${formatDate(subscription.expires_at)}` : ''} e o acesso aos
            benefícios foi suspenso. Escolha um plano abaixo para renovar e liberar tudo de novo.
          </p>
        </div>
      )}

      {!benefitsBlocked && renewalDue && daysUntilExpiry !== null && (
        <div className="card border-gold-400/40 bg-gold-400/5">
          <p className="font-semibold text-sm mb-1">
            {daysUntilExpiry <= 0 ? 'Sua assinatura vence hoje' : `Faltam ${daysUntilExpiry} ${daysUntilExpiry === 1 ? 'dia' : 'dias'} para o vencimento`}
          </p>
          <p className="text-xs text-white/50">Renove agora para não perder o acesso aos benefícios.</p>
        </div>
      )}

      {!pixCode && (
        <>
          {showCurrentPlanCard && (
            <p className="font-semibold text-sm">Trocar ou renovar antes do vencimento</p>
          )}
          <div className="grid grid-cols-1 gap-3">
            <button
              onClick={() => setPlan('monthly')}
              className={`text-left rounded-xl2 p-5 border transition ${plan === 'monthly' ? 'border-gold-400 bg-gold-400/10' : 'border-ink-800 bg-ink-900'}`}
            >
              <p className="text-xs font-bold uppercase opacity-70">Plano mensal</p>
              <p className="text-3xl font-bold mt-1">{formatBRL(PLAN_PRICES.monthly)}<span className="text-sm font-medium opacity-60">/mês</span></p>
              <p className="text-xs text-white/40 mt-1">Renovação a cada 30 dias.</p>
            </button>

            <button
              onClick={() => setPlan('annual')}
              className={`relative text-left rounded-xl2 p-5 border transition ${plan === 'annual' ? 'border-gold-400 bg-gold-400/10' : 'border-ink-800 bg-ink-900'}`}
            >
              <span className="absolute top-4 right-4 pill bg-gold-gradient text-ink-950 font-bold">-{ANNUAL_DISCOUNT_PCT}%</span>
              <p className="text-xs font-bold uppercase opacity-70">Plano anual</p>
              <p className="text-3xl font-bold mt-1">{formatBRL(PLAN_PRICES.annual)}<span className="text-sm font-medium opacity-60">/ano</span></p>
              <p className="text-xs text-white/40 mt-1">
                Equivale a {formatBRL(ANNUAL_MONTHLY_EQUIVALENT)}/mês · pacote de 12 meses, cobrado uma vez.
              </p>
            </button>
          </div>

          <button onClick={generatePix} disabled={loading} className="btn-gold w-full">
            {loading ? 'Gerando Pix...' : isRenewal ? 'Renovar assinatura via Pix' : 'Ativar assinatura via Pix'}
          </button>
        </>
      )}

      {pixCode && (
        <div className="card space-y-4 text-center">
          <p className="text-sm text-white/50">
            Plano {plan === 'annual' ? 'anual' : 'mensal'} · <span className="text-white font-semibold">{formatBRL(amount)}</span>
          </p>
          <div className="w-40 h-40 mx-auto rounded-xl bg-white p-3 flex items-center justify-center">
            <div className="w-full h-full bg-[repeating-linear-gradient(45deg,#111_0,#111_4px,#fff_4px,#fff_8px)] opacity-80 rounded" />
          </div>
          <button onClick={copyPix} className="btn-dark w-full !py-2.5 text-sm gap-2">
            <Copy size={14} /> {copied ? 'Código copiado!' : 'Copiar código Pix'}
          </button>
          <p className="text-xs text-white/40">A confirmação do pagamento é validada pela equipe Brinde Mais e sua assinatura será ativada em instantes.</p>
          <button onClick={() => { reload(); navigate('/app') }} className="btn-gold w-full gap-2"><Check size={16} /> Já efetuei o pagamento</button>
        </div>
      )}
    </div>
  )
}
