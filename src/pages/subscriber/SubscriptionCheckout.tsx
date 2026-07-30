import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Copy } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { useSubscription } from '../../hooks/useSubscription'

export default function SubscriberSubscription() {
  const { user } = useAuth()
  const { subscription, reload } = useSubscription()
  const [pixCode, setPixCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const navigate = useNavigate()

  async function generatePix() {
    if (!user) return
    setLoading(true)
    const fakePix = `00020126360014BR.GOV.BCB.PIX0114${user.id.slice(0, 14)}5204000053039865406${(79).toFixed(2)}5802BR5913BRINDEMAIS6009RIOJANEIRO62070503***6304${Math.random().toString(36).slice(2, 6).toUpperCase()}`
    setPixCode(fakePix)
    await supabase.from('payments').insert({
      subscriber_id: user.id,
      subscription_id: subscription?.id ?? null,
      amount: 79.0,
      type: 'subscription',
      pix_code: fakePix,
    })
    setLoading(false)
  }

  function copyPix() {
    navigator.clipboard.writeText(pixCode)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-semibold">Assinatura</h1>

      <div className="rounded-xl bg-gold-gradient text-ink-950 p-5">
        <p className="text-xs font-bold uppercase opacity-70">Assinatura mensal</p>
        <p className="text-3xl font-bold">R$ 79,00<span className="text-sm font-medium">/mês</span></p>
      </div>

      {!pixCode ? (
        <button onClick={generatePix} disabled={loading} className="btn-gold w-full">
          {loading ? 'Gerando Pix...' : subscription ? 'Renovar assinatura via Pix' : 'Ativar assinatura via Pix'}
        </button>
      ) : (
        <div className="card space-y-4 text-center">
          <div className="w-40 h-40 mx-auto rounded-xl bg-white p-3 flex items-center justify-center">
            <div className="w-full h-full bg-[repeating-linear-gradient(45deg,#111_0,#111_4px,#fff_4px,#fff_8px)] opacity-80 rounded" />
          </div>
          <button onClick={copyPix} className="btn-dark w-full !py-2.5 text-sm gap-2">
            <Copy size={14} /> {copied ? 'Código copiado!' : 'Copiar código Pix'}
          </button>
          <p className="text-xs text-white/40">A confirmação do pagamento é validada pela equipe Brinde Mais e sua assinatura será ativada em instantes.</p>
          <button onClick={() => { reload(); navigate('/app') }} className="btn-gold w-full gap-2"><Check size={16} /> Já efetuei o pagamento</button>
        </div>
      )}
    </div>
  )
}
