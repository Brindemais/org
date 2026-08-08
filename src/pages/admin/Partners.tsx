import { useEffect, useState, type FormEvent } from 'react'
import { Download, Store } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import type { Partner, PartnerStatus } from '../../lib/types'
import { PARTNER_CATEGORIES } from '../../lib/types'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { downloadCSV } from '../../lib/csv'

const STATUS_FLOW: PartnerStatus[] = ['interested', 'pending_docs', 'analyzing', 'approved', 'active', 'suspended', 'rejected', 'closed']

export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [requests, setRequests] = useState<any[]>([])
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState('')
  const [form, setForm] = useState({ company_name: '', trade_name: '', category: 'bar', whatsapp: '', address: '', neighborhood: '', email: '' })
  const [linking, setLinking] = useState<string | null>(null)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkMsg, setLinkMsg] = useState('')
  const [inviting, setInviting] = useState<string | null>(null)
  const [inviteMsg, setInviteMsg] = useState<Record<string, string>>({})

  async function load() {
    const { data } = await supabase.from('partners').select('*').order('created_at', { ascending: false })
    setPartners((data as Partner[]) ?? [])
    const { data: reqs } = await supabase.from('partner_change_requests').select('*, partner:partner_id(trade_name)').eq('status', 'pending').order('created_at', { ascending: false })
    setRequests(reqs ?? [])
  }

  useEffect(() => { load() }, [])

  async function createPartner(e: FormEvent) {
    e.preventDefault()
    setCreating(true)
    setCreateMsg('')
    // Admin is registering someone already vetted (by phone/presencial), so
    // this goes straight to 'approved' instead of through the interested ->
    // pending_docs -> analyzing queue that the public "Quero ser parceiro"
    // form feeds. If an e-mail was given, the access invite fires right
    // away too — no separate manual step needed.
    const { data: created, error } = await supabase
      .from('partners')
      .insert({ ...form, email: form.email || null, status: 'approved', approved_at: new Date().toISOString() })
      .select()
      .single()
    setCreating(false)
    if (error || !created) {
      setCreateMsg('Não foi possível cadastrar o parceiro.')
      return
    }
    setForm({ company_name: '', trade_name: '', category: 'bar', whatsapp: '', address: '', neighborhood: '', email: '' })
    if (created.email) {
      setCreateMsg('Parceiro cadastrado! Enviando convite de acesso por e-mail...')
      await approveAndInvite(created as Partner)
      setCreateMsg('Parceiro cadastrado e convite enviado por e-mail.')
    } else {
      setCreateMsg('Parceiro cadastrado! Sem e-mail informado — adicione um e clique em "Enviar convite" na ficha dele para liberar o acesso.')
    }
    load()
  }

  async function setStatus(id: string, status: PartnerStatus) {
    await supabase.rpc('admin_set_partner_status', { p_partner_id: id, p_status: status })
    load()
  }

  async function approveAndInvite(partner: Partner) {
    setInviteMsg((m) => ({ ...m, [partner.id]: '' }))
    if (partner.status !== 'approved' && partner.status !== 'active') {
      await supabase.rpc('admin_set_partner_status', { p_partner_id: partner.id, p_status: 'approved' })
    }
    if (partner.invited_at) {
      await load()
      return
    }
    if (!partner.email) {
      setInviteMsg((m) => ({ ...m, [partner.id]: 'Este parceiro não tem e-mail cadastrado — adicione um e-mail antes de convidar.' }))
      return
    }
    setInviting(partner.id)
    const { data: sessionData } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('invite-partner', {
      body: { partner_id: partner.id, redirect_to: `${window.location.origin}/parceiro/ativar` },
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    })
    setInviting(null)
    if (error || data?.error) {
      const detail = data?.error === 'PARTNER_HAS_NO_EMAIL' ? 'Parceiro sem e-mail cadastrado.' : (data?.detail ?? error?.message ?? 'Erro desconhecido')
      setInviteMsg((m) => ({ ...m, [partner.id]: `Não foi possível enviar o convite: ${detail}` }))
      return
    }
    setInviteMsg((m) => ({
      ...m,
      [partner.id]: data?.already_had_account
        ? 'Este e-mail já tinha conta — vinculado direto como parceiro (avise a pessoa para entrar com a senha que já usa).'
        : 'Convite enviado! A pessoa vai receber um e-mail para definir a senha e acessar o painel.',
    }))
    load()
  }

  async function linkStaff(partnerId: string) {
    setLinkMsg('')
    const { data: profile } = await supabase.from('profiles').select('id, role').eq('email', linkEmail.trim()).maybeSingle()
    if (!profile) { setLinkMsg('Nenhum cadastro encontrado com este e-mail. Peça para a pessoa se cadastrar primeiro em /cadastro.'); return }
    await supabase.from('partner_staff').insert({ partner_id: partnerId, profile_id: profile.id })
    await supabase.from('profiles').update({ role: 'partner' }).eq('id', profile.id)
    setLinkMsg('Acesso vinculado com sucesso!')
    setLinkEmail('')
  }

  function exportCSV() {
    downloadCSV(
      `parceiros-brinde-mais-${new Date().toISOString().slice(0, 10)}.csv`,
      partners.map((p) => ({
        nome_fantasia: p.trade_name, razao_social: p.company_name, categoria: p.category,
        status: p.status, whatsapp: p.whatsapp ?? '', bairro: p.neighborhood ?? '', cidade: p.city ?? '',
        cadastrado_em: p.created_at,
      })),
    )
  }

  async function reviewRequest(req: any, approve: boolean) {
    if (approve) {
      await supabase.from('partners').update(req.changes).eq('id', req.partner_id)
    }
    await supabase.from('partner_change_requests').update({ status: approve ? 'approved' : 'rejected', reviewed_at: new Date().toISOString() }).eq('id', req.id)
    load()
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Parceiros</h1>
          <p className="text-white/50 text-sm">Credenciamento e gestão dos parceiros comerciais.</p>
        </div>
        <button onClick={exportCSV} className="btn-dark !px-3 !py-2 text-xs gap-1.5 shrink-0"><Download size={14} /> Exportar CSV</button>
      </div>

      {requests.length > 0 && (
        <div className="card border-gold-400/30">
          <p className="font-semibold mb-3">Solicitações de alteração pendentes</p>
          <div className="space-y-2">
            {requests.map((r) => (
              <div key={r.id} className="flex items-center justify-between border-b border-ink-800 last:border-0 pb-2 last:pb-0">
                <div className="text-sm">
                  <p className="font-medium">{r.partner?.trade_name}</p>
                  <p className="text-xs text-white/40">{JSON.stringify(r.changes)}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => reviewRequest(r, true)} className="btn-gold !py-1.5 !px-3 text-xs">Aprovar</button>
                  <button onClick={() => reviewRequest(r, false)} className="btn-ghost !py-1.5 !px-3 text-xs">Recusar</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <details className="card">
        <summary className="font-semibold cursor-pointer">+ Cadastrar novo parceiro</summary>
        <form onSubmit={createPartner} className="grid sm:grid-cols-2 gap-3 mt-4">
          <input className="input" required placeholder="Razão social" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          <input className="input" required placeholder="Nome fantasia" value={form.trade_name} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} />
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {PARTNER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input className="input" placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          <input className="input" type="email" placeholder="E-mail (login de acesso ao painel)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Endereço" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className="input" placeholder="Bairro" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
          <p className="text-xs text-white/40 sm:col-span-2">
            Informando o e-mail, o convite de acesso ao painel do parceiro é enviado automaticamente ao cadastrar.
          </p>
          <button type="submit" disabled={creating} className="btn-gold sm:col-span-2">{creating ? 'Salvando...' : 'Cadastrar parceiro'}</button>
          {createMsg && <p className="text-xs text-gold-300 sm:col-span-2">{createMsg}</p>}
        </form>
      </details>

      <div className="space-y-3">
        {partners.map((p) => (
          <div key={p.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold">{p.trade_name}</p>
                <p className="text-xs text-white/40">{p.company_name} · {p.neighborhood ?? p.city}</p>
              </div>
              <StatusBadge status={p.status} />
            </div>
            {(p.responsible_name || p.email || p.phone || p.cnpj_cpf || p.address) && (
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/50 mb-3 bg-ink-950/50 rounded-lg p-3">
                {p.responsible_name && <p><span className="text-white/30">Responsável:</span> {p.responsible_name}</p>}
                {p.email && <p><span className="text-white/30">E-mail:</span> {p.email}</p>}
                {p.phone && <p><span className="text-white/30">Telefone:</span> {p.phone}</p>}
                {p.whatsapp && p.whatsapp !== p.phone && <p><span className="text-white/30">WhatsApp:</span> {p.whatsapp}</p>}
                {p.cnpj_cpf && <p><span className="text-white/30">CNPJ/CPF:</span> {p.cnpj_cpf}</p>}
                {p.address && <p><span className="text-white/30">Endereço:</span> {p.address}{p.city ? `, ${p.city}` : ''}</p>}
              </div>
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              {STATUS_FLOW.map((s) => (
                <button
                  key={s}
                  onClick={() => (s === 'approved' ? approveAndInvite(p) : setStatus(p.id, s))}
                  disabled={p.status === s || inviting === p.id}
                  className={`pill text-xs ${p.status === s ? 'bg-gold-400/20 text-gold-300' : 'bg-ink-950 border border-ink-800 text-white/50 hover:text-white'}`}
                >
                  {s === 'approved' ? (inviting === p.id ? 'enviando convite...' : 'approved (envia convite)') : s}
                </button>
              ))}
            </div>
            {p.invited_at ? (
              <p className="text-xs text-white/40 mb-3">Convite enviado em {new Date(p.invited_at).toLocaleDateString('pt-BR')}.</p>
            ) : (p.status === 'approved' || p.status === 'active') && (
              <button onClick={() => approveAndInvite(p)} disabled={inviting === p.id} className="text-xs text-gold-400 font-medium mb-3">
                {inviting === p.id ? 'Enviando convite...' : 'Enviar convite de acesso por e-mail'}
              </button>
            )}
            {inviteMsg[p.id] && <p className="text-xs text-white/50 mb-3">{inviteMsg[p.id]}</p>}
            {linking === p.id ? (
              <div className="flex gap-2 items-center">
                <input className="input !py-2 text-xs flex-1" placeholder="E-mail do responsável já cadastrado" value={linkEmail} onChange={(e) => setLinkEmail(e.target.value)} />
                <button onClick={() => linkStaff(p.id)} className="btn-gold !py-2 !px-3 text-xs">Vincular</button>
                <button onClick={() => { setLinking(null); setLinkMsg('') }} className="btn-ghost !py-2 !px-3 text-xs">X</button>
              </div>
            ) : (
              <button onClick={() => setLinking(p.id)} className="text-xs text-gold-400 font-medium">Vincular acesso de usuário parceiro</button>
            )}
            {linking === p.id && linkMsg && <p className="text-xs text-white/50 mt-2">{linkMsg}</p>}
          </div>
        ))}
        {!partners.length && <EmptyState dark icon={Store} title="Nenhum parceiro cadastrado ainda" />}
      </div>
    </div>
  )
}
