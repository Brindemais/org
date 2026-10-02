import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { Logo } from '../../components/layout/Logo'

// Usa código digitado (verifyOtp type:'recovery'), não o link clicável do
// e-mail — clientes como iCloud/Apple Mail pré-acessam links por segurança
// (Mail Privacy Protection) antes do usuário clicar, o que consome o token
// de uso único do link e faz o clique real cair em "link expirado". O
// código não sofre disso porque não é "clicado" por nada automaticamente.
export default function ForgotPassword() {
  const [step, setStep] = useState<1 | 2>(1)
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [loading, setLoading] = useState(false)
  const [resent, setResent] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const navigate = useNavigate()

  async function sendCode() {
    const { error: rpcError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/redefinir-senha`,
    })
    return rpcError
  }

  async function handleStep1(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    const rpcError = await sendCode()
    setLoading(false)
    if (rpcError) {
      setError('Não foi possível enviar o e-mail de recuperação. Tente novamente.')
      return
    }
    setStep(2)
  }

  async function handleStep2(e: FormEvent) {
    e.preventDefault()
    setError(null)
    if (password.length < 6) return setError('A senha precisa ter pelo menos 6 caracteres.')
    if (password !== confirm) return setError('As senhas não coincidem.')

    setLoading(true)
    const { error: verifyError } = await supabase.auth.verifyOtp({ email, token: code.trim(), type: 'recovery' })
    if (verifyError) {
      setLoading(false)
      setError('Código incorreto ou expirado. Confira o e-mail ou peça um novo código.')
      return
    }
    const { error: updateError } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (updateError) {
      setError('Não foi possível redefinir sua senha. Tente novamente.')
      return
    }
    setDone(true)
    setTimeout(() => navigate('/entrar'), 2500)
  }

  async function resendCode() {
    setError(null)
    const rpcError = await sendCode()
    if (!rpcError) {
      setResent(true)
      setTimeout(() => setResent(false), 4000)
    }
  }

  return (
    <div className="min-h-dvh flex items-center justify-center bg-white px-5 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex justify-center mb-8"><Logo dark /></Link>
        <div className="card-light">
          <h1 className="font-display text-xl font-semibold mb-1 text-ink-950">Recuperar senha</h1>

          {done ? (
            <p className="text-sm bg-gold-400/10 text-gold-700 rounded-lg px-3 py-3">Senha redefinida com sucesso! Redirecionando para o login...</p>
          ) : step === 1 ? (
            <>
              <p className="text-sm text-black/50 mb-6">
                Informe o e-mail cadastrado e enviaremos um código para redefinir sua senha.
              </p>
              <form onSubmit={handleStep1} className="space-y-4">
                <div>
                  <label className="label-light">E-mail</label>
                  <input className="input-light" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="voce@email.com" />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button type="submit" disabled={loading} className="btn-gold w-full">
                  {loading ? 'Enviando...' : 'Enviar código'}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="text-sm text-black/50 mb-6">
                Enviamos um código para <strong>{email}</strong>. Confira também a caixa de spam. Digite o código e sua nova senha abaixo.
              </p>
              <form onSubmit={handleStep2} className="space-y-4">
                <div>
                  <label className="label-light">Código recebido por e-mail</label>
                  <input className="input-light" required value={code} onChange={(e) => setCode(e.target.value)} placeholder="123456" />
                </div>
                <div>
                  <label className="label-light">Nova senha</label>
                  <input className="input-light" type="password" required minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" />
                </div>
                <div>
                  <label className="label-light">Confirmar nova senha</label>
                  <input className="input-light" type="password" required minLength={6} value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="••••••••" />
                </div>
                {error && <p className="text-sm text-red-500">{error}</p>}
                <button type="submit" disabled={loading} className="btn-gold w-full">
                  {loading ? 'Salvando...' : 'Redefinir senha'}
                </button>
                <button type="button" onClick={resendCode} className="text-sm text-gold-600 font-medium w-full text-center">
                  {resent ? 'Código reenviado!' : 'Reenviar código'}
                </button>
              </form>
            </>
          )}
        </div>
        <p className="text-center text-sm text-black/40 mt-6">
          Lembrou a senha? <Link to="/entrar" className="text-gold-600 font-medium">Entrar</Link>
        </p>
      </div>
    </div>
  )
}
