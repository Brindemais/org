import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { formatBRL, formatDate, maskCPF } from '../../lib/format'
import { StatusBadge } from '../../components/ui/StatusBadge'

interface Row { id: string; full_name: string; cpf: string | null; email: string | null; created_at: string; sub_status: string | null; balance: number }

export default function AdminSubscribers() {
  const [rows, setRows] = useState<Row[]>([])
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      setLoading(true)
      const { data: profiles } = await supabase.from('profiles').select('*').eq('role', 'subscriber').order('created_at', { ascending: false }).limit(200)
      const result: Row[] = []
      for (const p of profiles ?? []) {
        const [{ data: sub }, { data: bal }] = await Promise.all([
          supabase.from('subscriptions').select('status').eq('subscriber_id', p.id).order('created_at', { ascending: false }).limit(1).maybeSingle(),
          supabase.rpc('current_wallet_balance', { p_user_id: p.id }),
        ])
        result.push({ id: p.id, full_name: p.full_name, cpf: p.cpf, email: p.email, created_at: p.created_at, sub_status: sub?.status ?? null, balance: Number(bal ?? 0) })
      }
      setRows(result)
      setLoading(false)
    }
    load()
  }, [])

  const filtered = rows.filter((r) => r.full_name.toLowerCase().includes(search.toLowerCase()) || (r.cpf ?? '').includes(search.replace(/\D/g, '')))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Assinantes</h1>
          <p className="text-white/50 text-sm">{rows.length} cadastrados</p>
        </div>
        <input className="input !w-64" placeholder="Buscar por nome ou CPF..." value={search} onChange={(e) => setSearch(e.target.value)} />
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[720px]">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase">
              <th className="pb-3">Nome</th><th className="pb-3">CPF</th><th className="pb-3">E-mail</th><th className="pb-3">Assinatura</th><th className="pb-3">Saldo</th><th className="pb-3">Desde</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.id} className="border-t border-ink-800">
                <td className="py-3">{r.full_name}</td>
                <td className="py-3 text-white/50">{r.cpf ? maskCPF(r.cpf) : '-'}</td>
                <td className="py-3 text-white/50">{r.email}</td>
                <td className="py-3">{r.sub_status ? <StatusBadge status={r.sub_status} /> : <span className="text-white/30">Sem assinatura</span>}</td>
                <td className="py-3">{formatBRL(r.balance)}</td>
                <td className="py-3 text-white/50">{formatDate(r.created_at)}</td>
              </tr>
            ))}
            {!loading && !filtered.length && <tr><td colSpan={6} className="py-8 text-center text-white/40">Nenhum assinante encontrado.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
