import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'

export default function PartnerProfile() {
  const { partner } = useAuth()
  const [form, setForm] = useState({ address: '', opening_hours: '' })
  const [requests, setRequests] = useState<any[]>([])
  const [sent, setSent] = useState(false)

  useEffect(() => {
    if (partner) setForm({ address: partner.address ?? '', opening_hours: partner.opening_hours ?? '' })
  }, [partner])

  useEffect(() => {
    if (!partner) return
    supabase.from('partner_change_requests').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false })
      .then(({ data }) => setRequests(data ?? []))
  }, [partner])

  async function requestChange(e: FormEvent) {
    e.preventDefault()
    if (!partner) return
    await supabase.from('partner_change_requests').insert({
      partner_id: partner.id,
      changes: { address: form.address, opening_hours: form.opening_hours },
    })
    setSent(true)
    setTimeout(() => setSent(false), 2500)
    const { data } = await supabase.from('partner_change_requests').select('*').eq('partner_id', partner.id).order('created_at', { ascending: false })
    setRequests(data ?? [])
  }

  if (!partner) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Meu estabelecimento</h1>
        <p className="text-white/50 text-sm">Alterações em dados sensíveis passam por aprovação da administração.</p>
      </div>

      <div className="card space-y-1">
        <p className="font-semibold">{partner.trade_name}</p>
        <p className="text-sm text-white/50">{partner.company_name}</p>
        <StatusBadge status={partner.status} />
      </div>

      <form onSubmit={requestChange} className="card space-y-3">
        <p className="font-semibold text-sm">Solicitar alteração de endereço / horário</p>
        <div>
          <label className="label">Endereço</label>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div>
          <label className="label">Horário de funcionamento</label>
          <input className="input" value={form.opening_hours} onChange={(e) => setForm({ ...form, opening_hours: e.target.value })} placeholder="Seg a Dom, 10h às 22h" />
        </div>
        <button type="submit" className="btn-gold w-full">{sent ? 'Enviado para análise!' : 'Enviar para aprovação'}</button>
      </form>

      <div>
        <p className="font-semibold mb-3">Solicitações enviadas</p>
        <div className="space-y-2">
          {requests.map((r) => (
            <div key={r.id} className="card !py-3 flex items-center justify-between">
              <p className="text-xs text-white/50">{formatDateTime(r.created_at)}</p>
              <StatusBadge status={r.status} />
            </div>
          ))}
          {!requests.length && <p className="text-sm text-white/40 text-center py-6">Nenhuma solicitação enviada.</p>}
        </div>
      </div>
    </div>
  )
}
