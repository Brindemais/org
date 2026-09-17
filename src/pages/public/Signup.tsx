import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { KeyRound, ShieldCheck, User } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LogoBadge } from '../../components/layout/Logo'
import { isValidCPF, maskCPF, maskPhone } from '../../lib/format'

type Step = 1 | 2

// A escolha de plano e o pagamento Pix não fazem mais parte deste
// assistente — acontecem dentro do próprio painel (SubscriptionPaywall),
// que passa a ser a tela que qualquer assinante sem assinatura ativa vê
// ao entrar em /app, seja no primeiro cadastro ou numa renovação depois
// de vencida. Este fluxo agora só cria a conta e confirma o e-mail.
const STEPS = [
  { n: 1, label: 'Cadastro', icon: User },
  { n: 2, label: 'Confirmar e-mail', icon: ShieldCheck },
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

    // data.session is already present when Supabase auto-confirms the
    // email (i.e. "Confirm email" is off in Authentication settings) —
    // skip straight to the app instead of stranding the person on a code
    // screen no code was ever sent for. The moment that setting gets
    // turned on, signUp starts returning session: null and this same
    // code automatically starts asking for the OTP, no redeploy needed.
    if (data.session) {
      navigate('/app')
      return
    }
    setStep(2)
  }

  async function handleVerifyCode(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'signup' })
    setLoading(false)
    if (verifyError) {
      setError('Código incorreto ou expirado. Confira o e-mail ou peça um novo código.')
      return
    }
    navigate('/app')
  }

  async function resendCode() {
    setError(null)
    const { error: resendError } = await supabase.auth.resend({ type: 'signup', email })
    if (!resendError) {
      setResent(true)
      setTimeout(() => setResent(false), 4000)
    }
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
                  <s.icon size={15} />
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
      </div>
    </div>
  )
}
