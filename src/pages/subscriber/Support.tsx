import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { formatDateTime } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'

const CATEGORIES = [
  'Pagamento', 'Assinatura', 'Retirada', 'Parceiro', 'Estoque', 'Loja', 'Pedido', 'Indicação', 'Bonificação', 'Saque', 'Acesso', 'Outros',
]

interface Ticket { id: string; category: string; subject: string; status: string; created_at: string }

export default function SubscriberSupport() {
  const { user } = useAuth()
  const [tickets, setTickets] = useState<Ticket[]>([])
  const [category, setCategory] = useState(CATEGORIES[0])
  const [subject, setSubject] = useState('')
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function load() {
    if (!user) return
    const { data } = await supabase.from('support_tickets').select('*').eq('user_id', user.id).order('created_at', { ascending: false })
    setTickets((data as Ticket[]) ?? [])
  }

  useEffect(() => { load() }, [user])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!user || !subject.trim()) return
    setLoading(true)
    await supabase.from('support_tickets').insert({ user_id: user.id, category, subject })
    setLoading(false)
    setSubject('')
    setSent(true)
    setTimeout(() => setSent(false), 2500)
    load()
  }

  return (
    <div className="space-y-5">
      <h1 className="font-display text-xl font-semibold">Suporte</h1>

      <form onSubmit={handleSubmit} className="card space-y-3">
        <p className="font-semibold text-sm">Abrir solicitação</p>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>
          {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <textarea className="input min-h-24" required placeholder="Descreva sua solicitação..." value={subject} onChange={(e) => setSubject(e.target.value)} />
        <button type="submit" disabled={loading} className="btn-gold w-full">{loading ? 'Enviando...' : sent ? 'Enviado!' : 'Enviar solicitação'}</button>
      </form>

      <div>
        <p className="font-semibold mb-3">Minhas solicitações</p>
        <div className="space-y-2">
          {tickets.map((t) => (
            <div key={t.id} className="card !py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gold-400 font-medium">{t.category}</span>
                <StatusBadge status={t.status} />
              </div>
              <p className="text-sm">{t.subject}</p>
              <p className="text-xs text-white/30 mt-1">{formatDateTime(t.created_at)}</p>
            </div>
          ))}
          {!tickets.length && <p className="text-sm text-white/40 text-center py-8">Nenhuma solicitação aberta.</p>}
        </div>
      </div>
    </div>
  )
}
