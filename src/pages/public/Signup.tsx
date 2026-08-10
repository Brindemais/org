import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Copy, ShieldCheck, User, Wallet } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LogoBadge } from '../../components/layout/Logo'
import { isValidCPF, maskCPF, maskPhone, formatBRL } from '../../lib/format'
import { PLAN_PRICES, ANNUAL_DISCOUNT_PCT, ANNUAL_MONTHLY_EQUIVALENT } from '../../lib/plans'
import type { SubscriptionPlan } from '../../lib/types'

type Step = 1 | 2 | 3

// A escolha do ponto de retirada acontece depois, dentro do app, quando a
// assinatura já estiver ativa — não é parte deste assistente de cadastro
// (que só vai até a confirmação do Pix, ver `type Step` abaixo).
const STEPS = [
  { n: 1, label: 'Cadastro', icon: User },
  { n: 2, label: 'Assinatura', icon: ShieldCheck },
  { n: 3, label: 'Pagamento Pix', icon: Wallet },
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

  const [plan, setPlan] = useState<SubscriptionPlan>('monthly')
  const [pixCode, setPixCode] = useState('')
  const [copied, setCopied] = useState(false)

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

    const { error: rpcError } = await supabase.rpc('complete_signup', {
      p_full_name: fullName,
      p_cpf: cpf.replace(/\D/g, ''),
      p_birth_date: birthDate,
      p_phone: phone.replace(/\D/g, ''),
      p_email: email,
      p_referral_code: referralCode || null,
    })
    setLoading(false)
    if (rpcError) {
      setError(rpcError.message.includes('CPF_ALREADY_REGISTERED') ? 'Este CPF já possui cadastro na Brinde Mais.' : 'Erro ao concluir cadastro: ' + rpcError.message)
      return
    }
    setStep(2)
  }

  async function handleActivateSubscription() {
    setLoading(true)
    setError(null)
    const { data: userRes } = await supabase.auth.getUser()
    const uid = userRes.user?.id
    if (!uid) { setLoading(false); return }

    const amount = PLAN_PRICES[plan]
    const fakePix = `00020126360014BR.GOV.BCB.PIX0114${uid.slice(0, 14)}5204000053039865406${amount.toFixed(2)}5802BR5913BRINDEMAIS6009RIOJANEIRO62070503***6304${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    setPixCode(fakePix)

    const { error: payErr } = await supabase.from('payments').insert({
      subscriber_id: uid,
      amount,
      plan,
      type: 'subscription',
      pix_code: fakePix,
    })
    setLoading(false)
    if (payErr) { setError('Não foi possível gerar o Pix. Tente novamente.'); return }
    setStep(3)
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
                <p className="text-3xl font-bold text-ink-950 mt-1">{formatBRL(PLAN_PRICES.annual)}<span className="text-sm font-medium text-black/40">/ano</span></p>
                <p className="text-xs text-black/40 mt-1">Equivale a {formatBRL(ANNUAL_MONTHLY_EQUIVALENT)}/mês · pacote de 12 meses, cobrado uma vez</p>
              </button>
            </div>
            <ul className="space-y-2.5 text-sm text-black/65">
              {['Brinde mensal em parceiro de sua escolha', 'Descontos exclusivos em toda a rede', 'Cashback e bonificação por indicação'].map((b) => (
                <li key={b} className="flex gap-2"><Check size={16} className="text-gold-500 shrink-0 mt-0.5" />{b}</li>
              ))}
            </ul>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button onClick={handleActivateSubscription} disabled={loading} className="btn-gold w-full">
              {loading ? 'Gerando Pix...' : 'Ativar assinatura via Pix'}
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="card-light space-y-5 text-center">
            <h1 className="font-display text-xl font-semibold text-ink-950">Pagamento via Pix</h1>
            <div className="w-44 h-44 mx-auto rounded-xl bg-white border border-black/10 p-3 flex items-center justify-center">
              <div className="w-full h-full bg-[repeating-linear-gradient(45deg,#111_0,#111_4px,#fff_4px,#fff_8px)] opacity-80 rounded" />
            </div>
            <p className="text-sm text-black/50">Escaneie o QR Code ou copie o código Pix abaixo para pagar {formatBRL(PLAN_PRICES[plan])}.</p>
            <button onClick={copyPix} className="btn-dark-light w-full !py-2.5 text-sm gap-2">
              <Copy size={14} /> {copied ? 'Código copiado!' : 'Copiar código Pix'}
            </button>
            <div className="rounded-lg bg-black/5 border border-black/10 p-3 text-[10px] text-black/40 break-all">{pixCode}</div>
            <p className="text-xs text-black/40">
              Após o pagamento, a confirmação é feita automaticamente pela plataforma de pagamentos e sua assinatura será ativada.
              Nesta versão piloto, a confirmação é validada manualmente pela equipe Brinde Mais em poucos minutos.
            </p>
            <button onClick={() => navigate('/app')} className="btn-gold w-full">Já efetuei o pagamento</button>
          </div>
        )}
      </div>
    </div>
  )
}
