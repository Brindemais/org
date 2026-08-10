import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../contexts/AuthContext'
import { supabase } from '../../lib/supabase'
import { StatusBadge } from '../../components/ui/StatusBadge'
import { ImageUpload } from '../../components/ui/ImageUpload'

export default function PartnerProfile() {
  const { partner, refreshProfile } = useAuth()
  const [form, setForm] = useState({ address: '', opening_hours: '' })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [logoSaved, setLogoSaved] = useState(false)

  useEffect(() => {
    if (partner) {
      setLogoUrl(partner.logo_url ?? null)
      setForm({ address: partner.address ?? '', opening_hours: partner.opening_hours ?? '' })
    }
  }, [partner])

  async function saveLogo(url: string) {
    if (!partner) return
    setLogoUrl(url)
    await supabase.from('partners').update({ logo_url: url }).eq('id', partner.id)
    setLogoSaved(true)
    setTimeout(() => setLogoSaved(false), 2000)
  }

  async function saveDetails(e: FormEvent) {
    e.preventDefault()
    if (!partner) return
    setSaving(true)
    await supabase.from('partners').update({ address: form.address, opening_hours: form.opening_hours }).eq('id', partner.id)
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
        <ImageUpload value={logoUrl} onChange={saveLogo} folder="partner-logos" label="" circular />
        {logoSaved && <p className="text-xs text-emerald-400">Logotipo atualizado!</p>}
      </div>

      <form onSubmit={saveDetails} className="card space-y-3">
        <p className="font-semibold text-sm">Endereço e horário de funcionamento</p>
        <div>
          <label className="label">Endereço</label>
          <input className="input" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
        </div>
        <div>
          <label className="label">Horário de funcionamento</label>
          <input className="input" value={form.opening_hours} onChange={(e) => setForm({ ...form, opening_hours: e.target.value })} placeholder="Seg a Dom, 10h às 22h" />
        </div>
        <button type="submit" disabled={saving} className="btn-gold w-full">{saving ? 'Salvando...' : saved ? 'Salvo!' : 'Salvar alterações'}</button>
      </form>
    </div>
  )
}
