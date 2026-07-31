import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Logo } from '../../components/layout/Logo'

export default function Login() {
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
    setLoading(false)
    if (signInError) {
      setError('E-mail ou senha inválidos.')
      return
    }
    const { data: profile } = await supabase.from('profiles').select('role').eq('id', data.user.id).maybeSingle()
    if (profile?.role === 'admin' || profile?.role === 'operator') navigate('/admin')
    else if (profile?.role === 'partner') navigate('/parceiro')
    else navigate('/app')
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-white px-5 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex justify-center mb-8"><Logo dark /></Link>
        <div className="card-light">
          <h1 className="font-display text-xl font-semibold mb-1 text-ink-950">Bem-vindo de volta</h1>
          <p className="text-sm text-black/50 mb-6">Entre na sua conta Brinde Mais.</p>
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
      </div>
    </div>
  )
}
