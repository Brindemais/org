import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Logo } from '../../components/layout/Logo'

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const { error: rpcError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    setLoading(false)
    if (rpcError) {
      setError('Não foi possível enviar o e-mail de recuperação. Tente novamente.')
      return
    }
    setSent(true)
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-white px-5 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex justify-center mb-8"><Logo dark /></Link>
        <div className="card-light">
          <h1 className="font-display text-xl font-semibold mb-1 text-ink-950">Recuperar senha</h1>
          <p className="text-sm text-black/50 mb-6">
            Informe o e-mail cadastrado e enviaremos um link para redefinir sua senha.
          </p>
          {sent ? (
            <p className="text-sm bg-gold-400/10 text-gold-700 rounded-lg px-3 py-3">
              Se este e-mail estiver cadastrado, você receberá um link de recuperação em instantes. Confira também a caixa de spam.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="label-light">E-mail</label>
                <input className="input-light" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button type="submit" disabled={loading} className="btn-gold w-full">
                {loading ? 'Enviando...' : 'Enviar link de recuperação'}
              </button>
            </form>
          )}
        </div>
        <p className="text-center text-sm text-black/40 mt-6">
          Lembrou a senha? <Link to="/entrar" className="text-gold-600 font-medium">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
