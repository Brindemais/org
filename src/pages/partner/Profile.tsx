import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ImageUpload } from '../../components/ui/ImageUpload'

export default function PartnerProfile() {
  const { profile, partner, refreshProfile } = useAuth()
  const [form, setForm] = useState({
    address: '', opening_hours: '', address_number: '', neighborhood: '', cep: '',
    income_value: '', company_type: 'MEI', birth_date: '',
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoSaved, setLogoSaved] = useState(false)
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)
  const [avatarSaved, setAvatarSaved] = useState(false)

  const isCpf = (partner?.cnpj_cpf ?? '').replace(/\D/g, '').length === 11

  useEffect(() => {
    if (partner) {
      setLogoUrl(partner.logo_url ?? null)
      setForm({
        address: partner.address ?? '', opening_hours: partner.opening_hours ?? '',
        address_number: partner.address_number ?? '', neighborhood: partner.neighborhood ?? '', cep: partner.cep ?? '',
        income_value: partner.income_value != null ? String(partner.income_value) : '',
        company_type: partner.company_type ?? 'MEI', birth_date: partner.birth_date ?? '',
      })
    }
    if (profile) setAvatarUrl(profile.avatar_url ?? null)
  }, [partner, profile])

  async function saveLogo(url: string) {
    if (!partner) return
    setLogoUrl(url)
    await supabase.from('partners').update({ logo_url: url }).eq('id', partner.id)
    setLogoSaved(true)
    setTimeout(() => setLogoSaved(false), 2000)
  }

  async function saveAvatar(url: string) {
    if (!profile) return
    setAvatarUrl(url)
    await supabase.from('profiles').update({ avatar_url: url }).eq('id', profile.id)
    await refreshProfile()
    setAvatarSaved(true)
    setTimeout(() => setAvatarSaved(false), 2000)
  }

  async function saveDetails(e: FormEvent) {
    e.preventDefault()
    if (!partner) return
    setSaving(true)
    await supabase.from('partners').update({
      address: form.address, opening_hours: form.opening_hours,
      address_number: form.address_number || null, neighborhood: form.neighborhood || null, cep: form.cep || null,
      income_value: form.income_value ? Number(form.income_value.replace(',', '.')) : null,
      company_type: isCpf ? null : form.company_type,
      birth_date: isCpf ? (form.birth_date || null) : null,
    }).eq('id', partner.id)
    await refreshProfile()
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!partner) return null

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Meu estabelecimento</h1>
        <p className="text-white/50 text-sm">As alterações abaixo são aplicadas na hora.</p>
      </div>

      <div className="card space-y-1">
        <p className="font-semibold">{partner.trade_name}</p>
        <p className="text-sm text-white/50">{partner.company_name}</p>
        <StatusBadge status={partner.status} />
      </div>

      <div className="card space-y-2">
        <p className="font-semibold text-sm">Logotipo</p>
        <ImageUpload value={logoUrl} onChange={saveLogo} folder="partner-logos" label="" circular hint="Tamanho recomendado: 512x512px, formato quadrado, até 4MB." />
        {logoSaved && <p className="text-xs text-emerald-400">Logotipo atualizado!</p>}
      </div>

      <div className="card space-y-2">
        <p className="font-semibold text-sm">Foto do responsável</p>
        <ImageUpload value={avatarUrl} onChange={saveAvatar} folder="avatars" label="" circular />
        {avatarSaved && <p className="text-xs text-emerald-400">Foto atualizada!</p>}
      </div>

      <form onSubmit={saveDetails} className="card space-y-3">
        <p className="font-semibold text-sm">Endereço e horário de funcionamento</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Endereço</label>
            <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          </div>
          <div>
            <label className="label">Número</label>
            <input className="input" value={form.address_number} onChange={(e) => setForm({ ...form, address_number: e.target.value })} placeholder="123" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Bairro</label>
            <input className="input" value={form.neighborhood} onChange={(e) => setForm({ ...form, neighborhood: e.target.value })} />
          </div>
          <div>
            <label className="label">CEP</label>
            <input className="input" value={form.cep} onChange={(e) => setForm({ ...form, cep: e.target.value })} placeholder="00000-000" />
          </div>
        </div>
        <div>
          <label className="label">Horário de funcionamento</label>
          <input className="input" value={form.opening_hours} onChange={(e) => setForm({ ...form, opening_hours: e.target.value })} placeholder="Seg a Dom, 10h às 22h" />
        </div>

        <p className="font-semibold text-sm pt-2 border-t border-ink-800">Dados pra repasse automático (Asaas)</p>
        <p className="text-xs text-white/40 -mt-2">Preencha pra conseguir vincular sua conta Asaas e vender produtos com preço.</p>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Faturamento mensal estimado</label>
            <input className="input" inputMode="decimal" value={form.income_value} onChange={(e) => setForm({ ...form, income_value: e.target.value })} placeholder="0,00" />
          </div>
          {isCpf ? (
            <div>
              <label className="label">Data de nascimento</label>
              <input className="input" type="date" value={form.birth_date} onChange={(e) => setForm({ ...form, birth_date: e.target.value })} />
            </div>
          ) : (
            <div>
              <label className="label">Tipo de empresa</label>
              <select className="input" value={form.company_type} onChange={(e) => setForm({ ...form, company_type: e.target.value })}>
                <option value="MEI">MEI</option>
                <option value="LIMITED">Limitada</option>
                <option value="INDIVIDUAL">Empresário individual</option>
                <option value="ASSOCIATION">Associação</option>
              </select>
            </div>
          )}
        </div>

        <button type="submit" disabled={saving} className="btn-gold w-full">{saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar alterações'}</button>
      </form>
    </div>
  )
}
