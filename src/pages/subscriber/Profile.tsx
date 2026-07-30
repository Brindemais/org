import { useEffect, useState, type FormEvent } from 'react'
import { LogOut, ShieldCheck, Trash2, UserPlus } from 'lucide-react'
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

  async function cancelSubscription() {
    if (!subscription) return
    await supabase.from('subscriptions').update({ status: 'cancelled', cancelled_at: new Date().toISOString() }).eq('id', subscription.id)
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

      <div className="card flex items-center gap-3">
        <ShieldCheck size={18} className="text-gold-400 shrink-0" />
        <p className="text-xs text-white/50">Termos de Uso e Política de Privacidade regem o uso da plataforma Brinde Mais. Seus dados são protegidos conforme a LGPD.</p>
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
