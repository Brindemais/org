import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import { formatDateTime } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'

export default function AdminSupport() {
  const { profile } = useAuth()
  const [tickets, setTickets] = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [messages, setMessages] = useState<any[]>([])
  const [reply, setReply] = useState('')

  async function load() {
    const { data } = await supabase.from('support_tickets').select('*, user:user_id(full_name, email)').order('created_at', { ascending: false })
    setTickets(data ?? [])
  }
  useEffect(() => { load() }, [])

  async function open(t: any) {
    setSelected(t)
    const { data } = await supabase.from('support_messages').select('*, sender:sender_id(full_name)').eq('ticket_id', t.id).order('created_at')
    setMessages(data ?? [])
  }

  async function sendReply() {
    if (!selected || !profile || !reply.trim()) return
    await supabase.from('support_messages').insert({ ticket_id: selected.id, sender_id: profile.id, message: reply })
    await supabase.from('support_tickets').update({ status: 'in_progress' }).eq('id', selected.id)
    setReply('')
    open(selected)
    load()
  }

  async function closeTicket() {
    if (!selected) return
    await supabase.from('support_tickets').update({ status: 'resolved' }).eq('id', selected.id)
    open(selected)
    load()
  }

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-1 space-y-3">
        <h1 className="font-display text-2xl font-semibold">Suporte</h1>
        <div className="space-y-2">
          {tickets.map((t) => (
            <button key={t.id} onClick={() => open(t)} className={`card w-full text-left !py-3 ${selected?.id === t.id ? 'border-gold-400' : ''}`}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-gold-400">{t.category}</span>
                <StatusBadge status={t.status} />
              </div>
              <p className="text-sm truncate">{t.subject}</p>
              <p className="text-xs text-white/40">{t.user?.full_name}</p>
            </button>
          ))}
          {!tickets.length && <p className="text-sm text-white/40 text-center py-8">Nenhum chamado.</p>}
        </div>
      </div>

      <div className="lg:col-span-2">
        {selected ? (
          <div className="card h-full flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="font-semibold">{selected.subject}</p>
                <p className="text-xs text-white/40">{selected.user?.full_name} · {selected.user?.email}</p>
              </div>
              <button onClick={closeTicket} className="btn-ghost !py-1.5 !px-3 text-xs">Encerrar chamado</button>
            </div>
            <div className="flex-1 space-y-3 mb-4 max-h-96 overflow-y-auto">
              {messages.map((m: any) => (
                <div key={m.id} className="bg-ink-950 border border-ink-800 rounded-lg p-3">
                  <p className="text-xs text-gold-400 mb-1">{m.sender?.full_name}</p>
                  <p className="text-sm">{m.message}</p>
                  <p className="text-xs text-white/30 mt-1">{formatDateTime(m.created_at)}</p>
                </div>
              ))}
              {!messages.length && <p className="text-sm text-white/40">Sem respostas ainda.</p>}
            </div>
            <div className="flex gap-2">
              <input className="input flex-1" placeholder="Responder..." value={reply} onChange={(e) => setReply(e.target.value)} />
              <button onClick={sendReply} className="btn-gold !px-4">Enviar</button>
            </div>
          </div>
        ) : (
          <div className="card h-full flex items-center justify-center text-white/40 text-sm">Selecione um chamado para responder.</div>
        )}
      </div>
    </div>
  )
}
