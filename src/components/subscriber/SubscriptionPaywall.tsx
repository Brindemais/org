import { useEffect, useState } from 'react'
import { Check, Copy, LogOut, RefreshCw } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatBRL } from '../../lib/format'
import { PLAN_PRICES, ANNUAL_DISCOUNT_PCT, ANNUAL_MONTHLY_EQUIVALENT } from '../../lib/plans'
import { LogoBadge } from '../layout/Logo'
import type { SubscriptionPlan } from '../../lib/types'

interface PendingPayment { id: string; pix_code: string | null; pix_qr_code: string | null; created_at: string; plan: SubscriptionPlan | null; amount: number }

// Shown instead of the whole subscriber dashboard whenever the signed-in
// account has no active, unexpired subscription — a brand-new signup that
// hasn't paid yet, or someone whose subscription lapsed and needs to
// renew. Same screen either way: pick a plan, pay via Pix, wait for the
// team to confirm (this platform's payments are all manually confirmed —
// there's no live push, so "Já paguei" just re-checks instead of assuming).
export function SubscriptionPaywall() {
  const { user, refreshProfile, signOut } = useAuth()
  const [pending, setPending] = useState<PendingPayment | null>(null)
  const [plan, setPlan] = useState<SubscriptionPlan>('monthly')
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return
    supabase.from('payments').select('id, pix_code, pix_qr_code, created_at, plan, amount').eq('subscriber_id', user.id).eq('type', 'subscription').eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setPending(data as PendingPayment | null))
  }, [user])

  async function activate() {
    if (!user) return
    setLoading(true)
    setError(null)
    const amount = PLAN_PRICES[plan]
    const { data, error: insertError } = await supabase.from('payments').insert({
      subscriber_id: user.id, amount, plan, type: 'subscription',
    }).select('id, pix_code, pix_qr_code, created_at, plan, amount').single()
    if (insertError || !data) {
      setLoading(false)
      setError('Não foi possível gerar o Pix. Tente novamente.')
      return
    }
    const { data: charge, error: chargeError } = await supabase.functions.invoke('asaas-create-pix-charge', { body: { payment_id: data.id } })
    setLoading(false)
    if (chargeError || !charge?.pix_code) { setError('Não foi possível gerar o Pix. Tente novamente.'); return }
    setPending({ ...data, pix_code: charge.pix_code, pix_qr_code: charge.pix_qr_code ?? null } as PendingPayment)
  }

  function copyPix() {
    if (!pending?.pix_code) return
    navigator.clipboard.writeText(pending.pix_code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function checkStatus() {
    setChecking(true)
    await refreshProfile()
    setChecking(false)
  }

  return (
    <div className="min-h-dvh bg-white px-5 py-10 flex items-center justify-center">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6"><LogoBadge size={110} /></div>
        <div className="card-light space-y-5">
          {pending ? (
            <>
              <div className="text-center">
                <h1 className="font-display text-xl font-semibold text-ink-950">Pagamento via Pix</h1>
                <p className="text-sm text-black/50 mt-1">Escaneie ou copie o código abaixo para pagar {formatBRL(pending.amount)}.</p>
              </div>
              <div className="w-40 h-40 mx-auto rounded-xl bg-white border border-black/10 p-3 flex items-center justify-center overflow-hidden">
                {pending.pix_qr_code ? (
                  <img src={`data:image/png;base64,${pending.pix_qr_code}`} alt="QR Code Pix" className="w-full h-full object-contain" />
                ) : (
                  <div className="w-full h-full bg-[repeating-linear-gradient(45deg,#111_0,#111_4px,#fff_4px,#fff_8px)] opacity-80 rounded" />
                )}
              </div>
              <button onClick={copyPix} className="btn-dark-light w-full !py-2.5 text-sm gap-2">
                <Copy size={14} /> {copied ? 'Código copiado!' : 'Copiar código Pix'}
              </button>
              <div className="rounded-lg bg-black/5 border border-black/10 p-3 text-[10px] text-black/40 break-all">{pending.pix_code}</div>
              <p className="text-xs text-black/40 text-center">
                A confirmação é automática assim que a Asaas identificar o pagamento, normalmente em poucos segundos.
              </p>
              <button onClick={checkStatus} disabled={checking} className="btn-gold w-full gap-2">
                <RefreshCw size={14} className={checking ? 'animate-spin' : ''} /> {checking ? 'Verificando...' : 'Já paguei, verificar'}
              </button>
            </>
          ) : (
            <>
              <div className="text-center">
                <h1 className="font-display text-xl font-semibold text-ink-950">Ative sua assinatura</h1>
                <p className="text-sm text-black/50 mt-1">Sua conta já existe — falta só escolher o plano e pagar para liberar o painel.</p>
              </div>
              <div className="grid grid-cols-1 gap-3">
                <button
                  type="button"
                  onClick={() => setPlan('monthly')}
                  className={`text-left rounded-xl p-4 border transition ${plan === 'monthly' ? 'border-gold-400 bg-gold-400/10' : 'border-black/10'}`}
                >
                  <p className="text-xs font-bold uppercase text-black/50">Plano mensal</p>
                  <p className="text-2xl font-bold text-ink-950 mt-1">{formatBRL(PLAN_PRICES.monthly)}<span className="text-sm font-medium text-black/40">/mês</span></p>
                </button>
                <button
                  type="button"
                  onClick={() => setPlan('annual')}
                  className={`relative text-left rounded-xl p-4 border transition ${plan === 'annual' ? 'border-gold-400 bg-gold-400/10' : 'border-black/10'}`}
                >
                  <span className="absolute top-4 right-4 pill bg-gold-gradient text-ink-950 font-bold">-{ANNUAL_DISCOUNT_PCT}%</span>
                  <p className="text-xs font-bold uppercase text-black/50">Plano anual</p>
                  <p className="text-2xl font-bold text-ink-950 mt-1">12x {formatBRL(ANNUAL_MONTHLY_EQUIVALENT)}<span className="text-sm font-medium text-black/40">/mês</span></p>
                </button>
              </div>
              <ul className="space-y-2 text-sm text-black/65">
                {['Brinde mensal em parceiro de sua escolha', 'Descontos exclusivos em toda a rede', 'Cashback e bonificação por indicação'].map((b) => (
                  <li key={b} className="flex gap-2"><Check size={16} className="text-gold-500 shrink-0 mt-0.5" />{b}</li>
                ))}
              </ul>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button onClick={activate} disabled={loading} className="btn-gold w-full">{loading ? 'Gerando Pix...' : 'Ativar assinatura via Pix'}</button>
            </>
          )}
          <button onClick={signOut} className="flex items-center justify-center gap-1.5 text-xs text-black/40 w-full pt-1">
            <LogOut size={13} /> Sair
          </button>
        </div>
      </div>
    </div>
  )
}
