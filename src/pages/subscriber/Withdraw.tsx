import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { useWallet } from '../../hooks/useWallet'
import { supabase } from '../../lib/supabase'
import { formatBRL } from '../../lib/format'

export default function SubscriberWithdraw() {
  const { profile, refreshProfile } = useAuth()
  const { available, reload } = useWallet()
  const [amount, setAmount] = useState('')
  const [pixKey, setPixKey] = useState(profile?.pix_key ?? '')
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    const numAmount = Number(amount.replace(',', '.'))
    if (numAmount < 100) return setError('O valor mínimo para saque é R$ 100,00.')
    if (numAmount > available) return setError('Saldo disponível insuficiente para este saque.')
    if (!pixKey.trim()) return setError('Informe uma chave Pix válida.')

    setLoading(true)
    if (pixKey !== profile?.pix_key) {
      await supabase.from('profiles').update({ pix_key: pixKey }).eq('id', profile!.id)
      await refreshProfile()
    }
    const { error: rpcError } = await supabase.rpc('request_withdrawal', { p_amount: numAmount, p_pix_key: pixKey })
    setLoading(false)
    if (rpcError) {
      setError(rpcError.message.includes('INSUFFICIENT_BALANCE') ? 'Saldo insuficiente.' : 'Não foi possível solicitar o saque.')
      return
    }
    await reload()
    setSuccess(true)
  }

  if (success) {
    return (
      <div className="text-center py-16 space-y-4">
        <p className="font-display text-xl font-semibold">Saque solicitado!</p>
        <p className="text-sm text-white/50">Seu pedido está em análise. Você será notificado assim que for aprovado e pago.</p>
        <button onClick={() => navigate('/app/carteira')} className="btn-gold">Voltar à carteira</button>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-semibold">Solicitar saque</h1>
      <div className="card">
        <p className="text-xs text-white/40 mb-1">Saldo disponível para saque</p>
        <p className="text-2xl font-bold text-gold-400">{formatBRL(available)}</p>
      </div>
      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="label">Valor do saque</label>
          <input className="input" required inputMode="decimal" placeholder="100,00" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Chave Pix</label>
          <input className="input" required value={pixKey} onChange={(e) => setPixKey(e.target.value)} placeholder="CPF, e-mail, celular ou chave aleatória" />
        </div>
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button type="submit" disabled={loading} className="btn-gold w-full">{loading ? 'Enviando...' : 'Solicitar saque'}</button>
        <p className="text-xs text-white/40 text-center">Saques passam por análise manual de segurança antes do pagamento.</p>
      </form>
    </div>
  )
}
