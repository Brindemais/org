import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { CheckCircle2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { LogoBadge } from '../../components/layout/Logo'

export default function PartnerActivate() {
  const [ready, setReady] = useState(false)
  const [checking, setChecking] = useState(true)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setReady(!!data.session)
      setChecking(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setReady(true)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
    if (password !== confirm) return setError('As senhas não coincidem.')
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError('Não foi possível definir sua senha. O link pode ter expirado. Peça para a equipe reenviar o convite.')
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
          <p className="text-sm text-black/50 mb-6">Defina uma senha para acessar o seu painel.</p>

          {done ? (
            <p className="flex items-center gap-2 text-sm bg-gold-400/10 text-gold-700 rounded-lg px-3 py-3">
              <CheckCircle2 size={16} className="shrink-0" /> Senha definida! Entrando no seu painel...
            </p>
          ) : checking ? (
            <p className="text-sm text-black/50">Verificando convite...</p>
          ) : !ready ? (
            <p className="text-sm text-black/50">
              Abra esta página a partir do link enviado por e-mail. Se o link expirou, peça para a equipe Brinde Mais reenviar o convite.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
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
          )}
        </div>
      </div>
    </div>
  )
}
