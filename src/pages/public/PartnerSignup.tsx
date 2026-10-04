import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, Copy, KeyRound, ShieldCheck, Store } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LogoBadge } from '../../components/layout/Logo'
import { ReferralFields } from '../../components/ui/ReferralFields'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { PARTNER_CATEGORIES } from '../../lib/types'
import { isValidEmail, isValidPhone, maskCEP, maskPhone, formatBRL } from '../../lib/format'

type Step = 1 | 2 | 3

const FEE_AMOUNT = 149.9

const STEPS = [
  { n: 1, label: 'Cadastro', icon: Store },
  { n: 2, label: 'Confirmar e-mail', icon: KeyRound },
  { n: 3, label: 'Pagamento', icon: ShieldCheck },
]

function partnerSignupErrorMessage(message: string): string {
  if (message.includes('INVALID_EMAIL')) return 'Digite um e-mail válido.'
  if (message.includes('FULL_NAME_ALREADY_REGISTERED')) return 'Já existe um cadastro com esse nome de responsável.'
  if (message.includes('CNPJ_ALREADY_REGISTERED')) return 'Já existe um parceiro cadastrado com esse CNPJ/CPF.'
  if (message.includes('PHONE_ALREADY_REGISTERED')) return 'Este telefone já possui cadastro na Brinde Mais.'
  if (message.includes('INVALID_PHONE')) return 'Digite um telefone válido, com DDD.'
  if (message.includes('REFERRAL_REQUIRED') || message.includes('REFERRER_NOT_FOUND')) return 'Código de indicação inválido ou não encontrado.'
  if (message.includes('REFERRAL_LOGIN_TAKEN')) return 'Seu link de indicação já está em uso, escolha outro.'
  if (message.includes('REFERRAL_LOGIN_TOO_SHORT')) return 'Seu link de indicação precisa ter pelo menos 3 letras ou números.'
  return 'Erro ao concluir cadastro: ' + message
}

// Cadastro de parceiro já cria o login e cobra a taxa de anunciante na
// hora, igual o cadastro de assinante — não fica mais esperando a equipe
// aprovar pra só então convidar e cobrar. A aprovação do admin continua
// existindo (partners.status), só que agora ela controla a visibilidade
// pública do estabelecimento, não o acesso ao painel nem o pagamento.
export default function PartnerSignup() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [step, setStep] = useState<Step>(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [referralCode, setReferralCode] = useState(params.get('ref') ?? '')
  const [myReferralCode, setMyReferralCode] = useState('')
  const [referralValid, setReferralValid] = useState(false)

  const [companyName, setCompanyName] = useState('')
  const [tradeName, setTradeName] = useState('')
  const [cnpjCpf, setCnpjCpf] = useState('')
  const [responsibleName, setResponsibleName] = useState('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [category, setCategory] = useState('bar')
  const [cep, setCep] = useState('')
  const [city, setCity] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [address, setAddress] = useState('')
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [accepted, setAccepted] = useState(false)

  const [code, setCode] = useState('')
  const [resent, setResent] = useState(false)

  const [pixCode, setPixCode] = useState('')
  const [pixQrCode, setPixQrCode] = useState('')
  const [copied, setCopied] = useState(false)

  async function runCompletePartnerSignup(): Promise<string | null> {
    const { data, error: rpcError } = await supabase.rpc('complete_partner_signup', {
      p_company_name: companyName,
      p_trade_name: tradeName,
      p_cnpj_cpf: cnpjCpf,
      p_responsible_name: responsibleName,
      p_phone: phone.replace(/\D/g, ''),
      p_whatsapp: whatsapp.replace(/\D/g, ''),
      p_email: email,
      p_category: category,
      p_city: city || null,
      p_neighborhood: neighborhood || null,
      p_address: address || null,
      p_referral_code: referralCode,
      p_my_referral_code: myReferralCode,
    })
    if (rpcError || !data) {
      setError(partnerSignupErrorMessage(rpcError?.message ?? ''))
      return null
    }
    return (data as { id: string }).id
  }

  async function saveExtras(partnerId: string) {
    if (!cep && !logoUrl) return
    await supabase.from('partners').update({ cep: cep.replace(/\D/g, '') || null, logo_url: logoUrl }).eq('id', partnerId)
  }

  async function activateFeePayment(partnerId: string) {
    const { data: userRes } = await supabase.auth.getUser()
    const uid = userRes.user?.id
    if (!uid) return false

    const { data: payment, error: payErr } = await supabase.from('payments').insert({
      subscriber_id: uid,
      partner_id: partnerId,
      amount: FEE_AMOUNT,
      type: 'partner_fee',
      payment_method: 'pix',
    }).select('id').single()
    if (payErr || !payment) {
      setError('Não foi possível gerar o Pix. Tente novamente.')
      return false
    }

    const { data: charge, error: chargeError } = await supabase.functions.invoke('asaas-create-pix-charge', { body: { payment_id: payment.id } })
    if (chargeError || !charge?.pix_code) {
      setError('Não foi possível gerar o Pix. Tente novamente em instantes.')
      return false
    }
    setPixCode(charge.pix_code)
    setPixQrCode(charge.pix_qr_code ?? '')
    return true
  }

  async function handleStep1(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (!isValidEmail(email)) return setError('Digite um e-mail válido.')
    if (!isValidPhone(phone)) return setError('Digite um telefone válido, com DDD.')
    if (!referralValid) return setError('Preencha quem indicou você e escolha seu link de indicação antes de continuar.')
    if (!accepted) return setError('É necessário aceitar os Termos de Uso e a Política de Privacidade.')

    setLoading(true)
    const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError || !data.user) {
      setLoading(false)
      setError(signUpError?.message.includes('already registered') ? 'Este e-mail já está cadastrado.' : 'Não foi possível concluir o cadastro.')
      return
    }

    if (data.session) {
      const partnerId = await runCompletePartnerSignup()
      if (!partnerId) { setLoading(false); return }
      await saveExtras(partnerId)
      const paid = await activateFeePayment(partnerId)
      setLoading(false)
      if (!paid) return
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
    const partnerId = await runCompletePartnerSignup()
    if (!partnerId) { setLoading(false); return }
    await saveExtras(partnerId)
    const paid = await activateFeePayment(partnerId)
    setLoading(false)
    if (!paid) return
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
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gold-600 mb-1">Para o seu negócio</p>
              <h1 className="font-display text-xl font-semibold text-ink-950">Quero ser parceiro</h1>
              <p className="text-sm text-black/50 mt-1">Preencha os dados do seu estabelecimento e ative sua conta agora.</p>
              <p className="text-xs text-black/40 mt-2 bg-gold-400/10 text-gold-700 rounded-lg px-3 py-2">
                Taxa de anunciante: {formatBRL(FEE_AMOUNT)}/mês, mesmo valor da assinatura Brinde Mais. Paga por Pix ao final deste cadastro, libera sua área de anunciante no painel do parceiro.
              </p>
            </div>

            <div>
              <ImageUpload
                value={logoUrl}
                onChange={setLogoUrl}
                folder="partner-logos"
                label="Logotipo do estabelecimento"
                circular
                light
                hint="Tamanho recomendado: 512x512px, formato quadrado, até 4MB."
              />
            </div>

            <div>
              <label className="label-light">Razão social</label>
              <input className="input-light" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} />
            </div>
            <div>
              <label className="label-light">Nome fantasia</label>
              <input className="input-light" required value={tradeName} onChange={(e) => setTradeName(e.target.value)} />
            </div>

            <ReferralFields
              referrerCode={referralCode}
              onReferrerCodeChange={setReferralCode}
              myCode={myReferralCode}
              onMyCodeChange={setMyReferralCode}
              autoSuggestSource={tradeName}
              myCodeLabel="Nome de usuário"
              myCodeHint="Nome artístico, nome do estabelecimento ou apelido — não pode repetir, e também é o nome que vai aparecer no seu link de indicação."
              onValidityChange={setReferralValid}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-light">CNPJ ou CPF</label>
                <input className="input-light" required value={cnpjCpf} onChange={(e) => setCnpjCpf(e.target.value)} />
              </div>
              <div>
                <label className="label-light">Categoria</label>
                <select className="input-light" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {PARTNER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="label-light">Nome do responsável</label>
              <input className="input-light" required value={responsibleName} onChange={(e) => setResponsibleName(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-light">Telefone</label>
                <input className="input-light" required value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} placeholder="(11) 99999-9999" />
              </div>
              <div>
                <label className="label-light">WhatsApp (se diferente)</label>
                <input className="input-light" value={whatsapp} onChange={(e) => setWhatsapp(maskPhone(e.target.value))} placeholder="(11) 99999-9999" />
              </div>
            </div>
            <div>
              <label className="label-light">E-mail</label>
              <input className="input-light" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
            <div>
              <label className="label-light">Senha</label>
              <input className="input-light" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-light">CEP</label>
                <input className="input-light" value={cep} onChange={(e) => setCep(maskCEP(e.target.value))} placeholder="00000-000" />
              </div>
              <div>
                <label className="label-light">Bairro</label>
                <input className="input-light" value={neighborhood} onChange={(e) => setNeighborhood(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label-light">Cidade</label>
                <input className="input-light" value={city} onChange={(e) => setCity(e.target.value)} placeholder="Rio de Janeiro" />
              </div>
              <div>
                <label className="label-light">Endereço</label>
                <input className="input-light" value={address} onChange={(e) => setAddress(e.target.value)} />
              </div>
            </div>

            <label className="flex items-start gap-2.5 text-xs text-black/60">
              <input type="checkbox" className="mt-0.5" checked={accepted} onChange={(e) => setAccepted(e.target.checked)} />
              Li e aceito os <Link to="/termos" target="_blank" className="text-gold-600 underline">Termos e Condições</Link> e a{' '}
              <Link to="/privacidade" target="_blank" className="text-gold-600 underline">Política de Privacidade</Link>.
            </label>

            <p className="flex items-start gap-2 text-xs text-black/45">
              <ShieldCheck size={14} className="shrink-0 mt-0.5" />
              O estabelecimento só aparece publicamente na plataforma depois da análise e aprovação da nossa equipe.
              O pagamento da taxa e o acesso ao painel já ficam liberados assim que você concluir este cadastro.
            </p>

            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading || !referralValid} className="btn-gold w-full">{loading ? 'Enviando...' : 'Continuar para pagamento'}</button>
            <p className="text-center text-sm text-black/40">Já é parceiro? <Link to="/entrar/parceiro" className="text-gold-600">Entrar</Link></p>
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
          <div className="card-light space-y-5 text-center">
            <h1 className="font-display text-xl font-semibold text-ink-950">Pagamento via Pix</h1>
            <div className="w-44 h-44 mx-auto rounded-xl bg-white border border-black/10 p-3 flex items-center justify-center overflow-hidden">
              {pixQrCode ? (
                <img src={`data:image/png;base64,${pixQrCode}`} alt="QR Code Pix" className="w-full h-full object-contain" />
              ) : (
                <div className="w-full h-full bg-[repeating-linear-gradient(45deg,#111_0,#111_4px,#fff_4px,#fff_8px)] opacity-80 rounded" />
              )}
            </div>
            <p className="text-sm text-black/50">Escaneie o QR Code ou copie o código Pix abaixo para pagar {formatBRL(FEE_AMOUNT)}.</p>
            <button onClick={copyPix} className="btn-dark-light w-full !py-2.5 text-sm gap-2">
              <Copy size={14} /> {copied ? 'Código copiado!' : 'Copiar código Pix'}
            </button>
            <div className="rounded-lg bg-black/5 border border-black/10 p-3 text-[10px] text-black/40 break-all">{pixCode}</div>
            <p className="text-xs text-black/40">
              A confirmação é automática assim que a Asaas identificar o pagamento, normalmente em poucos segundos. Seu
              painel libera sozinho, não precisa voltar aqui.
            </p>
            <button onClick={() => navigate('/parceiro')} className="btn-gold w-full">Ir para o painel</button>
          </div>
        )}
      </div>
    </div>
  )
}
