import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Copy, CreditCard, KeyRound, QrCode, ShieldCheck, User, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LogoBadge } from '../../components/layout/Logo'
import { isValidCPF, maskCPF, maskPhone, maskCardNumber, maskCardExpiry, formatBRL } from '../../lib/format'
import { PLAN_PRICES, ANNUAL_DISCOUNT_PCT, ANNUAL_MONTHLY_EQUIVALENT } from '../../lib/plans'
import type { SubscriptionPlan } from '../../lib/types'

type PaymentMethod = 'pix' | 'credit_card'

type Step = 1 | 2 | 3 | 4

// A escolha do ponto de retirada acontece depois, dentro do app, quando a
// assinatura já estiver ativa — não é parte deste assistente. Se a pessoa
// sair antes de terminar o passo 4 (ou deixar a assinatura vencer depois),
// o próprio painel (SubscriberShell -> SubscriptionPaywall) mostra a mesma
// tela de assinatura/Pix como rede de segurança — este assistente não é o
// único jeito de chegar lá, só o caminho normal de quem termina o cadastro
// de uma vez.
const STEPS = [
  { n: 1, label: 'Cadastro', icon: User },
  { n: 2, label: 'Confirmar e-mail', icon: KeyRound },
  { n: 3, label: 'Assinatura', icon: ShieldCheck },
  { n: 4, label: 'Pagamento', icon: Wallet },
]

export default function Signup() {
  const [params] = useSearchParams()
  const referralCode = params.get('ref') ?? ''
  const navigate = useNavigate()

  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [fullName, setFullName] = useState('')
  const [cpf, setCpf] = useState('')
  const [birthDate, setBirthDate] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accepted, setAccepted] = useState(false)

  const [code, setCode] = useState('')
  const [resent, setResent] = useState(false)

  const [plan, setPlan] = useState<SubscriptionPlan>('monthly')
  const [pixCode, setPixCode] = useState('')
  const [pixQrCode, setPixQrCode] = useState('')
  const [copied, setCopied] = useState(false)

  // Cartão só existe pro plano anual — o mensal é Pix obrigatório, sem
  // opção de escolha (nem aparece o seletor abaixo).
  const [method, setMethod] = useState<PaymentMethod>('pix')
  const [cardName, setCardName] = useState('')
  const [cardNumber, setCardNumber] = useState('')
  const [cardExpiry, setCardExpiry] = useState('')
  const [cardCvv, setCardCvv] = useState('')
  const [cardAddressNumber, setCardAddressNumber] = useState('')

  // complete_signup só pode ser chamada com uma sessão de verdade (ela é
  // SECURITY DEFINER mas authenticated-only — anon não tem EXECUTE nela de
  // propósito). Enquanto a confirmação de e-mail estiver pendente não
  // existe sessão nenhuma ainda, então isso só pode rodar depois que
  // verifyOtp (ou o signUp direto, quando a confirmação está desligada)
  // efetivamente estabelecer uma.
  async function runCompleteSignup() {
    const { error: rpcError } = await supabase.rpc('complete_signup', {
      p_full_name: fullName,
      p_cpf: cpf.replace(/\D/g, ''),
      p_birth_date: birthDate,
      p_phone: phone.replace(/\D/g, ''),
      p_email: email,
      p_referral_code: referralCode || null,
    })
    if (rpcError) {
      setError(rpcError.message.includes('CPF_ALREADY_REGISTERED') ? 'Este CPF já possui cadastro na Brinde Mais.' : 'Erro ao concluir cadastro: ' + rpcError.message)
      return false
    }
    return true
  }

  async function handleStep1(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isValidCPF(cpf)) return setError('CPF inválido. Confira os números digitados.')
    if (!accepted) return setError('É necessário aceitar os Termos de Uso e a Política de Privacidade.')

    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) {
      setLoading(false)
      setError(signUpError?.message.includes('already registered') ? 'Este e-mail já está cadastrado.' : 'Não foi possível concluir o cadastro.')
      return
    }

    // data.session só vem preenchido quando o Supabase confirma o e-mail
    // sozinho (ou seja, "Confirm email" está desligado em Authentication
    // settings) — nesse caso já existe sessão válida, então dá pra
    // concluir o cadastro agora e pular direto pra escolha de assinatura.
    // Com a confirmação ativada, data.session vem null até o código ser
    // verificado — concluir o cadastro aqui seria chamar a RPC sem sessão
    // nenhuma (como anon, sem permissão nela de propósito), então só
    // avança pro passo do código e deixa complete_signup pra depois dele.
    if (data.session) {
      const ok = await runCompleteSignup()
      setLoading(false)
      if (!ok) return
      setStep(3)
      return
    }
    setLoading(false)
    setStep(2)
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'signup' })
    if (verifyError) {
      setLoading(false)
      setError('Código incorreto ou expirado. Confira o e-mail ou peça um novo código.')
      return
    }
    const ok = await runCompleteSignup()
    setLoading(false)
    if (!ok) return
    setStep(3)
  }

  async function resendCode() {
    setError(null)
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })
    if (!resendError) {
      setResent(true)
      setTimeout(() => setResent(false), 4000)
    }
  }

  async function handleActivateSubscription() {
    setLoading(true)
    setError(null)
    const { data: userRes } = await supabase.auth.getUser()
    const uid = userRes.user?.id
    if (!uid) { setLoading(false); return }

    const amount = PLAN_PRICES[plan]
    const { data: payment, error: payErr } = await supabase.from('payments').insert({
      subscriber_id: uid,
      amount,
      plan,
      type: 'subscription',
      payment_method: 'pix',
    }).select('id').single()
    if (payErr || !payment) {
      setLoading(false)
      setError('Não foi possível gerar o Pix. Tente novamente.')
      return
    }

    const { data: charge, error: chargeError } = await supabase.functions.invoke('asaas-create-pix-charge', { body: { payment_id: payment.id } })
    setLoading(false)
    if (chargeError || !charge?.pix_code) {
      setError('Não foi possível gerar o Pix. Tente novamente em instantes.')
      return
    }
    setPixCode(charge.pix_code)
    setPixQrCode(charge.pix_qr_code ?? '')
    setStep(4)
  }

  async function handleCardPayment(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { data: userRes } = await supabase.auth.getUser()
    const uid = userRes.user?.id
    if (!uid) { setLoading(false); return }

    const { data: payment, error: payErr } = await supabase.from('payments').insert({
      subscriber_id: uid,
      amount: PLAN_PRICES.annual,
      plan: 'annual',
      type: 'subscription',
      payment_method: 'credit_card',
    }).select('id').single()
    if (payErr || !payment) {
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
      setError('Cartão recusado. Confira os dados, tente outro cartão ou pague via Pix.')
      return
    }
    navigate('/app')
  }

  function copyPix() {
    navigator.clipboard.writeText(pixCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="min-h-dvh bg-white px-5 py-8">
      <div className="max-w-md mx-auto">
        <Link to="/" className="flex justify-center mb-5"><LogoBadge size={110} /></Link>

        <div className="flex items-center justify-between mb-8">
          {STEPS.map((s, i) => (
            <div key={s.n} className="flex items-center flex-1 last:flex-none">
              <div className="flex flex-col items-center gap-1.5">
                <div
                  className={`w-9 h-9 rounded-full flex items-center justify-center border ${
                    step >= s.n ? 'bg-gold-gradient border-transparent text-ink-950' : 'border-black/15 text-black/30'
                  }`}
                >
                  {step > s.n ? <Check size={16} /> : <s.icon size={15} />}
                </div>
                <span className={`text-[10px] font-medium ${step >= s.n ? 'text-gold-600' : 'text-black/30'}`}>{s.label}</span>
              </div>
              {i < STEPS.length - 1 && <div className={`h-px flex-1 mx-1 ${step > s.n ? 'bg-gold-400' : 'bg-black/10'}`} />}
            </div>
          ))}
        </div>

        {step === 1 && (
          <form onSubmit={handleStep1} className="card-light space-y-4">
            <h1 className="font-display text-xl font-semibold text-ink-950">Crie sua conta</h1>
            <p className="text-sm text-black/50 -mt-2">Preencha seus dados para começar</p>
            {referralCode && (
              <p className="text-xs bg-gold-400/10 text-gold-700 rounded-lg px-3 py-2">Convidado por código {referralCode.toUpperCase()}</p>
            )}
            <div>
              <label className="label-light">Nome completo</label>
              <input className="input-light" required value={fullName} onChange={(e) => setFullName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-light">CPF</label>
                <input className="input-light" required value={cpf} onChange={(e) => setCpf(maskCPF(e.target.value))} placeholder="000.000.000-00" />
              </div>
              <div>
                <label className="label-light">Data de nascimento</label>
                <input className="input-light" type="date" required value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
              </div>
            </div>
            <div>
              <label className="label-light">Celular</label>
              <input className="input-light" required value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" />
            </div>
            <div>
              <label className="label-light">E-mail</label>
              <input className="input-light" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label-light">Senha</label>
              <input className="input-light" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <label className="flex items-start gap-2.5 text-xs text-black/60">
              <input type="checkbox" className="mt-0.5" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              Li e aceito os <Link to="/termos" target="_blank" className="text-gold-600 underline">Termos e Condições</Link> e a{' '}
              <Link to="/privacidade" target="_blank" className="text-gold-600 underline">Política de Privacidade</Link>.
            </label>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className="btn-gold w-full">{loading ? 'Enviando...' : 'Continuar'}</button>
            <p className="text-center text-sm text-black/40">Já tem uma conta? <Link to="/entrar/assinante" className="text-gold-600">Entrar</Link></p>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyCode} className="card-light space-y-4 text-center">
            <div className="w-14 h-14 rounded-full bg-gold-400/15 flex items-center justify-center mx-auto">
              <KeyRound size={24} className="text-gold-500" />
            </div>
            <div>
              <h1 className="font-display text-xl font-semibold text-ink-950">Confirme seu e-mail</h1>
              <p className="text-sm text-black/50 mt-1">Enviamos um código de 6 dígitos para <strong>{email}</strong>.</p>
            </div>
            <input
              className="input-light text-center text-2xl tracking-[0.5em] font-mono"
              required
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="000000"
            />
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading || code.length < 6} className="btn-gold w-full">{loading ? 'Confirmando...' : 'Confirmar código'}</button>
            <button type="button" onClick={resendCode} className="text-xs text-gold-600 font-medium">
              {resent ? 'Código reenviado!' : 'Não recebeu? Reenviar código'}
            </button>
          </form>
        )}

        {step === 3 && (
          <div className="card-light space-y-5">
            <h1 className="font-display text-xl font-semibold text-ink-950">Ative sua assinatura</h1>
            <div className="grid grid-cols-1 gap-3">
              <button
                type="button"
                onClick={() => setPlan('monthly')}
                className={`text-left rounded-xl p-5 border transition ${plan === 'monthly' ? 'border-gold-400 bg-gold-400/10' : 'border-black/10'}`}
              >
                <p className="text-xs font-bold uppercase text-black/50">Plano mensal</p>
                <p className="text-3xl font-bold text-ink-950 mt-1">{formatBRL(PLAN_PRICES.monthly)}<span className="text-sm font-medium text-black/40">/mês</span></p>
                <p className="text-xs text-black/40 mt-1">Renovação a cada 30 dias · cancele quando quiser</p>
              </button>
              <button
                type="button"
                onClick={() => setPlan('annual')}
                className={`relative text-left rounded-xl p-5 border transition ${plan === 'annual' ? 'border-gold-400 bg-gold-400/10' : 'border-black/10'}`}
              >
                <span className="absolute top-4 right-4 pill bg-gold-gradient text-ink-950 font-bold">-{ANNUAL_DISCOUNT_PCT}%</span>
                <p className="text-xs font-bold uppercase text-black/50">Plano anual</p>
                <p className="text-3xl font-bold text-ink-950 mt-1">12x {formatBRL(ANNUAL_MONTHLY_EQUIVALENT)}<span className="text-sm font-medium text-black/40">/mês</span></p>
                <p className="text-xs text-black/40 mt-1">Pacote de 12 meses, cobrado uma vez</p>
              </button>
            </div>
            <ul className="space-y-2.5 text-sm text-black/65">
              {['Brinde mensal em parceiro de sua escolha', 'Descontos exclusivos em toda a rede', 'Cashback e bonificação por indicação'].map((b) => (
                <li key={b} className="flex gap-2"><Check size={16} className="text-gold-500 shrink-0 mt-0.5" />{b}</li>
              ))}
            </ul>

            {plan === 'annual' && (
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setMethod('pix')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium border transition ${method === 'pix' ? 'border-gold-400 bg-gold-400/10 text-gold-700' : 'border-black/10 text-black/50'}`}
                >
                  <QrCode size={15} /> Pix
                </button>
                <button
                  type="button"
                  onClick={() => setMethod('credit_card')}
                  className={`flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium border transition ${method === 'credit_card' ? 'border-gold-400 bg-gold-400/10 text-gold-700' : 'border-black/10 text-black/50'}`}
                >
                  <CreditCard size={15} /> Cartão
                </button>
              </div>
            )}

            {plan === 'monthly' || method === 'pix' ? (
              <>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button onClick={handleActivateSubscription} disabled={loading} className="btn-gold w-full">
                  {loading ? 'Gerando Pix...' : 'Ativar assinatura via Pix'}
                </button>
              </>
            ) : (
              <form onSubmit={handleCardPayment} className="space-y-3">
                <div>
                  <label className="label-light">Nome no cartão</label>
                  <input className="input-light" required value={cardName} onChange={(e) => setCardName(e.target.value.toUpperCase())} />
                </div>
                <div>
                  <label className="label-light">Número do cartão</label>
                  <input className="input-light" required inputMode="numeric" value={maskCardNumber(cardNumber)} onChange={(e) => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16))} placeholder="0000 0000 0000 0000" />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="label-light">Validade</label>
                    <input className="input-light" required inputMode="numeric" value={cardExpiry} onChange={(e) => setCardExpiry(maskCardExpiry(e.target.value))} placeholder="MM/AA" />
                  </div>
                  <div>
                    <label className="label-light">CVV</label>
                    <input className="input-light" required inputMode="numeric" maxLength={4} value={cardCvv} onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, '').slice(0, 4))} placeholder="000" />
                  </div>
                  <div>
                    <label className="label-light">Nº endereço</label>
                    <input className="input-light" required inputMode="numeric" value={cardAddressNumber} onChange={(e) => setCardAddressNumber(e.target.value.replace(/\D/g, ''))} placeholder="123" />
                  </div>
                </div>
                <p className="text-[11px] text-black/40">Cobrança única de {formatBRL(PLAN_PRICES.annual)}. Número e CVV vão direto e criptografados até a operadora do cartão — não ficam salvos aqui.</p>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button type="submit" disabled={loading} className="btn-gold w-full">
                  {loading ? 'Processando pagamento...' : `Pagar ${formatBRL(PLAN_PRICES.annual)} no cartão`}
                </button>
              </form>
            )}
          </div>
        )}

        {step === 4 && (
          <div className="card-light space-y-5 text-center">
            <h1 className="font-display text-xl font-semibold text-ink-950">Pagamento via Pix</h1>
            <div className="w-44 h-44 mx-auto rounded-xl bg-white border border-black/10 p-3 flex items-center justify-center overflow-hidden">
              {pixQrCode ? (
                <img src={`data:image/png;base64,${pixQrCode}`} alt="QR Code Pix" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full bg-[repeating-linear-gradient(45deg,#111_0,#111_4px,#fff_4px,#fff_8px)] opacity-80 rounded" />
              )}
            </div>
            <p className="text-sm text-black/50">Escaneie o QR Code ou copie o código Pix abaixo para pagar {formatBRL(PLAN_PRICES[plan])}.</p>
            <button onClick={copyPix} className="btn-dark-light w-full !py-2.5 text-sm gap-2">
              <Copy size={14} /> {copied ? 'Código copiado!' : 'Copiar código Pix'}
            </button>
            <div className="rounded-lg bg-black/5 border border-black/10 p-3 text-[10px] text-black/40 break-all">{pixCode}</div>
            <p className="text-xs text-black/40">
              A confirmação é automática assim que a Asaas identificar o pagamento, normalmente em poucos segundos. Seu
              painel libera sozinho — não precisa voltar aqui.
            </p>
            <button onClick={() => navigate('/app')} className="btn-gold w-full">Ir para o painel</button>
            <button type="button" onClick={() => setStep(3)} className="text-xs text-black/40 w-full text-center">
              Voltar e escolher outro plano
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
