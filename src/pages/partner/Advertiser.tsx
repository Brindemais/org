import { useEffect, useState } from 'react'
import { Megaphone, Check, Clock, Gift, Percent } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDateTime } from '../../lib/format'

const FEE_AMOUNT = 149.9

interface PendingPayment { id: string; status: string; pix_code: string | null; pix_qr_code: string | null; created_at: string }

export default function PartnerAdvertiser() {
  const { partner, profile } = useAuth()
  const [pending, setPending] = useState<PendingPayment | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [stats, setStats] = useState({ products: 0, promotions: 0 })

  const isActive = !!partner?.is_advertiser && (!partner.advertiser_expires_at || new Date(partner.advertiser_expires_at) > new Date())

  useEffect(() => {
    if (!partner) return
    supabase.from('payments').select('id, status, pix_code, pix_qr_code, created_at').eq('partner_id', partner.id).eq('type', 'partner_fee').eq('status', 'pending')
      .order('created_at', { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setPending(data as PendingPayment | null))
    supabase.from('products').select('id', { count: 'exact', head: true }).eq('partner_id', partner.id).eq('approved', true)
      .then(({ count }) => setStats((s) => ({ ...s, products: count ?? 0 })))
    supabase.from('promotions').select('id', { count: 'exact', head: true }).eq('partner_id', partner.id).eq('status', 'approved')
      .then(({ count }) => setStats((s) => ({ ...s, promotions: count ?? 0 })))
  }, [partner])

  async function payFee() {
    if (!partner || !profile) return
    setLoading(true)
    setError(null)
    const { data, error: insertError } = await supabase.from('payments').insert({
      subscriber_id: profile.id,
      partner_id: partner.id,
      amount: FEE_AMOUNT,
      type: 'partner_fee',
    }).select('id, status, pix_code, pix_qr_code, created_at').single()
    if (insertError || !data) {
      setLoading(false)
      setError('Não foi possível gerar o pagamento. Você precisa ter uma assinatura Brinde Mais ativa para pagar a taxa de anunciante.')
      return
    }
    const { data: charge, error: chargeError } = await supabase.functions.invoke('asaas-create-pix-charge', { body: { payment_id: data.id } })
    setLoading(false)
    if (chargeError || !charge?.pix_code) {
      setError('Não foi possível gerar o Pix. Tente novamente.')
      return
    }
    setPending({ ...data, pix_code: charge.pix_code, pix_qr_code: charge.pix_qr_code ?? null } as PendingPayment)
  }

  if (!partner) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold flex items-center gap-2"><Megaphone size={22} className="text-gold-400" /> Anunciante</h1>
        <p className="text-white/50 text-sm">Taxa de anunciante Brinde Mais: {formatBRL(FEE_AMOUNT)}/mês, mesmo valor da assinatura do consumidor.</p>
      </div>

      {isActive ? (
        <>
          <div className="card !bg-gold-gradient !border-transparent flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-ink-950/20 flex items-center justify-center shrink-0"><Check size={20} className="text-ink-950" /></div>
            <div>
              <p className="font-display font-semibold text-ink-950">Você é Anunciante Brinde Mais!</p>
              <p className="text-xs text-ink-950/70">
                {partner.advertiser_expires_at ? `Válido até ${formatDateTime(partner.advertiser_expires_at)}.` : 'Assinatura ativa.'}
              </p>
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="card flex items-center gap-3">
              <Gift size={20} className="text-gold-400 shrink-0" />
              <div><p className="text-2xl font-bold">{stats.products}</p><p className="text-xs text-white/40">brindes aprovados</p></div>
            </div>
            <div className="card flex items-center gap-3">
              <Percent size={20} className="text-gold-400 shrink-0" />
              <div><p className="text-2xl font-bold">{stats.promotions}</p><p className="text-xs text-white/40">promoções ativas</p></div>
            </div>
          </div>
        </>
      ) : pending ? (
        <div className="card space-y-3">
          <p className="flex items-center gap-2 text-sm font-semibold"><Clock size={16} className="text-gold-400" /> Pagamento em análise</p>
          <p className="text-xs text-white/50">Pague o Pix abaixo. A confirmação é automática assim que a Asaas identificar o pagamento, e sua área de anunciante libera na hora.</p>
          {pending.pix_qr_code && (
            <div className="w-36 h-36 mx-auto rounded-xl bg-white p-2 flex items-center justify-center overflow-hidden">
              <img src={`data:image/png;base64,${pending.pix_qr_code}`} alt="QR Code Pix" className="w-full h-full object-contain" />
            </div>
          )}
          <div className="rounded-lg bg-ink-950 border border-ink-800 px-3 py-2.5 text-xs text-gold-300 break-all font-mono">{pending.pix_code}</div>
          <p className="text-xs text-white/30">Solicitado em {formatDateTime(pending.created_at)}</p>
        </div>
      ) : (
        <div className="card space-y-3">
          <p className="text-sm text-white/60">Pague a taxa de anunciante para liberar sua área com brindes, promoções e destaque para os assinantes Brinde Mais.</p>
          {error && <p className="text-sm text-red-400">{error}</p>}
          <button onClick={payFee} disabled={loading} className="btn-gold w-full">{loading ? 'Gerando Pix...' : `Pagar ${formatBRL(FEE_AMOUNT)}`}</button>
        </div>
      )}
    </div>
  )
}
