import { useEffect, useState, type FormEvent } from 'react'
import { ShieldCheck, UserCog } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'
import { EmptyState } from '../../components/ui/EmptyState'
import { formatDate } from '../../lib/format'

export default function AdminTeam() {
  const { profile } = useAuth()
  const [staff, setStaff] = useState<Profile[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState({ full_name: '', email: '', role: 'operator' })
  const [inviting, setInviting] = useState(false)
  const [inviteMsg, setInviteMsg] = useState('')
  const [busy, setBusy] = useState<string | null>(null)

  const isFullAdmin = profile?.role === 'admin'

  async function load() {
    setLoading(true)
    const { data } = await supabase.from('profiles').select('*').in('role', ['admin', 'operator']).order('created_at', { ascending: false })
    setStaff((data as Profile[]) ?? [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  async function invite(e: FormEvent) {
    e.preventDefault()
    setInviting(true)
    setInviteMsg('')
    const { data: sessionData } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('invite-staff', {
      body: {
        email: form.email.trim(),
        full_name: form.full_name.trim(),
        role: form.role,
        redirect_to: `${window.location.origin}/parceiro/ativar`,
      },
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    })
    setInviting(false)
    if (error || data?.error) {
      setInviteMsg(`Não foi possível enviar o convite: ${data?.detail ?? error?.message ?? 'Erro desconhecido'}`)
      return
    }
    setInviteMsg(
      data?.already_had_account
        ? 'Este e-mail já tinha conta, papel atualizado direto (avise a pessoa para entrar com a senha que já usa).'
        : 'Convite enviado! A pessoa vai receber um e-mail para definir a senha e acessar o painel.',
    )
    setForm({ full_name: '', email: '', role: 'operator' })
    load()
  }

  async function toggleActive(p: Profile) {
    setBusy(p.id)
    const { error } = await supabase.rpc('admin_set_subscriber_active', { p_subscriber_id: p.id, p_active: !p.active })
    setBusy(null)
    if (error) return
    setStaff((prev) => prev.map((x) => (x.id === p.id ? { ...x, active: !x.active } : x)))
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Equipe administrativa</h1>
        <p className="text-white/50 text-sm">Contas com acesso ao painel administrativo (admin e operador).</p>
      </div>

      {isFullAdmin ? (
        <details className="card">
          <summary className="font-semibold cursor-pointer">+ Convidar membro da equipe</summary>
          <form onSubmit={invite} className="grid sm:grid-cols-2 gap-3 mt-4">
            <input className="input" required placeholder="Nome completo" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} />
            <input className="input" required type="email" placeholder="E-mail" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            <select className="input sm:col-span-2" value={form.role} onChange={(e) => setForm({ ...form, role: e.target.value })}>
              <option value="operator">Operador (acesso operacional do dia a dia)</option>
              <option value="admin">Administrador (acesso total, inclusive gestão de equipe)</option>
            </select>
            <p className="text-xs text-white/40 sm:col-span-2">
              A pessoa recebe um e-mail para definir a senha e acessar direto o painel administrativo.
            </p>
            <button type="submit" disabled={inviting} className="btn-gold sm:col-span-2">{inviting ? 'Enviando...' : 'Enviar convite'}</button>
            {inviteMsg && <p className="text-xs text-gold-300 sm:col-span-2">{inviteMsg}</p>}
          </form>
        </details>
      ) : (
        <div className="card">
          <p className="text-sm text-white/50">Só contas com papel <strong className="text-white/70">administrador</strong> podem convidar novos membros da equipe.</p>
        </div>
      )}

      <div className="card overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="text-left text-white/40 text-xs uppercase">
              <th className="pb-3">Nome</th><th className="pb-3">E-mail</th><th className="pb-3">Papel</th><th className="pb-3">Desde</th><th className="pb-3">Conta</th>
              {isFullAdmin && <th className="pb-3">Ação</th>}
            </tr>
          </thead>
          <tbody>
            {staff.map((p) => (
              <tr key={p.id} className="border-t border-ink-800">
                <td className="py-3">{p.full_name}</td>
                <td className="py-3 text-white/50">{p.email}</td>
                <td className="py-3">
                  <span className={`pill ${p.role === 'admin' ? 'bg-gold-400/15 text-gold-300' : 'bg-ink-900 text-white/50'}`}>
                    {p.role === 'admin' ? <ShieldCheck size={12} className="inline mr-1 -mt-0.5" /> : <UserCog size={12} className="inline mr-1 -mt-0.5" />}
                    {p.role === 'admin' ? 'Administrador' : 'Operador'}
                  </span>
                </td>
                <td className="py-3 text-white/50">{formatDate(p.created_at)}</td>
                <td className="py-3">
                  <span className={`pill ${p.active ? 'bg-emerald-500/15 text-emerald-400' : 'bg-red-500/15 text-red-400'}`}>{p.active ? 'Ativa' : 'Suspensa'}</span>
                </td>
                {isFullAdmin && (
                  <td className="py-3">
                    {p.id !== profile?.id && (
                      <button onClick={() => toggleActive(p)} disabled={busy === p.id} className="btn-ghost !py-1.5 !px-3 text-xs">
                        {busy === p.id ? '...' : p.active ? 'Suspender' : 'Reativar'}
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
            {!loading && !staff.length && (
              <tr><td colSpan={isFullAdmin ? 6 : 5}><EmptyState dark icon={UserCog} title="Nenhum membro de equipe cadastrado" className="py-8" /></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
