import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { fetchOwnRole } from '../../lib/auth'
import { LogoBadge } from '../../components/layout/Logo'

export default function SubscriberLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError || !data.user) {
      setLoading(false)
      setError('E-mail ou senha inválidos.')
      return
    }
    const role = await fetchOwnRole(data.user.id)
    setLoading(false)
    if (role === 'subscriber') {
      navigate('/app')
      return
    }
    await supabase.auth.signOut()
    if (role === 'partner') {
      setError('Essa conta é de parceiro. Use o login de parceiro.')
    } else if (role === 'admin' || role === 'operator') {
      setError('Essa conta é administrativa. Use o acesso em /admin.')
    } else {
      setError('Esta conta não é de assinante.')
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-white px-5 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex justify-center mb-6"><LogoBadge size={130} /></Link>
        <div className="card-light">
          <h1 className="font-display text-xl font-semibold mb-1 text-ink-950">Área do assinante</h1>
          <p className="text-sm text-black/50 mb-6">Entre com sua conta Brinde Mais.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label-light">E-mail</label>
              <input className="input-light" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="label-light">Senha</label>
                <Link to="/esqueci-senha" className="text-xs text-gold-600 font-medium">Esqueci minha senha</Link>
              </div>
              <input className="input-light" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            <button type="submit" disabled={loading} className="btn-gold w-full">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
        <p className="text-center text-sm text-black/40 mt-6">
          Ainda não tem conta? <Link to="/cadastro" className="text-gold-600 font-medium">Quero assinar</Link>
        </p>
        <p className="text-center text-sm text-black/40 mt-2">
          É parceiro? <Link to="/entrar/parceiro" className="text-gold-600 font-medium">Entrar como parceiro</Link>
        </p>
      </div>
    </div>
  )
}
