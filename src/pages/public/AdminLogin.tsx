import { useState, type FormEvent } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchOwnRole } from '../../lib/auth'
import { LogoBadge } from '../../components/layout/Logo'

export default function AdminLogin() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })
      if (signInError || !data.user) {
        setError('E-mail ou senha inválidos.')
        return
      }
      const role = await fetchOwnRole(data.user.id)
      if (role !== 'admin' && role !== 'operator') {
        await supabase.auth.signOut()
        setError('Esta conta não tem acesso administrativo.')
        return
      }
      // AuthContext picks up the new session and AdminGate renders the dashboard.
    } catch {
      setError('Não foi possível entrar agora. Verifique sua conexão e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-ink-950 px-5 py-10">
      <div className="w-full max-w-sm">
        <div className="flex justify-center mb-6"><LogoBadge size={130} /></div>
        <div className="card">
          <h1 className="font-display text-xl font-semibold mb-1 text-white">Acesso administrativo</h1>
          <p className="text-sm text-white/50 mb-6">Restrito à equipe Brinde Mais.</p>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="label">E-mail</label>
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@brindemais.com.br" />
            </div>
            <div>
              <label className="label">Senha</label>
              <input className="input" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-red-400">{error}</p>}
            <button type="submit" disabled={loading} className="btn-gold w-full">
              {loading ? 'Entrando...' : 'Entrar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
