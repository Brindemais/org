import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LogoBadge } from '../../components/layout/Logo'

// Ativação por código (verifyOtp type:'invite'), não por link clicável nos
// e-mails de convite (invite-partner / invite-staff) — mesmo motivo da
// redefinição de senha: clientes de e-mail que pré-acessam links por
// segurança (Apple Mail Privacy Protection, scanners corporativos) consomem
// o token de uso único antes do convidado clicar de verdade.
export default function PartnerActivate() {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
    if (password !== confirm) return setError('As senhas não coincidem.')

    setLoading(true)
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'invite' })
    if (verifyError) {
      setLoading(false)
      setError('Código incorreto ou expirado. Confira o e-mail ou peça para a equipe reenviar o convite.')
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError('Não foi possível definir sua senha. Tente novamente.')
      return
    }
    setDone(true)
    // Same activation page is used for both partner and internal staff
    // invites (invite-partner / invite-staff) — route to whichever panel
    // matches the role that was actually granted, instead of assuming
    // partner.
    const { data: userData } = await supabase.auth.getUser()
    const { data: prof } = userData.user
      ? await supabase.from('profiles').select('role').eq('id', userData.user.id).maybeSingle()
      : { data: null }
    const dest = prof?.role === 'admin' || prof?.role === 'operator' ? '/admin' : '/parceiro'
    setTimeout(() => navigate(dest), 2000)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-white px-5 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex justify-center mb-8"><LogoBadge size={130} /></Link>
        <div className="card-light">
          <h1 className="font-display text-xl font-semibold mb-1 text-ink-950">Bem-vindo à Brinde Mais</h1>

          {done ? (
            <p className="flex items-center gap-2 text-sm bg-gold-400/10 text-gold-700 rounded-lg px-3 py-3">
              <CheckCircle2 size={16} className="shrink-0" /> Senha definida! Entrando no seu painel...
            </p>
          ) : (
            <>
              <p className="text-sm text-black/50 mb-6">Informe o e-mail que recebeu o convite, o código enviado e crie sua senha de acesso.</p>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="label-light">E-mail</label>
                  <input className="input-light" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
                </div>
                <div>
                  <label className="label-light">Código recebido por e-mail</label>
                  <input className="input-light" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
                </div>
                <div>
                  <label className="label-light">Crie uma senha</label>
                  <input className="input-light" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div>
                  <label className="label-light">Confirme a senha</label>
                  <input className="input-light" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button type="submit" disabled={loading} className="btn-gold w-full">
                  {loading ? 'Salvando...' : 'Definir senha e entrar'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
