import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { Download, Store, Search, Boxes } from 'lucide-react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import type { Partner, PartnerStatus } from '../../lib/types'
import { PARTNER_CATEGORIES } from '../../lib/types'
import { StatusBadge, STATUS_LABELS } from '../../components/ui/StatusBadge'
import { EmptyState } from '../../components/ui/EmptyState'
import { ImageUpload } from '../../components/ui/ImageUpload'
import { downloadCSV } from '../../lib/csv'
import { maskCEP } from '../../lib/format'

const STATUS_FLOW: PartnerStatus[] = ['interested', 'pending_docs', 'analyzing', 'approved', 'active', 'suspended', 'rejected', 'closed']

const EDIT_FIELDS: { key: keyof Partner; label: string }[] = [
  { key: 'company_name', label: 'Razão social' },
  { key: 'trade_name', label: 'Nome fantasia' },
  { key: 'responsible_name', label: 'Responsável' },
  { key: 'cnpj_cpf', label: 'CNPJ/CPF' },
  { key: 'email', label: 'E-mail' },
  { key: 'phone', label: 'Telefone' },
  { key: 'whatsapp', label: 'WhatsApp' },
  { key: 'address', label: 'Endereço' },
  { key: 'address_number', label: 'Número' },
  { key: 'neighborhood', label: 'Bairro' },
  { key: 'city', label: 'Cidade' },
  { key: 'income_value', label: 'Faturamento mensal estimado (Asaas)' },
  { key: 'company_type', label: 'Tipo de empresa: MEI, LIMITED, INDIVIDUAL ou ASSOCIATION (Asaas)' },
  { key: 'birth_date', label: 'Data de nascimento se CPF, AAAA-MM-DD (Asaas)' },
]

export default function AdminPartners() {
  const [partners, setPartners] = useState<Partner[]>([])
  const [usernames, setUsernames] = useState<Record<string, string[]>>({})
  const [creating, setCreating] = useState(false)
  const [createMsg, setCreateMsg] = useState('')
  const [form, setForm] = useState({ company_name: '', trade_name: '', category: 'bar', whatsapp: '', address: '', neighborhood: '', cep: '', email: '', logo_url: '' })
  const [linking, setLinking] = useState<string | null>(null)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkMsg, setLinkMsg] = useState('')
  const [inviting, setInviting] = useState<string | null>(null)
  const [inviteMsg, setInviteMsg] = useState<Record<string, string>>({})
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editForm, setEditForm] = useState<Record<string, string>>({})
  const [editCategory, setEditCategory] = useState('bar')
  const [savingEdit, setSavingEdit] = useState(false)
  const [editError, setEditError] = useState<string | null>(null)
  const [logoSavedId, setLogoSavedId] = useState<string | null>(null)
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)
  const [asaasLinking, setAsaasLinking] = useState<string | null>(null)
  const [asaasMsg, setAsaasMsg] = useState<Record<string, string>>({})

  async function load() {
    const [{ data }, { data: staff }] = await Promise.all([
      supabase.from('partners').select('*').order('created_at', { ascending: false }),
      // Nome de usuário é um campo do profile de quem acessa o painel, não do
      // parceiro em si — um parceiro pode ter mais de um staff vinculado.
      supabase.from('partner_staff').select('partner_id, profiles(referral_code)'),
    ])
    setPartners((data as Partner[]) ?? [])
    const map: Record<string, string[]> = {}
    for (const row of (staff as any[]) ?? []) {
      const code = row.profiles?.referral_code
      if (code) (map[row.partner_id] ??= []).push(code)
    }
    setUsernames(map)
  }

  function startEdit(p: Partner) {
    setEditingId(p.id)
    setEditCategory(p.category)
    setEditError(null)
    const initial: Record<string, string> = {}
    for (const f of EDIT_FIELDS) initial[f.key] = (p[f.key] as string) ?? ''
    setEditForm(initial)
  }

  async function saveEdit(id: string) {
    setSavingEdit(true)
    setEditError(null)
    const payload: Record<string, string | null> = { category: editCategory }
    for (const f of EDIT_FIELDS) payload[f.key] = editForm[f.key]?.trim() || null
    const { error } = await supabase.from('partners').update(payload).eq('id', id)
    setSavingEdit(false)
    if (error) {
      setEditError(error.code === '23505' ? 'Já existe outro parceiro cadastrado com esse e-mail, telefone ou CNPJ/CPF.' : 'Não foi possível salvar as alterações.')
      return
    }
    setEditingId(null)
    load()
  }

  async function saveLogo(id: string, url: string) {
    await supabase.from('partners').update({ logo_url: url }).eq('id', id)
    setPartners((prev) => prev.map((p) => (p.id === id ? { ...p, logo_url: url } : p)))
    setLogoSavedId(id)
    setTimeout(() => setLogoSavedId(null), 2000)
  }

  const filtered = useMemo(() => partners.filter((p) => {
    const q = search.trim().toLowerCase()
    const matchesSearch = !q || p.trade_name.toLowerCase().includes(q) || p.company_name.toLowerCase().includes(q) || (p.email ?? '').toLowerCase().includes(q) || (p.neighborhood ?? '').toLowerCase().includes(q) || (usernames[p.id] ?? []).some((u) => u.toLowerCase().includes(q))
    const matchesCategory = !categoryFilter || p.category === categoryFilter
    const matchesStatus = !statusFilter || p.status === statusFilter
    return matchesSearch && matchesCategory && matchesStatus
  }), [partners, usernames, search, categoryFilter, statusFilter])

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
      .insert({ ...form, email: form.email || null, logo_url: form.logo_url || null, cep: form.cep.replace(/\D/g, '') || null, status: 'approved', approved_at: new Date().toISOString() })
      .select()
      .single()
    setCreating(false)
    if (error || !created) {
      setCreateMsg(error?.code === '23505' ? 'Já existe um parceiro cadastrado com esse e-mail, telefone ou CNPJ/CPF.' : 'Não foi possível cadastrar o parceiro.')
      return
    }
    setForm({ company_name: '', trade_name: '', category: 'bar', whatsapp: '', address: '', neighborhood: '', cep: '', email: '', logo_url: '' })
    if (created.email) {
      setCreateMsg('Parceiro cadastrado! Enviando convite de acesso por e-mail...')
      await approveAndInvite(created as Partner)
      setCreateMsg('Parceiro cadastrado e convite enviado por e-mail.')
    } else {
      setCreateMsg('Parceiro cadastrado! Sem e-mail informado. Adicione um e clique em "Enviar convite" na ficha dele para liberar o acesso.')
    }
    load()
  }

  async function setStatus(id: string, status: PartnerStatus) {
    if (statusBusyId) return
    setStatusBusyId(id)
    await supabase.rpc('admin_set_partner_status', { p_partner_id: id, p_status: status })
    setStatusBusyId(null)
    load()
  }

  async function approveAndInvite(partner: Partner) {
    if (statusBusyId || inviting) return
    setInviteMsg((m) => ({ ...m, [partner.id]: '' }))
    if (partner.status !== 'approved' && partner.status !== 'active') {
      setStatusBusyId(partner.id)
      await supabase.rpc('admin_set_partner_status', { p_partner_id: partner.id, p_status: 'approved' })
      setStatusBusyId(null)
    }
    if (partner.invited_at) {
      await load()
      return
    }
    if (!partner.email) {
      setInviteMsg((m) => ({ ...m, [partner.id]: 'Este parceiro não tem e-mail cadastrado. Adicione um e-mail antes de convidar.' }))
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
        ? 'Este e-mail já tinha conta, vinculado direto como parceiro (avise a pessoa para entrar com a senha que já usa).'
        : 'Convite enviado! A pessoa vai receber um e-mail para definir a senha e acessar o painel.',
    }))
    load()
  }

  async function resendInvite(partner: Partner) {
    if (statusBusyId || inviting) return
    if (!partner.email) {
      setInviteMsg((m) => ({ ...m, [partner.id]: 'Este parceiro não tem e-mail cadastrado. Adicione um e-mail antes de reenviar.' }))
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
      setInviteMsg((m) => ({ ...m, [partner.id]: `Não foi possível reenviar o convite: ${detail}` }))
      return
    }
    setInviteMsg((m) => ({
      ...m,
      [partner.id]: data?.already_had_account
        ? 'Essa pessoa já concluiu o cadastro, não havia convite pendente para reenviar.'
        : 'Novo e-mail enviado, com um código novo (o código anterior deixa de valer).',
    }))
    load()
  }

  async function linkAsaas(partner: Partner) {
    if (asaasLinking) return
    setAsaasLinking(partner.id)
    setAsaasMsg((m) => ({ ...m, [partner.id]: '' }))
    const { data: sessionData } = await supabase.auth.getSession()
    const { data, error } = await supabase.functions.invoke('asaas-create-subaccount', {
      body: { partner_id: partner.id },
      headers: { Authorization: `Bearer ${sessionData.session?.access_token}` },
    })
    setAsaasLinking(null)
    if (error || data?.error) {
      const detail = data?.error === 'MISSING_KYC_FIELDS'
        ? `Faltam dados: ${(data.missing ?? []).join(', ')}. Edite o parceiro e preencha antes de tentar de novo.`
        : (data?.detail ?? error?.message ?? 'Erro desconhecido')
      setAsaasMsg((m) => ({ ...m, [partner.id]: `Não foi possível vincular: ${detail}` }))
      return
    }
    setAsaasMsg((m) => ({ ...m, [partner.id]: data?.already_linked ? 'Esse parceiro já estava vinculado.' : 'Vinculado à Asaas! As vendas dele já passam a ser repassadas automaticamente.' }))
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
        nome_fantasia: p.trade_name, razao_social: p.company_name, nome_de_usuario: (usernames[p.id] ?? []).join(', '), categoria: p.category,
        status: p.status, whatsapp: p.whatsapp ?? '', bairro: p.neighborhood ?? '', cidade: p.city ?? '',
        cadastrado_em: p.created_at,
      })),
    )
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

      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-white/30" />
          <input className="input !pl-9" placeholder="Buscar por nome, e-mail ou bairro..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <select className="input !w-auto" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="">Todas as categorias</option>
          {PARTNER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
        </select>
        <select className="input !w-auto" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          {STATUS_FLOW.map((s) => <option key={s} value={s}>{STATUS_LABELS[s] ?? s}</option>)}
        </select>
      </div>

      <details className="card">
        <summary className="font-semibold cursor-pointer">+ Cadastrar novo parceiro</summary>
        <form onSubmit={createPartner} className="grid sm:grid-cols-2 gap-3 mt-4">
          <div className="sm:col-span-2">
            <ImageUpload value={form.logo_url || null} onChange={(url) => setForm({ ...form, logo_url: url })} folder="partner-logos" label="Logotipo (opcional)" circular hint="Tamanho recomendado: 512x512px, formato quadrado, até 4MB." />
          </div>
          <input className="input" required placeholder="Razão social" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
          <input className="input" required placeholder="Nome fantasia" value={form.trade_name} onChange={(e) => setForm({ ...form, trade_name: e.target.value })} />
          <select className="input" value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })}>
            {PARTNER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
          <input className="input" placeholder="WhatsApp" value={form.whatsapp} onChange={(e) => setForm({ ...form, whatsapp: e.target.value })} />
          <input className="input" type="email" placeholder="E-mail (login de acesso ao painel)" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <input className="input" placeholder="Endereço" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className="input" placeholder="Bairro" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
          <input className="input" placeholder="CEP" value={form.cep} onChange={(e) => setForm({ ...form, cep: maskCEP(e.target.value) })} />
          <p className="text-xs text-white/40 sm:col-span-2">
            Informando o e-mail, o convite de acesso ao painel do parceiro é enviado automaticamente ao cadastrar.
          </p>
          <button type="submit" disabled={creating} className="btn-gold sm:col-span-2">{creating ? 'Salvando...' : 'Cadastrar parceiro'}</button>
          {createMsg && <p className="text-xs text-gold-300 sm:col-span-2">{createMsg}</p>}
        </form>
      </details>

      <div className="space-y-3">
        {filtered.map((p) => (
          <div key={p.id} className="card">
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div>
                <p className="font-semibold">{p.trade_name}</p>
                <p className="text-xs text-white/40">{p.company_name} · {p.neighborhood ?? p.city}</p>
              </div>
              <div className="flex items-center gap-2">
                <StatusBadge status={p.status} />
                {p.is_advertiser && <span className="pill bg-gold-400/15 text-gold-300">Anunciante</span>}
                {p.requires_fee && !p.is_advertiser && <span className="pill bg-white/10 text-white/40">Taxa pendente</span>}
                {p.asaas_wallet_id ? (
                  <span className="pill bg-emerald-500/15 text-emerald-400">Repasse automático (Asaas)</span>
                ) : (
                  <button onClick={() => linkAsaas(p)} disabled={asaasLinking === p.id} className="pill bg-white/10 text-white/40 hover:text-white/70">
                    {asaasLinking === p.id ? 'Vinculando...' : 'Vincular à Asaas'}
                  </button>
                )}
                {editingId !== p.id && (
                  <button onClick={() => startEdit(p)} className="text-xs text-gold-400 font-medium">Editar</button>
                )}
                <Link to={`/admin/parceiros/${p.id}/gerenciar`} className="text-xs text-gold-400 font-medium flex items-center gap-1">
                  <Boxes size={12} /> Produtos e estoque
                </Link>
              </div>
            </div>

            {editingId === p.id ? (
              <div className="grid sm:grid-cols-2 gap-3 mb-3 bg-ink-950/50 rounded-lg p-3">
                <div className="sm:col-span-2">
                  <ImageUpload
                    value={p.logo_url}
                    onChange={(url) => saveLogo(p.id, url)}
                    folder="partner-logos"
                    label="Logotipo do estabelecimento"
                    circular
                    hint="Tamanho recomendado: 512x512px, formato quadrado, até 4MB."
                  />
                  {logoSavedId === p.id && <p className="text-xs text-emerald-400 mt-1">Logotipo atualizado!</p>}
                </div>
                {EDIT_FIELDS.map((f) => (
                  <input
                    key={f.key}
                    className="input !py-2 text-xs"
                    placeholder={f.label}
                    value={editForm[f.key] ?? ''}
                    onChange={(e) => setEditForm({ ...editForm, [f.key]: e.target.value })}
                  />
                ))}
                <select className="input !py-2 text-xs" value={editCategory} onChange={(e) => setEditCategory(e.target.value)}>
                  {PARTNER_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
                {editError && <p className="sm:col-span-2 text-xs text-red-400">{editError}</p>}
                <div className="sm:col-span-2 flex gap-2">
                  <button onClick={() => saveEdit(p.id)} disabled={savingEdit} className="btn-gold !py-2 !px-3 text-xs">{savingEdit ? 'Salvando...' : 'Salvar alterações'}</button>
                  <button onClick={() => setEditingId(null)} className="btn-ghost !py-2 !px-3 text-xs">Cancelar</button>
                </div>
              </div>
            ) : (p.responsible_name || p.email || p.phone || p.cnpj_cpf || p.address || usernames[p.id]?.length) && (
              <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 text-xs text-white/50 mb-3 bg-ink-950/50 rounded-lg p-3">
                {!!usernames[p.id]?.length && <p><span className="text-white/30">Nome de usuário:</span> <span className="font-mono">{usernames[p.id].join(', ')}</span></p>}
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
                  disabled={p.status === s || inviting === p.id || statusBusyId === p.id}
                  className={`pill text-xs ${p.status === s ? 'bg-gold-400/20 text-gold-300' : 'bg-ink-950 border border-ink-800 text-white/50 hover:text-white'}`}
                >
                  {s === 'approved' ? (inviting === p.id ? 'Enviando convite...' : 'Aprovado (envia convite)') : (STATUS_LABELS[s] ?? s)}
                </button>
              ))}
            </div>
            {p.invited_at ? (
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <p className="text-xs text-white/40">Convite enviado em {new Date(p.invited_at).toLocaleDateString('pt-BR')}.</p>
                <button onClick={() => resendInvite(p)} disabled={inviting === p.id || statusBusyId === p.id} className="text-xs text-gold-400 font-medium">
                  {inviting === p.id ? 'Reenviando...' : 'Reenviar e-mail'}
                </button>
              </div>
            ) : (p.status === 'approved' || p.status === 'active') && (
              <button onClick={() => approveAndInvite(p)} disabled={inviting === p.id || statusBusyId === p.id} className="text-xs text-gold-400 font-medium mb-3">
                {inviting === p.id ? 'Enviando convite...' : 'Enviar convite de acesso por e-mail'}
              </button>
            )}
            {inviteMsg[p.id] && <p className="text-xs text-white/50 mb-3">{inviteMsg[p.id]}</p>}
            {asaasMsg[p.id] && <p className="text-xs text-white/50 mb-3">{asaasMsg[p.id]}</p>}
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
        {!filtered.length && (
          <EmptyState dark icon={Store} title={partners.length ? 'Nenhum parceiro encontrado com esse filtro' : 'Nenhum parceiro cadastrado ainda'} />
        )}
      </div>
    </div>
  )
}
