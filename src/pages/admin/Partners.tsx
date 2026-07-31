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
  const [form, setForm] = useState({ company_name: '', trade_name: '', category: 'bar', whatsapp: '', address: '', neighborhood: '' })
  const [linking, setLinking] = useState<string | null>(null)
  const [linkEmail, setLinkEmail] = useState('')
  const [linkMsg, setLinkMsg] = useState('')

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
    await supabase.from('partners').insert({ ...form, status: 'analyzing' })
    setCreating(false)
    setForm({ company_name: '', trade_name: '', category: 'bar', whatsapp: '', address: '', neighborhood: '' })
    load()
  }

  async function setStatus(id: string, status: PartnerStatus) {
    await supabase.rpc('admin_set_partner_status', { p_partner_id: id, p_status: status })
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
          <input className="input" placeholder="Endereço" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <input className="input" placeholder="Bairro" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
          <button type="submit" disabled={creating} className="btn-gold sm:col-span-2">{creating ? 'Salvando...' : 'Cadastrar parceiro'}</button>
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
            <div className="flex flex-wrap gap-2 mb-3">
              {STATUS_FLOW.map((s) => (
                <button key={s} onClick={() => setStatus(p.id, s)} disabled={p.status === s} className={`pill text-xs ${p.status === s ? 'bg-gold-400/20 text-gold-300' : 'bg-ink-950 border border-ink-800 text-white/50 hover:text-white'}`}>
                  {s}
                </button>
              ))}
            </div>
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
