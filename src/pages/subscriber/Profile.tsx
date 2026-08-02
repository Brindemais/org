import { useEffect, useState, type FormEvent } from 'react'
import { Download, LogOut, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import type { AuthorizedPerson } from '../../lib/types'
import { maskCPF, maskCEP, maskPhone } from '../../lib/format'
import { useSubscription } from '../../hooks/useSubscription'

export default function SubscriberProfile() {
  const { profile, refreshProfile, signOut } = useAuth()
  const { subscription, reload } = useSubscription()
  const [form, setForm] = useState({ phone: '', cep: '', address: '', neighborhood: '', city: '', state: '', pix_key: '' })
  const [saved, setSaved] = useState(false)
  const [saving, setSaving] = useState(false)
  const [authorized, setAuthorized] = useState<AuthorizedPerson[]>([])
  const [newAuth, setNewAuth] = useState({ full_name: '', cpf: '', phone: '', relationship: '' })
  const [confirmCancel, setConfirmCancel] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleteRequested, setDeleteRequested] = useState(false)

  useEffect(() => {
    if (profile) {
      setForm({
        phone: profile.phone ?? '', cep: profile.cep ?? '', address: profile.address ?? '',
        neighborhood: profile.neighborhood ?? '', city: profile.city ?? '', state: profile.state ?? '',
        pix_key: profile.pix_key ?? '',
      })
      supabase.from('authorized_persons').select('*').eq('subscriber_id', profile.id).eq('active', true).then(({ data }) => setAuthorized((data as AuthorizedPerson[]) ?? []))
    }
  }, [profile])

  async function saveProfile(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    setSaving(true)
    await supabase.from('profiles').update(form).eq('id', profile.id)
    await refreshProfile()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function addAuthorized(e: FormEvent) {
    e.preventDefault()
    if (!profile) return
    await supabase.from('authorized_persons').insert({ subscriber_id: profile.id, ...newAuth })
    const { data } = await supabase.from('authorized_persons').select('*').eq('subscriber_id', profile.id).eq('active', true)
    setAuthorized((data as AuthorizedPerson[]) ?? [])
    setNewAuth({ full_name: '', cpf: '', phone: '', relationship: '' })
  }

  async function removeAuthorized(id: string) {
    await supabase.from('authorized_persons').update({ active: false }).eq('id', id)
    setAuthorized((prev) => prev.filter((a) => a.id !== id))
  }

  async function downloadMyData() {
    if (!profile) return
    setDownloading(true)
    const { data } = await supabase.rpc('get_my_data')
    setDownloading(false)
    if (!data) return
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `brinde-mais-meus-dados-${profile.id.slice(0, 8)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  async function requestAccountDeletion() {
    if (!profile) return
    await supabase.from('support_tickets').insert({
      user_id: profile.id,
      category: 'LGPD',
      subject: 'Solicitação de exclusão de conta e dados pessoais (LGPD). Por favor, processe a exclusão respeitando as obrigações legais de retenção de dados financeiros.',
    })
    setConfirmDelete(false)
    setDeleteRequested(true)
  }

  const [cancelError, setCancelError] = useState<string | null>(null)

  async function cancelSubscription() {
    if (!subscription) return
    setCancelError(null)
    const { error } = await supabase.rpc('cancel_subscription', { p_subscription_id: subscription.id })
    if (error) {
      setCancelError('Não foi possível cancelar a assinatura. Tente novamente ou fale com o suporte.')
      return
    }
    setConfirmCancel(false)
    await reload()
  }

  if (!profile) return null

  return (
    <div className="space-y-6 pb-4">
      <h1 className="font-display text-xl font-semibold">Meu perfil</h1>

      <div className="card space-y-1">
        <p className="font-semibold">{profile.full_name}</p>
        <p className="text-sm text-white/40">{profile.email}</p>
        <p className="text-xs text-white/30">CPF {profile.cpf ? maskCPF(profile.cpf) : '-'}</p>
      </div>

      <form onSubmit={saveProfile} className="card space-y-3">
        <p className="font-semibold text-sm mb-1">Dados pessoais</p>
        <div>
          <label className="label">Celular</label>
          <input className="input" value={form.phone} onChange={(e) => setForm({ ...form, phone: maskPhone(e.target.value) })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">CEP</label>
            <input className="input" value={form.cep} onChange={(e) => setForm({ ...form, cep: maskCEP(e.target.value) })} />
          </div>
          <div>
            <label className="label">Bairro</label>
            <input className="input" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
          </div>
        </div>
        <div>
          <label className="label">Endereço</label>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Cidade</label>
            <input className="input" value={form.city} onChange={(e) => setForm({ ...form, city: e.target.value })} />
          </div>
          <div>
            <label className="label">Estado</label>
            <input className="input" value={form.state} onChange={(e) => setForm({ ...form, state: e.target.value })} maxLength={2} />
          </div>
        </div>
        <div>
          <label className="label">Chave Pix (para saques)</label>
          <input className="input" value={form.pix_key} onChange={(e) => setForm({ ...form, pix_key: e.target.value })} />
        </div>
        <button type="submit" disabled={saving} className="btn-gold w-full">{saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar alterações'}</button>
      </form>

      <div className="card space-y-3">
        <p className="font-semibold text-sm flex items-center gap-2"><UserPlus size={15} className="text-gold-400" /> Pessoas autorizadas para retirada</p>
        {authorized.map((a) => (
          <div key={a.id} className="flex items-center justify-between bg-ink-950 rounded-lg px-3 py-2 border border-ink-800">
            <div className="min-w-0">
              <p className="text-sm truncate">{a.full_name}</p>
              <p className="text-xs text-white/40">{maskCPF(a.cpf)} · {a.relationship}</p>
            </div>
            <button onClick={() => removeAuthorized(a.id)} className="text-red-400"><Trash2 size={14} /></button>
          </div>
        ))}
        <form onSubmit={addAuthorized} className="space-y-2 pt-2 border-t border-ink-800">
          <input className="input" placeholder="Nome completo" required value={newAuth.full_name} onChange={(e) => setNewAuth({ ...newAuth, full_name: e.target.value })} />
          <div className="grid grid-cols-2 gap-2">
            <input className="input" placeholder="CPF" required value={newAuth.cpf} onChange={(e) => setNewAuth({ ...newAuth, cpf: maskCPF(e.target.value) })} />
            <input className="input" placeholder="Celular" value={newAuth.phone} onChange={(e) => setNewAuth({ ...newAuth, phone: maskPhone(e.target.value) })} />
          </div>
          <input className="input" placeholder="Vínculo (ex: cônjuge, filho...)" value={newAuth.relationship} onChange={(e) => setNewAuth({ ...newAuth, relationship: e.target.value })} />
          <button type="submit" className="btn-dark w-full !py-2.5 text-sm">Adicionar pessoa autorizada</button>
        </form>
      </div>

      <div className="card space-y-3">
        <p className="font-semibold text-sm flex items-center gap-2"><ShieldCheck size={15} className="text-gold-400" /> Privacidade e dados (LGPD)</p>
        <p className="text-xs text-white/50">
          Seus dados são protegidos conforme a Lei Geral de Proteção de Dados. Leia os{' '}
          <Link to="/termos" target="_blank" className="text-gold-400 underline">Termos de Uso</Link> e a{' '}
          <Link to="/privacidade" target="_blank" className="text-gold-400 underline">Política de Privacidade</Link>.
        </p>
        <button onClick={downloadMyData} disabled={downloading} className="btn-dark w-full !py-2.5 text-sm gap-2">
          <Download size={14} /> {downloading ? 'Gerando arquivo...' : 'Baixar meus dados'}
        </button>
        {!confirmDelete && !deleteRequested && (
          <button onClick={() => setConfirmDelete(true)} className="text-xs text-red-400 font-medium">Solicitar exclusão da minha conta</button>
        )}
        {confirmDelete && (
          <div className="space-y-2 pt-1">
            <p className="text-xs text-white/50">
              Vamos abrir uma solicitação para a equipe Brinde Mais processar a exclusão da sua conta e dados pessoais,
              respeitando obrigações legais de retenção de histórico financeiro. Deseja continuar?
            </p>
            <div className="flex gap-2">
              <button onClick={requestAccountDeletion} className="btn-dark flex-1 !py-2 text-xs !border-red-500/40 text-red-400">Confirmar solicitação</button>
              <button onClick={() => setConfirmDelete(false)} className="btn-ghost flex-1 !py-2 text-xs">Voltar</button>
            </div>
          </div>
        )}
        {deleteRequested && (
          <p className="text-xs bg-gold-400/10 text-gold-300 rounded-lg px-3 py-2">
            Solicitação enviada! Nossa equipe entrará em contato pelo canal de Suporte.
          </p>
        )}
      </div>

      {subscription?.status === 'active' && (
        <div className="card">
          <p className="font-semibold text-sm mb-2">Assinatura</p>
          {!confirmCancel ? (
            <button onClick={() => setConfirmCancel(true)} className="text-sm text-red-400">Cancelar assinatura</button>
          ) : (
            <div className="space-y-2">
              <p className="text-xs text-white/50">Tem certeza? Você perderá acesso aos benefícios ao final do ciclo atual.</p>
              <div className="flex gap-2">
                <button onClick={cancelSubscription} className="btn-dark flex-1 !py-2 text-xs !border-red-500/40 text-red-400">Confirmar cancelamento</button>
                <button onClick={() => setConfirmCancel(false)} className="btn-ghost flex-1 !py-2 text-xs">Voltar</button>
              </div>
              {cancelError && <p className="text-xs text-red-400">{cancelError}</p>}
            </div>
          )}
        </div>
      )}

      <button onClick={signOut} className="btn-ghost w-full gap-2 text-red-400 !border-red-500/30">
        <LogOut size={16} /> Sair da conta
      </button>
    </div>
  )
}
