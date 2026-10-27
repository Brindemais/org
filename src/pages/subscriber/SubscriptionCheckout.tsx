import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy, CreditCard, QrCode, Wallet } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useSubscription } from '../../hooks/useSubscription'
import { useWallet } from '../../hooks/useWallet'
import { formatBRL, formatDate, maskCardNumber, maskCardExpiry } from '../../lib/format'
import { PLAN_PRICES, PLAN_LABELS, ANNUAL_DISCOUNT_PCT, ANNUAL_MONTHLY_EQUIVALENT } from '../../lib/plans'
import { StatusBadge } from '../../components/ui/StatusBadge'
import type { SubscriptionPlan } from '../../lib/types'

type Method = 'pix' | 'credit_card' | 'wallet'

export default function SubscriberSubscription() {
  const { user, refreshProfile } = useAuth()
  const { available: walletAvailable, reload: reloadWallet } = useWallet()
  const { subscription, benefitsBlocked, renewalDue, daysUntilExpiry, reload } = useSubscription()
  const [plan, setPlan] = useState<SubscriptionPlan>('monthly')
  const [method, setMethod] = useState<Method>('pix')
  const [pixCode, setPixCode] = useState('')
  const [pixQrCode, setPixQrCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cardName, setCardName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardAddressNumber, setCardAddressNumber] = useState('')
  const navigate = useNavigate()

  // Pre-select whatever plan they're already on, so renewing/switching
  // starts from their current choice instead of always defaulting to
  // monthly.
  useEffect(() => {
    if (subscription) setPlan(subscription.plan)
  }, [subscription])

  const amount = PLAN_PRICES[plan]
  const isRenewal = !!subscription && (benefitsBlocked || renewalDue)

  async function submitPix() {
    if (!user) return
    setLoading(true)
    setError(null)
    const { data: payment, error: insertError } = await supabase.from('payments').insert({
      subscriber_id: user.id, subscription_id: subscription?.id ?? null, amount, plan, type: 'subscription', payment_method: 'pix',
    }).select('id').single()
    if (insertError || !payment) {
      setLoading(false)
      setError('Não foi possível gerar o Pix. Tente novamente.')
      return
    }
    const { data: charge, error: chargeError } = await supabase.functions.invoke('asaas-create-pix-charge', { body: { payment_id: payment.id } })
    setLoading(false)
    if (chargeError || !charge?.pix_code) {
      setError(charge?.error === 'MISSING_CPF' ? 'Complete seu CPF em Perfil antes de continuar o pagamento.' : 'Não foi possível gerar o Pix. Tente novamente.')
      return
    }
    setPixCode(charge.pix_code)
    setPixQrCode(charge.pix_qr_code ?? '')
  }

  async function submitCard(e: FormEvent) {
    e.preventDefault()
    if (!user) return
    setLoading(true)
    setError(null)
    const { data: payment, error: insertError } = await supabase.from('payments').insert({
      subscriber_id: user.id, subscription_id: subscription?.id ?? null, amount: PLAN_PRICES.annual, plan: 'annual', type: 'subscription', payment_method: 'credit_card',
    }).select('id').single()
    if (insertError || !payment) {
      setLoading(false)
      setError('Não foi possível iniciar o pagamento. Tente novamente.')
      return
    }
    const [expMonth, expYearShort] = cardExpiry.split('/')
    const { data: charge, error: chargeError } = await supabase.functions.invoke('asaas-charge-card', {
      body: {
        payment_id: payment.id,
        holder_name: cardName,
        card_number: cardNumber,
        expiry_month: expMonth,
        expiry_year: expYearShort ? `20${expYearShort}` : '',
        ccv: cardCvv,
        holder_address_number: cardAddressNumber,
      },
    })
    setLoading(false)
    if (chargeError || charge?.error) {
      setError(charge?.error === 'MISSING_CPF' ? 'Complete seu CPF em Perfil antes de continuar o pagamento.' : 'Cartão recusado. Confira os dados, tente outro cartão ou pague via Pix.')
      return
    }
    await refreshProfile()
    reload()
    navigate('/app')
  }

  async function submitWallet() {
    setLoading(true)
    setError(null)
    const { error: payError } = await supabase.rpc('pay_subscription_wallet', { p_plan: plan })
    setLoading(false)
    if (payError) {
      const map: Record<string, string> = {
        INSUFFICIENT_BALANCE: 'Saldo interno insuficiente para pagar esse plano. Escolha Pix ou cartão, ou aguarde seu saldo ficar disponível.',
        ACCOUNT_SUSPENDED: 'Sua conta está suspensa. Fale com o suporte.',
      }
      const code = Object.keys(map).find((k) => payError.message.includes(k))
      setError(code ? map[code] : 'Não foi possível pagar com o saldo interno. Tente novamente.')
      return
    }
    reloadWallet()
    await refreshProfile()
    reload()
    navigate('/app')
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
              onClick={() => { setPlan('monthly'); if (method === 'credit_card') setMethod('pix') }}
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
              <p className="text-3xl font-bold mt-1">12x {formatBRL(ANNUAL_MONTHLY_EQUIVALENT)}<span className="text-sm font-medium opacity-60">/mês</span></p>
              <p className="text-xs text-white/40 mt-1">
                Pacote de 12 meses, cobrado uma vez.
              </p>
            </button>
          </div>

          <div className={`grid gap-2 ${plan === 'annual' ? 'grid-cols-3' : 'grid-cols-2'}`}>
            <button type="button" onClick={() => setMethod('pix')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium border transition ${method === 'pix' ? 'border-gold-400 bg-gold-400/10 text-gold-300' : 'border-ink-800 text-white/50'}`}>
              <QrCode size={15} /> Pix
            </button>
            {plan === 'annual' && (
              <button type="button" onClick={() => setMethod('credit_card')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium border transition ${method === 'credit_card' ? 'border-gold-400 bg-gold-400/10 text-gold-300' : 'border-ink-800 text-white/50'}`}>
                <CreditCard size={15} /> Cartão
              </button>
            )}
            <button type="button" onClick={() => setMethod('wallet')} className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium border transition ${method === 'wallet' ? 'border-gold-400 bg-gold-400/10 text-gold-300' : 'border-ink-800 text-white/50'}`}>
              <Wallet size={15} /> Saldo
            </button>
          </div>

          {method === 'pix' && (
            <>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button onClick={submitPix} disabled={loading} className="btn-gold w-full">
                {loading ? 'Gerando Pix...' : isRenewal ? 'Renovar assinatura via Pix' : 'Ativar assinatura via Pix'}
              </button>
            </>
          )}

          {method === 'credit_card' && plan === 'annual' && (
            <form onSubmit={submitCard} className="space-y-3">
              <input className="input" placeholder="Nome no cartão" required value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} />
              <input className="input" placeholder="Número do cartão" required inputMode="numeric" value={maskCardNumber(cardNumber)} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))} />
              <div className="grid grid-cols-3 gap-2">
                <input className="input" placeholder="MM/AA" required inputMode="numeric" value={cardExpiry} onChange={(e) => setCardExpiry(maskCardExpiry(e.target.value))} />
                <input className="input" placeholder="CVV" required inputMode="numeric" maxLength={4} value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} />
                <input className="input" placeholder="Nº endereço" required inputMode="numeric" value={cardAddressNumber} onChange={(e) => setCardAddressNumber(e.target.value.replace(/\D/g, ''))} />
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button type="submit" disabled={loading} className="btn-gold w-full">{loading ? 'Processando...' : `Pagar ${formatBRL(PLAN_PRICES.annual)} no cartão`}</button>
            </form>
          )}

          {method === 'wallet' && (
            <div className="space-y-3">
              <div className="card !py-3 flex items-center justify-between text-sm">
                <span className="text-white/50">Saldo disponível</span>
                <span className="font-semibold">{formatBRL(walletAvailable)}</span>
              </div>
              {walletAvailable < amount && (
                <p className="text-sm text-red-400">Saldo insuficiente para esse plano. Escolha Pix{plan === 'annual' ? ' ou cartão' : ''}, ou aguarde seu saldo ficar disponível.</p>
              )}
              {error && <p className="text-sm text-red-400">{error}</p>}
              <button onClick={submitWallet} disabled={loading || walletAvailable < amount} className="btn-gold w-full disabled:opacity-40">
                {loading ? 'Processando...' : `Pagar ${formatBRL(amount)} com saldo`}
              </button>
            </div>
          )}
        </>
      )}

      {pixCode && (
        <div className="card space-y-4 text-center">
          <p className="text-sm text-white/50">
            Plano {plan === 'annual' ? 'anual' : 'mensal'} · <span className="text-white font-semibold">{formatBRL(amount)}</span>
          </p>
          <div className="w-40 h-40 mx-auto rounded-xl bg-white p-3 flex items-center justify-center overflow-hidden">
            {pixQrCode ? <img src={`data:image/png;base64,${pixQrCode}`} alt="QR Code Pix" className="w-full h-full object-contain" /> : null}
          </div>
          <button onClick={copyPix} className="btn-dark w-full !py-2.5 text-sm gap-2">
            <Copy size={14} /> {copied ? 'Código copiado!' : 'Copiar código Pix'}
          </button>
          <p className="text-xs text-white/40">A confirmação é automática assim que a Asaas identificar o pagamento, normalmente em poucos segundos.</p>
          <button onClick={() => { reload(); navigate('/app') }} className="btn-gold w-full gap-2"><Check size={16} /> Ver meu painel</button>
        </div>
      )}
    </div>
  )
}
